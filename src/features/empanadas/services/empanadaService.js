import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/services/firebase/firebaseConfig';
import { uniqueUserIds } from '@/utils/sharedLibraryUtils';
import {
  clearMealPlanSlot,
  setMealPlanSlot,
} from '@/features/meals/services/mealService';
import {
  normalizeFlavorList,
  parseEmpanadaCount,
  validateOrderDraft,
} from '@/features/empanadas/utils/empanadaUtils';

function getConfigRef(groupId) {
  return doc(db, 'groups', groupId, 'empanadaConfig', 'main');
}

function getOrdersRef(groupId) {
  return collection(db, 'groups', groupId, 'empanadaOrders');
}

function getOrderRef(groupId, memberId) {
  return doc(db, 'groups', groupId, 'empanadaOrders', memberId);
}

export async function selectEmpanadaVendor({
  groupId,
  vendor,
  currentUserUid,
  accessUserIds = [],
}) {
  if (!groupId || !vendor?.id || !currentUserUid) {
    throw new Error('Local o viaje inválido.');
  }

  const flavors = normalizeFlavorList(vendor.flavors || []);
  if (flavors.length === 0) throw new Error('El local no tiene gustos cargados.');

  const configRef = getConfigRef(groupId);
  const [configSnapshot, ordersSnapshot] = await Promise.all([
    getDoc(configRef),
    getDocs(getOrdersRef(groupId)),
  ]);
  const previous = configSnapshot.exists() ? configSnapshot.data() : null;
  const isSameVendor =
    previous?.sourceVendorId === vendor.id ||
    (previous?.sourceVendorScope !== 'shared' &&
      vendor.legacyOwnerUid === previous?.sourceVendorOwnerUid &&
      vendor.legacyVendorId === previous?.sourceVendorId);
  const previousCatalogSignature = JSON.stringify(
    (previous?.flavors || []).map(({ id, code, name }) => [id, code, name]),
  );
  const nextCatalogSignature = JSON.stringify(
    flavors.map(({ id, code, name }) => [id, code, name]),
  );
  const catalogChanged = previousCatalogSignature !== nextCatalogSignature;
  const batch = writeBatch(db);
  const sharedUsers = uniqueUserIds([currentUserUid, ...(vendor.accessUserIds || []), ...accessUserIds]);
  const vendorRef = doc(db, 'empanadaVendors', vendor.id);

  batch.update(vendorRef, {
    accessUserIds: arrayUnion(...sharedUsers),
    updatedAt: serverTimestamp(),
  });

  if (!isSameVendor || catalogChanged) {
    ordersSnapshot.docs.forEach((orderDoc) => batch.delete(orderDoc.ref));
  }

  const payload = {
    vendorName: String(vendor.name || '').trim(),
    sourceVendorId: vendor.id,
    sourceVendorOwnerUid: vendor.createdBy || currentUserUid,
    sourceVendorScope: 'shared',
    flavors,
    mealSlotIds: previous?.mealSlotIds || [],
    updatedAt: serverTimestamp(),
  };

  if (configSnapshot.exists()) {
    batch.update(configRef, payload);
  } else {
    batch.set(configRef, {
      ...payload,
      createdBy: currentUserUid,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function reconcileEmpanadaVendorLibraryAccess({
  groupId,
  config,
  vendor = null,
  currentUserUid,
  accessUserIds = [],
}) {
  if (!groupId || !config || !currentUserUid) return;

  const sharedUsers = uniqueUserIds([
    currentUserUid,
    config.sourceVendorOwnerUid,
    ...(vendor?.accessUserIds || []),
    ...accessUserIds,
  ]);

  if (!vendor?.id) {
    if (config.sourceVendorScope === 'shared') return;

    const flavors = normalizeFlavorList(config.flavors || []);
    if (flavors.length === 0) return;

    const vendorRef = doc(collection(db, 'empanadaVendors'));
    const batch = writeBatch(db);

    batch.set(vendorRef, {
      name: String(config.vendorName || '').trim(),
      flavors,
      createdBy: currentUserUid,
      accessUserIds: sharedUsers,
      ...(config.sourceVendorOwnerUid && config.sourceVendorId
        ? {
            legacyOwnerUid: config.sourceVendorOwnerUid,
            legacyVendorId: config.sourceVendorId,
          }
        : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(getConfigRef(groupId), {
      sourceVendorId: vendorRef.id,
      sourceVendorOwnerUid: currentUserUid,
      sourceVendorScope: 'shared',
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return;
  }

  const sameVendor =
    config.sourceVendorId === vendor.id ||
    (config.sourceVendorScope !== 'shared' &&
      vendor.legacyOwnerUid === config.sourceVendorOwnerUid &&
      vendor.legacyVendorId === config.sourceVendorId);

  if (!sameVendor) return;

  const missingAccess = sharedUsers.some(
    (userUid) => !(vendor.accessUserIds || []).includes(userUid),
  );
  const needsSourceMigration =
    config.sourceVendorScope !== 'shared' || config.sourceVendorId !== vendor.id;

  if (!missingAccess && !needsSourceMigration) return;

  const batch = writeBatch(db);

  if (missingAccess) {
    batch.update(doc(db, 'empanadaVendors', vendor.id), {
      accessUserIds: arrayUnion(...sharedUsers),
      updatedAt: serverTimestamp(),
    });
  }

  if (needsSourceMigration) {
    batch.update(getConfigRef(groupId), {
      sourceVendorId: vendor.id,
      sourceVendorOwnerUid: vendor.createdBy || currentUserUid,
      sourceVendorScope: 'shared',
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function saveEmpanadaMealSlots({
  groupId,
  config,
  mealSlots,
  selectedSlotIds,
  currentUserUid,
}) {
  if (!groupId || !config || !currentUserUid) throw new Error('Configuración inválida.');

  const validSlotsMap = Object.fromEntries(mealSlots.map((slot) => [slot.id, slot]));
  const cleanSlotIds = Array.from(new Set(selectedSlotIds)).filter((id) => validSlotsMap[id]);
  const previousSlotIds = config.mealSlotIds || [];

  await updateDoc(getConfigRef(groupId), {
    mealSlotIds: cleanSlotIds,
    updatedAt: serverTimestamp(),
  });

  for (const slotId of cleanSlotIds) {
    const slot = validSlotsMap[slotId];
    await setMealPlanSlot({
      groupId,
      slotId,
      date: slot.date,
      mealType: slot.mealType,
      assignmentType: 'custom',
      label: 'Empanadas',
      currentUserUid,
    });
  }

  const removedSlotIds = previousSlotIds.filter((slotId) => !cleanSlotIds.includes(slotId));
  if (removedSlotIds.length > 0) {
    const mealPlanSnapshots = await Promise.all(
      removedSlotIds.map((slotId) => getDoc(doc(db, 'groups', groupId, 'mealPlan', slotId))),
    );

    for (let index = 0; index < removedSlotIds.length; index += 1) {
      const snapshot = mealPlanSnapshots[index];
      if (
        snapshot.exists() &&
        snapshot.data().assignmentType === 'custom' &&
        snapshot.data().label === 'Empanadas'
      ) {
        await clearMealPlanSlot({ groupId, slotId: removedSlotIds[index] });
      }
    }
  }

  const ordersSnapshot = await getDocs(getOrdersRef(groupId));
  if (ordersSnapshot.empty) return;

  const allowedSlots = new Set(cleanSlotIds);
  const batch = writeBatch(db);
  ordersSnapshot.docs.forEach((orderDoc) => {
    const order = orderDoc.data();
    const allocations = Object.fromEntries(
      Object.entries(order.allocations || {}).filter(([slotId]) => allowedSlots.has(slotId)),
    );
    const consumed = Object.fromEntries(
      Object.entries(order.consumed || {}).filter(([slotId]) => allowedSlots.has(slotId)),
    );
    batch.update(orderDoc.ref, { allocations, consumed, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}

export async function saveEmpanadaOrder({
  groupId,
  memberId,
  items,
  allocations = {},
  consumed = {},
  flavorIds,
  currentUserUid,
  isFinalized,
}) {
  if (!groupId || !memberId || !currentUserUid) throw new Error('Pedido inválido.');

  const clean = validateOrderDraft({ items, allocations, consumed, flavorIds });
  const ref = getOrderRef(groupId, memberId);
  const snapshot = await getDoc(ref);
  const resolvedIsFinalized =
    typeof isFinalized === 'boolean'
      ? isFinalized
      : snapshot.exists()
        ? snapshot.data().isFinalized === true
        : false;

  const payload = {
    memberId,
    ...clean,
    isFinalized: resolvedIsFinalized,
    updatedBy: currentUserUid,
    updatedAt: serverTimestamp(),
  };

  if (snapshot.exists()) {
    await updateDoc(ref, payload);
    return;
  }

  await setDoc(ref, {
    ...payload,
    createdBy: currentUserUid,
    createdAt: serverTimestamp(),
  });
}

export async function setEmpanadaOrderFinalized({
  groupId,
  order,
  items,
  flavorIds,
  isFinalized,
  currentUserUid,
}) {
  if (!groupId || !order?.memberId || !currentUserUid) {
    throw new Error('Pedido inválido.');
  }

  return saveEmpanadaOrder({
    groupId,
    memberId: order.memberId,
    items: items ?? order.items ?? {},
    allocations: order.allocations || {},
    consumed: order.consumed || {},
    flavorIds,
    currentUserUid,
    isFinalized,
  });
}

export async function saveEmpanadaDistribution({
  groupId,
  order,
  allocations,
  flavorIds,
  currentUserUid,
}) {
  if (!order?.memberId) throw new Error('Primero guardá el pedido.');
  return saveEmpanadaOrder({
    groupId,
    memberId: order.memberId,
    items: order.items || {},
    allocations,
    consumed: order.consumed || {},
    flavorIds,
    currentUserUid,
  });
}

export async function setEmpanadaConsumedCount({
  groupId,
  order,
  slotId,
  flavorId,
  count,
  flavorIds,
  currentUserUid,
}) {
  if (!order?.memberId) throw new Error('Pedido inválido.');

  const maxCount = parseEmpanadaCount(order.allocations?.[slotId]?.[flavorId]);
  const nextCount = Math.max(0, Math.min(parseEmpanadaCount(count), maxCount));
  const consumed = {
    ...(order.consumed || {}),
    [slotId]: {
      ...(order.consumed?.[slotId] || {}),
      [flavorId]: nextCount,
    },
  };

  if (nextCount === 0) delete consumed[slotId][flavorId];
  if (Object.keys(consumed[slotId]).length === 0) delete consumed[slotId];

  return saveEmpanadaOrder({
    groupId,
    memberId: order.memberId,
    items: order.items || {},
    allocations: order.allocations || {},
    consumed,
    flavorIds,
    currentUserUid,
  });
}

export async function deleteEmpanadaOrder({ groupId, memberId }) {
  if (!groupId || !memberId) return;
  await deleteDoc(getOrderRef(groupId, memberId));
}

export function subscribeToEmpanadaConfig(groupId, callback, errorCallback) {
  if (!groupId) return () => {};
  return onSnapshot(
    getConfigRef(groupId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    errorCallback,
  );
}

export function subscribeToEmpanadaOrders(groupId, callback, errorCallback) {
  if (!groupId) return () => {};
  const ordersQuery = query(getOrdersRef(groupId), orderBy('memberId'));
  return onSnapshot(
    ordersQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    errorCallback,
  );
}
