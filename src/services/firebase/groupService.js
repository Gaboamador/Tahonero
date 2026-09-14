import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { findUserLookupByEmail, normalizeEmail } from './userService';
import { getTripMealSlots, isValidTripMealRange } from '@/utils/tripUtils';

export function getGroupsCollectionRef() {
  return collection(db, 'groups');
}

export function getGroupRef(groupId) {
  return doc(db, 'groups', groupId);
}

function uniqueIds(ids = []) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function normalizeMember(member, fallbackMemberId = '') {
  const memberId = member?.memberId || member?.uid || fallbackMemberId;
  const inferredUserUid = member?.type === 'user' ? member?.uid || fallbackMemberId : '';
  const userUid = member?.userUid || inferredUserUid;

  return {
    ...member,
    uid: memberId,
    memberId,
    userUid,
  };
}

function getMembershipState(group) {
  const members = getGroupMembers(group);
  const participantIds = uniqueIds(members.map((member) => member.memberId));
  const accessUserIds = uniqueIds([
    ...(group?.accessUserIds || []),
    group?.createdBy,
    ...members.map((member) => member.userUid),
  ]);

  return {
    participantIds,
    accessUserIds,
    legacyMemberIds: uniqueIds([
      ...(group?.memberIds || []),
      ...participantIds,
      ...accessUserIds,
    ]),
  };
}

async function appendTripLibrarySharingToBatch(batch, groupId, userUid) {
  if (!groupId || !userUid) return false;

  const [mealsSnapshot, empanadaConfigSnapshot] = await Promise.all([
    getDocs(collection(db, 'groups', groupId, 'meals')),
    getDoc(doc(db, 'groups', groupId, 'empanadaConfig', 'main')),
  ]);

  let hasWrites = false;
  const sharedRecipeIds = new Set();
  mealsSnapshot.docs.forEach((mealDoc) => {
    const meal = mealDoc.data();
    if (meal.sourceRecipeScope === 'shared' && meal.sourceRecipeId) {
      sharedRecipeIds.add(meal.sourceRecipeId);
    }
  });

  sharedRecipeIds.forEach((recipeId) => {
    batch.update(doc(db, 'recipes', recipeId), {
      accessUserIds: arrayUnion(userUid),
      updatedAt: serverTimestamp(),
    });
    hasWrites = true;
  });

  if (empanadaConfigSnapshot.exists()) {
    const config = empanadaConfigSnapshot.data();
    if (config.sourceVendorScope === 'shared' && config.sourceVendorId) {
      batch.update(doc(db, 'empanadaVendors', config.sourceVendorId), {
        accessUserIds: arrayUnion(userUid),
        updatedAt: serverTimestamp(),
      });
      hasWrites = true;
    }
  }

  return hasWrites;
}

export function buildMemberFromUser(userProfile, role = 'member') {
  return {
    uid: userProfile.uid,
    memberId: userProfile.uid,
    userUid: userProfile.uid,
    displayName: userProfile.displayName || userProfile.email || 'Usuario',
    email: normalizeEmail(userProfile.email || ''),
    photoURL: userProfile.photoURL || '',
    role,
    type: 'user',
    joinedAt: new Date().toISOString(),
  };
}

export function buildMemberFromLookup(userLookup, role = 'member') {
  return {
    uid: userLookup.uid,
    memberId: userLookup.uid,
    userUid: userLookup.uid,
    displayName: userLookup.displayName || userLookup.email || 'Usuario',
    email: normalizeEmail(userLookup.email || ''),
    photoURL: userLookup.photoURL || '',
    role,
    type: 'user',
    joinedAt: new Date().toISOString(),
  };
}

