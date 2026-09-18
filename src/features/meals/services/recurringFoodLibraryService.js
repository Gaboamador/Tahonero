import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/services/firebase/firebaseConfig';
import {
  DRINK_CALCULATION_MODES,
  DRINK_COVERAGE_MODES,
  EXTRA_MODES,
  FOOD_UNIT_VALUES,
} from '@/features/meals/constants/mealConstants';
import {
  isBlankIngredient,
  normalizeIngredients,
} from '@/features/meals/services/mealValidation';
import { parseFoodQuantity } from '@/features/meals/utils/mealUtils';
import { uniqueUserIds } from '@/utils/sharedLibraryUtils';

export const RECURRING_ITEM_KINDS = {
  extra: 'extra',
  drink: 'drink',
};

export function getRecurringFoodItemsCollectionRef() {
  return collection(db, 'recurringFoodItems');
}

export function getRecurringFoodPresetsCollectionRef() {
  return collection(db, 'recurringFoodPresets');
}

function getRecurringFoodItemRef(itemId) {
  return doc(db, 'recurringFoodItems', itemId);
}

function getRecurringFoodPresetRef(presetId) {
  return doc(db, 'recurringFoodPresets', presetId);
}

function getTripSubdocumentRef(groupId, collectionName, documentId) {
  return doc(db, 'groups', groupId, collectionName, documentId);
}

function getTripSubcollectionRef(groupId, collectionName) {
  return collection(db, 'groups', groupId, collectionName);
}

function validateUserUid(userUid) {
  if (!userUid) {
    throw new Error('Usuario inválido.');
  }
}

function validateGroupId(groupId) {
  if (!groupId) {
    throw new Error('Viaje inválido.');
  }
}

function validateExtraTemplate({ name, mode, quantity, unit, purchasePlace, ingredients }) {
  const cleanName = String(name || '').trim();

  if (!cleanName) {
    throw new Error('El nombre del extra es obligatorio.');
  }

  if (!Object.values(EXTRA_MODES).includes(mode)) {
    throw new Error('Tipo de extra inválido.');
  }

  if (mode === EXTRA_MODES.direct) {
    const parsedQuantity = parseFoodQuantity(quantity);

    if (parsedQuantity <= 0 || !FOOD_UNIT_VALUES.includes(unit)) {
      throw new Error('Indicá una cantidad y unidad válidas.');
    }

    return {
      kind: RECURRING_ITEM_KINDS.extra,
      name: cleanName,
      mode,
      quantity: parsedQuantity,
      unit,
      purchasePlace: String(purchasePlace || '').trim(),
      ingredients: [],
    };
  }

  const meaningfulIngredients = (ingredients || []).filter(
    (ingredient) => !isBlankIngredient(ingredient),
  );
  const cleanIngredients = normalizeIngredients(ingredients);

  if (meaningfulIngredients.length !== cleanIngredients.length) {
    throw new Error('Revisá los ingredientes del extra.');
  }

  return {
    kind: RECURRING_ITEM_KINDS.extra,
    name: cleanName,
    mode,
    quantity: 0,
    unit: '',
    purchasePlace: '',
    ingredients: cleanIngredients,
  };
}

function validateDrinkTemplate({
  name,
  calculationMode,
  quantity,
  unit,
  purchasePlace,
  coverageMode,
  coverageDays,
}) {
  const cleanName = String(name || '').trim();
  const parsedQuantity = parseFoodQuantity(quantity);

  if (!cleanName) {
    throw new Error('El nombre de la bebida es obligatorio.');
  }

  if (!Object.values(DRINK_CALCULATION_MODES).includes(calculationMode)) {
    throw new Error('Tipo de cálculo de bebida inválido.');
  }

  if (parsedQuantity <= 0 || !FOOD_UNIT_VALUES.includes(unit)) {
    throw new Error('Indicá una cantidad y unidad válidas.');
  }

  if (calculationMode === DRINK_CALCULATION_MODES.fixed) {
    return {
      kind: RECURRING_ITEM_KINDS.drink,
      name: cleanName,
      calculationMode,
      quantity: parsedQuantity,
      unit,
      purchasePlace: String(purchasePlace || '').trim(),
      coverageMode: DRINK_COVERAGE_MODES.trip,
      coverageDays: 0,
    };
  }

  if (!Object.values(DRINK_COVERAGE_MODES).includes(coverageMode)) {
    throw new Error('Cobertura de bebida inválida.');
  }

  const parsedCoverageDays = coverageMode === DRINK_COVERAGE_MODES.custom
    ? Number(coverageDays)
    : 0;

  if (
    coverageMode === DRINK_COVERAGE_MODES.custom
    && (!Number.isInteger(parsedCoverageDays) || parsedCoverageDays <= 0)
  ) {
    throw new Error('Indicá una cantidad válida de días de consumo.');
  }

  return {
    kind: RECURRING_ITEM_KINDS.drink,
    name: cleanName,
    calculationMode,
    quantity: parsedQuantity,
    unit,
    purchasePlace: String(purchasePlace || '').trim(),
    coverageMode,
    coverageDays: parsedCoverageDays,
  };
}