export function buildManualMember({ name, email = '' }) {
  const cleanName = name.trim();
  const cleanEmail = normalizeEmail(email);

  if (!cleanName) {
    throw new Error('El nombre del miembro es obligatorio.');
  }

  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? `manual_${crypto.randomUUID()}`
      : `manual_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  return {
    uid: id,
    memberId: id,
    userUid: '',
    displayName: cleanName,
    email: cleanEmail,
    photoURL: '',
    role: 'member',
    type: 'manual',
    joinedAt: new Date().toISOString(),
  };
}

export async function createGroup({
  name,
  description = '',
  startDate,
  endDate,
  firstMeal = 'lunch',
  lastMeal = 'dinner',
  userProfile,
}) {
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  if (!trimmedName) {
    throw new Error('El nombre del viaje es obligatorio.');
  }

  if (
    !startDate ||
    !endDate ||
    !isValidTripMealRange(startDate, endDate, firstMeal, lastMeal)
  ) {
    throw new Error('Elegí fechas y límites de comidas válidos para el viaje.');
  }

  if (!userProfile?.uid) {
    throw new Error('No hay usuario autenticado.');
  }

  const ownerMember = buildMemberFromUser(userProfile, 'owner');

  const groupPayload = {
    entityType: 'trip',
    schemaVersion: 4,
    name: trimmedName,
    description: trimmedDescription,
    startDate,
    endDate,
    firstMeal,
    lastMeal,
    createdBy: userProfile.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    memberIds: [userProfile.uid],
    participantIds: [userProfile.uid],
    accessUserIds: [userProfile.uid],
    membersMap: {
      [userProfile.uid]: ownerMember,
    },
  };

  const docRef = await addDoc(getGroupsCollectionRef(), groupPayload);

  return {
    id: docRef.id,
    ...groupPayload,
  };
}

export async function updateGroupDetails({
  groupId,
  name,
  description = '',
  startDate = '',
  endDate = '',
  firstMeal = 'lunch',
  lastMeal = 'dinner',
}) {
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const hasAnyDate = Boolean(startDate || endDate);

  if (!groupId) {
    throw new Error('Viaje inválido.');
  }

  if (!trimmedName) {
    throw new Error('El nombre del viaje es obligatorio.');
  }

  if (
    hasAnyDate &&
    (!startDate ||
      !endDate ||
      !isValidTripMealRange(startDate, endDate, firstMeal, lastMeal))
  ) {
    throw new Error('Completá las fechas y los límites de comidas con valores válidos.');
  }

  const groupUpdate = {
    entityType: 'trip',
    schemaVersion: 4,
    name: trimmedName,
    description: trimmedDescription,
    startDate: hasAnyDate ? startDate : deleteField(),
    endDate: hasAnyDate ? endDate : deleteField(),
    firstMeal: hasAnyDate ? firstMeal : deleteField(),
    lastMeal: hasAnyDate ? lastMeal : deleteField(),
    updatedAt: serverTimestamp(),
  };

  if (!hasAnyDate) {
    await updateDoc(getGroupRef(groupId), groupUpdate);
    return;
  }

  const validSlotIds = new Set(
    getTripMealSlots({ startDate, endDate, firstMeal, lastMeal }).map((slot) => slot.id),
  );
  const mealPlanSnapshot = await getDocs(collection(db, 'groups', groupId, 'mealPlan'));
  const batch = writeBatch(db);

  batch.update(getGroupRef(groupId), groupUpdate);

  mealPlanSnapshot.docs.forEach((planDoc) => {
    if (!validSlotIds.has(planDoc.id)) {
      batch.delete(planDoc.ref);
    }
  });

  await batch.commit();
}

export async function deleteEmptyGroup({ group, expenses = [] }) {
  if (!group?.id) {
    throw new Error('Viaje inválido.');
  }

  if (expenses.length > 0) {
    throw new Error('No se puede borrar un viaje que ya tiene movimientos.');
  }

  const foodCollectionNames = ['meals', 'mealPlan', 'foodExtras', 'drinkPlans', 'empanadaConfig', 'empanadaOrders'];
  const foodSnapshots = await Promise.all(
    foodCollectionNames.map((collectionName) =>
      getDocs(query(collection(db, 'groups', group.id, collectionName), limit(1))),
    ),
  );

  if (foodSnapshots.some((snapshot) => !snapshot.empty)) {
    throw new Error(
      'No se puede borrar el viaje porque tiene comidas, extras, bebidas o datos de empanadas cargados.',
    );
  }

  const shouldDelete = window.confirm(
    `¿Borrar el viaje "${group.name}"? Esta acción no se puede deshacer.`,
  );

  if (!shouldDelete) {
    return false;
  }

  // shoppingState is derived/disposable. If source food data is already empty,
  // clean any stale checked-state documents before deleting the trip.
  const shoppingStateSnapshot = await getDocs(
    collection(db, 'groups', group.id, 'shoppingState'),
  );

  await Promise.all(shoppingStateSnapshot.docs.map((stateDoc) => deleteDoc(stateDoc.ref)));
  await deleteDoc(getGroupRef(group.id));
  return true;
}

export async function addManualMemberToGroup({ group, groupId, name, email = '' }) {
  const resolvedGroupId = group?.id || groupId;

  if (!resolvedGroupId) {
    throw new Error('Viaje inválido.');
  }

  const member = buildManualMember({ name, email });
  const groupRef = getGroupRef(resolvedGroupId);
  const membershipState = group ? getMembershipState(group) : null;

  const update = {
    [`membersMap.${member.uid}`]: member,
    memberIds: arrayUnion(member.uid),
    updatedAt: serverTimestamp(),
  };

  if (membershipState) {
    update.schemaVersion = 4;
    update.participantIds = uniqueIds([...membershipState.participantIds, member.memberId]);
    update.accessUserIds = membershipState.accessUserIds;
    update.memberIds = uniqueIds([...membershipState.legacyMemberIds, member.memberId]);
  }

  await updateDoc(groupRef, update);

  return member;
}

export async function addRegisteredUserToGroup({ group, email }) {
  if (!group?.id) {
    throw new Error('Viaje inválido.');
  }

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('El email es obligatorio.');
  }

  const userLookup = await findUserLookupByEmail(normalizedEmail);

  if (!userLookup?.uid) {
    throw new Error('No encontramos un usuario registrado con ese email.');
  }

  if (getGroupMemberByUserUid(group, userLookup.uid)) {
    throw new Error('Ese usuario ya participa del viaje.');
  }

  const alreadyExistsByEmail = Object.values(group.membersMap || {}).some(
    (member) => normalizeEmail(member.email) === normalizedEmail,
  );

  if (alreadyExistsByEmail) {
    throw new Error('Ya existe un participante del viaje con ese email.');
  }

  const member = buildMemberFromLookup(userLookup, 'member');
  const membershipState = getMembershipState(group);

  await updateDoc(getGroupRef(group.id), {
    [`membersMap.${member.uid}`]: member,
    schemaVersion: 4,
    participantIds: uniqueIds([...membershipState.participantIds, member.memberId]),
    accessUserIds: uniqueIds([...membershipState.accessUserIds, member.userUid]),
    memberIds: uniqueIds([
      ...membershipState.legacyMemberIds,
      member.memberId,
      member.userUid,
    ]),
    updatedAt: serverTimestamp(),
  });

  try {
    const sharingBatch = writeBatch(db);
    const hasSharingWrites = await appendTripLibrarySharingToBatch(
      sharingBatch,
      group.id,
      member.userUid,
    );
    if (hasSharingWrites) await sharingBatch.commit();
  } catch (error) {
    console.warn('El participante fue agregado, pero algún recurso compartido se sincronizará al volver a abrir su módulo:', error);
  }

  return member;
}

export async function linkManualMemberToRegisteredUser({ group, manualMemberId, email }) {
  if (!group?.id) {
    throw new Error('Viaje inválido.');
  }

  if (!manualMemberId) {
    throw new Error('Miembro inválido.');
  }

  const storedManualMember = group.membersMap?.[manualMemberId];

  if (!storedManualMember) {
    throw new Error('El miembro manual no existe.');
  }

  const manualMember = normalizeMember(storedManualMember, manualMemberId);

  if (manualMember.type !== 'manual') {
    throw new Error('Sólo se pueden vincular miembros manuales.');
  }

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('El email es obligatorio.');
  }

  const userLookup = await findUserLookupByEmail(normalizedEmail);

  if (!userLookup?.uid) {
    throw new Error('No encontramos un usuario registrado con ese email.');
  }

  const existingMemberForUser = getGroupMemberByUserUid(group, userLookup.uid);

  if (existingMemberForUser && existingMemberForUser.memberId !== manualMemberId) {
    throw new Error('Ese usuario ya participa del viaje.');
  }

  const alreadyExistsByEmail = Object.entries(group.membersMap || {}).some(
    ([memberId, member]) =>
      memberId !== manualMemberId && normalizeEmail(member.email) === normalizedEmail,
  );

  if (alreadyExistsByEmail) {
    throw new Error('Ya existe otro participante del viaje con ese email.');
  }

  const linkedMember = {
    ...manualMember,
    uid: manualMemberId,
    memberId: manualMemberId,
    userUid: userLookup.uid,
    displayName: userLookup.displayName || manualMember.displayName || userLookup.email || 'Usuario',
    email: normalizeEmail(userLookup.email || normalizedEmail),
    photoURL: userLookup.photoURL || manualMember.photoURL || '',
    role: manualMember.role || 'member',
    type: 'user',
    linkedFromManualMemberId: manualMemberId,
    linkedFromManualMemberName: manualMember.displayName || '',
    linkedAt: new Date().toISOString(),
  };

  const membershipState = getMembershipState(group);

  await updateDoc(getGroupRef(group.id), {
    [`membersMap.${manualMemberId}`]: linkedMember,
    schemaVersion: 4,
    participantIds: membershipState.participantIds,
    accessUserIds: uniqueIds([...membershipState.accessUserIds, userLookup.uid]),
    memberIds: uniqueIds([...membershipState.legacyMemberIds, userLookup.uid]),
    updatedAt: serverTimestamp(),
  });

  try {
    const sharingBatch = writeBatch(db);
    const hasSharingWrites = await appendTripLibrarySharingToBatch(
      sharingBatch,
      group.id,
      userLookup.uid,
    );
    if (hasSharingWrites) await sharingBatch.commit();
  } catch (error) {
    console.warn('El participante fue vinculado, pero algún recurso compartido se sincronizará al volver a abrir su módulo:', error);
  }

  return linkedMember;
}

export async function removeManualMemberFromGroup({ group, memberId, expenses = [] }) {
  if (!group?.id || !memberId) {
    throw new Error('Viaje o participante inválido.');
  }

  const member = group.membersMap?.[memberId];

  if (!member) {
    throw new Error('El miembro no existe.');
  }

  if (member.role === 'owner') {
    throw new Error('No se puede eliminar al administrador del viaje.');
  }

  if (member.type !== 'manual') {
    throw new Error('Por ahora sólo se pueden eliminar miembros manuales.');
  }

  const isUsedInExpenses = expenses.some((expense) => {
    const isPayer = expense.paidBy === memberId;
    const isParticipant = expense.participantIds?.includes(memberId);
    const hasShare = Boolean(expense.sharesMap?.[memberId]);
    const isPaymentFrom = expense.fromId === memberId;
    const isPaymentTo = expense.toId === memberId;

    return isPayer || isParticipant || hasShare || isPaymentFrom || isPaymentTo;
  });

  if (isUsedInExpenses) {
    throw new Error(
      'No se puede eliminar este miembro porque ya participa en uno o más movimientos. Primero editá o borrá esos movimientos.',
    );
  }

  const drinkUsageQuery = query(
    collection(db, 'groups', group.id, 'drinkPlans'),
    where('participantIds', 'array-contains', memberId),
    limit(1),
  );
  const drinkUsageSnapshot = await getDocs(drinkUsageQuery);

  if (!drinkUsageSnapshot.empty) {
    throw new Error(
      'No se puede eliminar este participante porque está incluido en un cálculo de bebidas. Editá esa bebida primero.',
    );
  }

  const empanadaOrderQuery = query(
    collection(db, 'groups', group.id, 'empanadaOrders'),
    where('memberId', '==', memberId),
    limit(1),
  );
  const empanadaOrderSnapshot = await getDocs(empanadaOrderQuery);

  if (!empanadaOrderSnapshot.empty) {
    throw new Error(
      'No se puede eliminar este participante porque tiene un pedido de empanadas cargado. Eliminá ese pedido primero.',
    );
  }

  await updateDoc(getGroupRef(group.id), {
    [`membersMap.${memberId}`]: deleteField(),
    memberIds: arrayRemove(memberId),
    participantIds: arrayRemove(memberId),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToUserGroups(uid, callback, errorCallback) {
  if (!uid) {
    return () => {};
  }

  // `memberIds` remains the compatibility field used by the current query/rules.
  // New documents also keep `participantIds` and `accessUserIds` separated.
  const groupsQuery = query(
    getGroupsCollectionRef(),
    where('memberIds', 'array-contains', uid),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    groupsQuery,
    (snapshot) => {
      const groups = snapshot.docs.map((groupDoc) => ({
        id: groupDoc.id,
        ...groupDoc.data(),
      }));

      callback(groups);
    },
    errorCallback,
  );
}

export function subscribeToGroup(groupId, callback, errorCallback) {
  if (!groupId) {
    return () => {};
  }

  return onSnapshot(
    getGroupRef(groupId),
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      callback({
        id: snapshot.id,
        ...snapshot.data(),
      });
    },
    errorCallback,
  );
}

export function getGroupMembers(group) {
  if (!group?.membersMap) {
    return [];
  }

  return Object.entries(group.membersMap)
    .map(([memberId, member]) => normalizeMember(member, memberId))
    .sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (a.role !== 'owner' && b.role === 'owner') return 1;

      return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '');
    });
}

export function getGroupMemberByUserUid(group, userUid) {
  if (!group || !userUid) {
    return null;
  }

  return getGroupMembers(group).find((member) => member.userUid === userUid) || null;
}

export function isUserGroupMember(group, uid) {
  if (!group || !uid) {
    return false;
  }

  return (
    group.accessUserIds?.includes(uid) ||
    Boolean(getGroupMemberByUserUid(group, uid)) ||
    group.memberIds?.includes(uid)
  );
}

export function isGroupOwner(group, uid) {
  if (!group || !uid) {
    return false;
  }

  return group.createdBy === uid || getGroupMemberByUserUid(group, uid)?.role === 'owner';
}