function validateRecurringItemPayload(kind, payload) {
  if (kind === RECURRING_ITEM_KINDS.extra) {
    return validateExtraTemplate(payload);
  }

  if (kind === RECURRING_ITEM_KINDS.drink) {
    return validateDrinkTemplate(payload);
  }

  throw new Error('Tipo de recurrente inválido.');
}

function validatePresetPayload({ name, itemIds }) {
  const cleanName = String(name || '').trim();
  const cleanItemIds = Array.from(new Set((itemIds || []).filter(Boolean)));

  if (!cleanName) {
    throw new Error('El nombre del habitual es obligatorio.');
  }

  if (cleanItemIds.length === 0) {
    throw new Error('Elegí al menos un extra o una bebida.');
  }

  if (cleanItemIds.length > 100) {
    throw new Error('Un habitual puede contener hasta 100 elementos.');
  }

  return {
    name: cleanName,
    itemIds: cleanItemIds,
  };
}

function buildTripSnapshot(item, participantIds = []) {
  if (item.kind === RECURRING_ITEM_KINDS.extra) {
    const cleanPayload = validateExtraTemplate(item);

    return {
      collectionName: 'foodExtras',
      payload: {
        name: cleanPayload.name,
        mode: cleanPayload.mode,
        quantity: cleanPayload.quantity,
        unit: cleanPayload.unit,
        purchasePlace: cleanPayload.purchasePlace,
        ingredients: cleanPayload.ingredients,
        sourceRecurringItemId: item.id,
      },
    };
  }

  if (item.kind === RECURRING_ITEM_KINDS.drink) {
    const cleanPayload = validateDrinkTemplate(item);
    const cleanParticipantIds = cleanPayload.calculationMode === DRINK_CALCULATION_MODES.perPersonPerDay
      ? uniqueUserIds(participantIds)
      : [];

    if (
      cleanPayload.calculationMode === DRINK_CALCULATION_MODES.perPersonPerDay
      && cleanParticipantIds.length === 0
    ) {
      throw new Error(`No hay participantes para calcular "${cleanPayload.name}".`);
    }

    return {
      collectionName: 'drinkPlans',
      payload: {
        name: cleanPayload.name,
        calculationMode: cleanPayload.calculationMode,
        quantity: cleanPayload.quantity,
        unit: cleanPayload.unit,
        purchasePlace: cleanPayload.purchasePlace,
        participantIds: cleanParticipantIds,
        coverageMode: cleanPayload.coverageMode,
        coverageDays: cleanPayload.coverageDays,
        sourceRecurringItemId: item.id,
      },
    };
  }

  throw new Error('Tipo de recurrente inválido.');
}

function addRecurringItemImportToBatch({
  batch,
  groupId,
  item,
  createdBy,
  accessUserIds,
  participantIds,
}) {
  if (!item?.id) {
    throw new Error('Elemento recurrente inválido.');
  }

  const sharedUsers = uniqueUserIds([createdBy, ...(item.accessUserIds || []), ...accessUserIds]);
  const snapshot = buildTripSnapshot(item, participantIds);
  const tripRef = doc(getTripSubcollectionRef(groupId, snapshot.collectionName));

  batch.update(getRecurringFoodItemRef(item.id), {
    accessUserIds: arrayUnion(...sharedUsers),
    updatedAt: serverTimestamp(),
  });
  batch.set(tripRef, {
    ...snapshot.payload,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    itemId: item.id,
    tripDocumentId: tripRef.id,
    kind: item.kind,
  };
}

export async function createRecurringFoodItem({
  userUid,
  kind,
  accessUserIds = [],
  ...payload
}) {
  validateUserUid(userUid);
  const cleanPayload = validateRecurringItemPayload(kind, payload);
  const documentPayload = {
    ...cleanPayload,
    createdBy: userUid,
    accessUserIds: uniqueUserIds([userUid, ...accessUserIds]),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(getRecurringFoodItemsCollectionRef(), documentPayload);
  return { id: docRef.id, ...documentPayload };
}

export async function updateRecurringFoodItem({ itemId, kind, ...payload }) {
  if (!itemId) {
    throw new Error('Elemento recurrente inválido.');
  }

  const cleanPayload = validateRecurringItemPayload(kind, payload);

  await updateDoc(getRecurringFoodItemRef(itemId), {
    ...cleanPayload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRecurringFoodItem({ userUid, item }) {
  validateUserUid(userUid);

  if (!item?.id) {
    throw new Error('Elemento recurrente inválido.');
  }

  const accessUserIds = uniqueUserIds(item.accessUserIds || []);
  if (item.createdBy !== userUid || accessUserIds.length > 1) {
    throw new Error('No se puede borrar un elemento compartido con otras personas.');
  }

  const presetsSnapshot = await getDocs(
    query(
      getRecurringFoodPresetsCollectionRef(),
      where('accessUserIds', 'array-contains', userUid),
    ),
  );
  const affectedPresets = presetsSnapshot.docs.filter((presetDoc) =>
    (presetDoc.data().itemIds || []).includes(item.id),
  );
  const wouldEmptyPreset = affectedPresets.find(
    (presetDoc) => (presetDoc.data().itemIds || []).length <= 1,
  );

  if (wouldEmptyPreset) {
    throw new Error('Este recurrente es el único elemento de un Habitual. Editá o borrá ese Habitual primero.');
  }

  const batch = writeBatch(db);

  affectedPresets.forEach((presetDoc) => {
    const presetData = presetDoc.data();
    const nextItemIds = (presetData.itemIds || []).filter((itemId) => itemId !== item.id);

    batch.update(presetDoc.ref, {
      itemIds: nextItemIds,
      updatedAt: serverTimestamp(),
    });
  });

  batch.delete(getRecurringFoodItemRef(item.id));
  await batch.commit();
}

export async function createRecurringFoodPreset({
  userUid,
  name,
  itemIds,
  accessUserIds = [],
}) {
  validateUserUid(userUid);
  const cleanPayload = validatePresetPayload({ name, itemIds });
  const payload = {
    ...cleanPayload,
    createdBy: userUid,
    accessUserIds: uniqueUserIds([userUid, ...accessUserIds]),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(getRecurringFoodPresetsCollectionRef(), payload);
  return { id: docRef.id, ...payload };
}

export async function updateRecurringFoodPreset({ presetId, name, itemIds }) {
  if (!presetId) {
    throw new Error('Habitual inválido.');
  }

  const cleanPayload = validatePresetPayload({ name, itemIds });
  await updateDoc(getRecurringFoodPresetRef(presetId), {
    ...cleanPayload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRecurringFoodPreset({ userUid, preset }) {
  validateUserUid(userUid);

  if (!preset?.id) {
    throw new Error('Habitual inválido.');
  }

  const accessUserIds = uniqueUserIds(preset.accessUserIds || []);
  if (preset.createdBy !== userUid || accessUserIds.length > 1) {
    throw new Error('No se puede borrar un habitual compartido con otras personas.');
  }

  await deleteDoc(getRecurringFoodPresetRef(preset.id));
}

export async function importRecurringFoodItemToTrip({
  groupId,
  item,
  createdBy,
  accessUserIds = [],
  participantIds = [],
}) {
  validateGroupId(groupId);
  validateUserUid(createdBy);
  const batch = writeBatch(db);
  const imported = addRecurringItemImportToBatch({
    batch,
    groupId,
    item,
    createdBy,
    accessUserIds,
    participantIds,
  });

  await batch.commit();
  return imported;
}

export async function importRecurringFoodPresetToTrip({
  groupId,
  preset,
  items,
  createdBy,
  accessUserIds = [],
  participantIds = [],
}) {
  validateGroupId(groupId);
  validateUserUid(createdBy);

  if (!preset?.id) {
    throw new Error('Habitual inválido.');
  }

  const allowedItemIds = new Set(preset.itemIds || []);
  const uniqueItems = Array.from(
    new Map(
      (items || [])
        .filter((item) => item?.id && allowedItemIds.has(item.id))
        .map((item) => [item.id, item]),
    ).values(),
  );
  const sharedUsers = uniqueUserIds([createdBy, ...(preset.accessUserIds || []), ...accessUserIds]);
  const batch = writeBatch(db);

  batch.update(getRecurringFoodPresetRef(preset.id), {
    accessUserIds: arrayUnion(...sharedUsers),
    updatedAt: serverTimestamp(),
  });

  const imported = uniqueItems.map((item) =>
    addRecurringItemImportToBatch({
      batch,
      groupId,
      item,
      createdBy,
      accessUserIds,
      participantIds,
    }),
  );

  await batch.commit();
  return imported;
}

export async function saveTripRecurringItemToLibrary({
  groupId,
  kind,
  tripItem,
  currentUserUid,
  accessUserIds = [],
}) {
  validateGroupId(groupId);
  validateUserUid(currentUserUid);

  if (!tripItem?.id) {
    throw new Error('Elemento del viaje inválido.');
  }

  if (tripItem.sourceRecurringItemId) {
    throw new Error('Este elemento ya está vinculado a la biblioteca de recurrentes.');
  }

  const cleanPayload = validateRecurringItemPayload(kind, tripItem);
  const itemRef = doc(getRecurringFoodItemsCollectionRef());
  const tripCollectionName = kind === RECURRING_ITEM_KINDS.extra ? 'foodExtras' : 'drinkPlans';
  const batch = writeBatch(db);

  batch.set(itemRef, {
    ...cleanPayload,
    createdBy: currentUserUid,
    accessUserIds: uniqueUserIds([currentUserUid, ...accessUserIds]),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(getTripSubdocumentRef(groupId, tripCollectionName, tripItem.id), {
    sourceRecurringItemId: itemRef.id,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return itemRef.id;
}

export async function updateRecurringItemFromTrip({
  kind,
  tripItem,
  currentUserUid,
  accessUserIds = [],
}) {
  validateUserUid(currentUserUid);

  if (!tripItem?.sourceRecurringItemId) {
    throw new Error('Este elemento no está vinculado a una plantilla recurrente.');
  }

  const cleanPayload = validateRecurringItemPayload(kind, tripItem);
  const sharedUsers = uniqueUserIds([currentUserUid, ...accessUserIds]);

  await updateDoc(getRecurringFoodItemRef(tripItem.sourceRecurringItemId), {
    ...cleanPayload,
    accessUserIds: arrayUnion(...sharedUsers),
    updatedAt: serverTimestamp(),
  });
}

export async function reconcileTripRecurringLibraryAccess({
  foodExtras = [],
  drinkPlans = [],
  libraryItems = [],
  currentUserUid,
  accessUserIds = [],
}) {
  if (!currentUserUid) return;

  const sourceIds = new Set(
    [...foodExtras, ...drinkPlans]
      .map((item) => item.sourceRecurringItemId)
      .filter(Boolean),
  );

  if (sourceIds.size === 0) return;

  const sharedUsers = uniqueUserIds([currentUserUid, ...accessUserIds]);
  const itemsById = new Map(libraryItems.map((item) => [item.id, item]));
  const batch = writeBatch(db);
  let hasWrites = false;

  sourceIds.forEach((itemId) => {
    const item = itemsById.get(itemId);
    if (!item) return;

    const missingAccess = sharedUsers.some(
      (userUid) => !(item.accessUserIds || []).includes(userUid),
    );

    if (!missingAccess) return;

    batch.update(getRecurringFoodItemRef(itemId), {
      accessUserIds: arrayUnion(...sharedUsers),
      updatedAt: serverTimestamp(),
    });
    hasWrites = true;
  });

  if (hasWrites) {
    await batch.commit();
  }
}

export function subscribeToRecurringFoodItems(userUid, callback, errorCallback) {
  if (!userUid) return () => {};

  const itemsQuery = query(
    getRecurringFoodItemsCollectionRef(),
    where('accessUserIds', 'array-contains', userUid),
  );

  return onSnapshot(
    itemsQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es-AR'));
      callback(items);
    },
    errorCallback,
  );
}

export function subscribeToRecurringFoodPresets(userUid, callback, errorCallback) {
  if (!userUid) return () => {};

  const presetsQuery = query(
    getRecurringFoodPresetsCollectionRef(),
    where('accessUserIds', 'array-contains', userUid),
  );

  return onSnapshot(
    presetsQuery,
    (snapshot) => {
      const presets = snapshot.docs
        .map((presetDoc) => ({ id: presetDoc.id, ...presetDoc.data() }))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es-AR'));
      callback(presets);
    },
    errorCallback,
  );
}
