import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/services/firebase/firebaseConfig';
import { FOOD_UNIT_VALUES } from '@/features/meals/constants/mealConstants';
import { createLocalId, parseFoodQuantity } from '@/features/meals/utils/mealUtils';

function getTripSubcollectionRef(groupId, collectionName) {
  return collection(db, 'groups', groupId, collectionName);
}

function getTripSubdocumentRef(groupId, collectionName, documentId) {
  return doc(db, 'groups', groupId, collectionName, documentId);
}

export function getMealsCollectionRef(groupId) {
  return getTripSubcollectionRef(groupId, 'meals');
}

export function getMealPlanCollectionRef(groupId) {
  return getTripSubcollectionRef(groupId, 'mealPlan');
}

export function getFoodExtrasCollectionRef(groupId) {
  return getTripSubcollectionRef(groupId, 'foodExtras');
}

export function getDrinkPlansCollectionRef(groupId) {
  return getTripSubcollectionRef(groupId, 'drinkPlans');
}

export function normalizeIngredient(ingredient) {
  const name = String(ingredient?.name || '').trim();
  const quantity = parseFoodQuantity(ingredient?.quantity);
  const unit = String(ingredient?.unit || '').trim();
  const purchasePlace = String(ingredient?.purchasePlace || '').trim();

  if (!name || quantity <= 0 || !FOOD_UNIT_VALUES.includes(unit)) {
    return null;
  }

  return {
    id: ingredient?.id || createLocalId('ingredient'),
    name,
    quantity,
    unit,
    purchasePlace,
  };
}

function normalizeIngredients(ingredients = []) {
  return ingredients.map(normalizeIngredient).filter(Boolean);
}

function validateGroupId(groupId) {
  if (!groupId) {
    throw new Error('Viaje inválido.');
  }
}

export function validateMealPayload({ name, servings, ingredients }) {
  const cleanName = String(name || '').trim();
  const parsedServings = Number(servings);
  const cleanIngredients = normalizeIngredients(ingredients);

  if (!cleanName) {
    throw new Error('El nombre de la comida es obligatorio.');
  }

  if (!Number.isInteger(parsedServings) || parsedServings <= 0) {
    throw new Error('Indicá para cuántas personas rinde la comida.');
  }

  if ((ingredients || []).length !== cleanIngredients.length) {
    throw new Error('Revisá los ingredientes: todos necesitan nombre, cantidad y unidad.');
  }

  return {
    name: cleanName,
    servings: parsedServings,
    ingredients: cleanIngredients,
  };
}

export async function createMeal({
  groupId,
  name,
  servings,
  ingredients = [],
  createdBy,
  sourceRecipeId = '',
  sourceRecipeOwnerUid = '',
}) {
  validateGroupId(groupId);

  const cleanPayload = validateMealPayload({ name, servings, ingredients });
  const payload = {
    ...cleanPayload,
    ...(sourceRecipeId && sourceRecipeOwnerUid
      ? { sourceRecipeId, sourceRecipeOwnerUid }
      : {}),
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(getMealsCollectionRef(groupId), payload);
  return { id: docRef.id, ...payload };
}


export async function createMealAndLibraryRecipe({
  groupId,
  name,
  servings,
  ingredients = [],
  createdBy,
}) {
  validateGroupId(groupId);

  if (!createdBy) {
    throw new Error('Usuario inválido.');
  }

  const cleanPayload = validateMealPayload({ name, servings, ingredients });
  const recipeRef = doc(collection(db, 'users', createdBy, 'recipes'));
  const mealRef = doc(getMealsCollectionRef(groupId));
  const batch = writeBatch(db);

  batch.set(recipeRef, {
    ...cleanPayload,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(mealRef, {
    ...cleanPayload,
    sourceRecipeId: recipeRef.id,
    sourceRecipeOwnerUid: createdBy,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  return {
    recipeId: recipeRef.id,
    mealId: mealRef.id,
  };
}


export async function saveTripMealToLibrary({ groupId, meal, currentUserUid }) {
  validateGroupId(groupId);

  if (!meal?.id || !currentUserUid) {
    throw new Error('Comida o usuario inválido.');
  }

  if (meal.sourceRecipeId) {
    throw new Error('Esta comida ya está vinculada a una receta de biblioteca.');
  }

  const cleanPayload = validateMealPayload({
    name: meal.name,
    servings: meal.servings,
    ingredients: meal.ingredients || [],
  });
  const recipeRef = doc(collection(db, 'users', currentUserUid, 'recipes'));
  const mealRef = getTripSubdocumentRef(groupId, 'meals', meal.id);
  const batch = writeBatch(db);

  batch.set(recipeRef, {
    ...cleanPayload,
    createdBy: currentUserUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(mealRef, {
    sourceRecipeId: recipeRef.id,
    sourceRecipeOwnerUid: currentUserUid,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  return recipeRef.id;
}

export async function updateMeal({ groupId, mealId, name, servings, ingredients = [] }) {
  validateGroupId(groupId);

  if (!mealId) {
    throw new Error('Comida inválida.');
  }

  const cleanPayload = validateMealPayload({ name, servings, ingredients });

  await updateDoc(getTripSubdocumentRef(groupId, 'meals', mealId), {
    ...cleanPayload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMeal({ groupId, mealId }) {
  validateGroupId(groupId);

  if (!mealId) {
    throw new Error('Comida inválida.');
  }

  const usedQuery = query(
    getMealPlanCollectionRef(groupId),
    where('mealId', '==', mealId),
    limit(1),
  );
  const usedSnapshot = await getDocs(usedQuery);

  if (!usedSnapshot.empty) {
    throw new Error('Esta comida está usada en el plan. Sacala del calendario antes de borrarla.');
  }

  await deleteDoc(getTripSubdocumentRef(groupId, 'meals', mealId));
}

export async function setMealPlanSlot({
  groupId,
  slotId,
  date,
  mealType,
  assignmentType,
  mealId = '',
  label = '',
  currentUserUid,
}) {
  validateGroupId(groupId);

  if (!slotId || !date || !['lunch', 'dinner'].includes(mealType)) {
    throw new Error('Slot de comida inválido.');
  }

  if (!['meal', 'leftovers', 'custom'].includes(assignmentType)) {
    throw new Error('Tipo de comida inválido.');
  }

  if (assignmentType === 'meal' && !mealId) {
    throw new Error('Elegí una comida del catálogo.');
  }

  const cleanLabel = String(label || '').trim();

  if (assignmentType === 'custom' && !cleanLabel) {
    throw new Error('Escribí qué van a comer.');
  }

  const planRef = getTripSubdocumentRef(groupId, 'mealPlan', slotId);
  const snapshot = await getDoc(planRef);
  const update = {
    date,
    mealType,
    assignmentType,
    mealId: assignmentType === 'meal' ? mealId : '',
    label: assignmentType === 'leftovers' ? 'Sobras' : cleanLabel,
    updatedAt: serverTimestamp(),
  };

  if (snapshot.exists()) {
    await updateDoc(planRef, update);
    return;
  }

  await setDoc(planRef, {
    ...update,
    createdBy: currentUserUid,
    createdAt: serverTimestamp(),
  });
}

export async function clearMealPlanSlot({ groupId, slotId }) {
  validateGroupId(groupId);

  if (!slotId) {
    throw new Error('Slot de comida inválido.');
  }

  await deleteDoc(getTripSubdocumentRef(groupId, 'mealPlan', slotId));
}

function validateExtraPayload({ name, mode, quantity, unit, purchasePlace, ingredients }) {
  const cleanName = String(name || '').trim();

  if (!cleanName) {
    throw new Error('El nombre del extra es obligatorio.');
  }

  if (!['direct', 'recipe'].includes(mode)) {
    throw new Error('Tipo de extra inválido.');
  }

  if (mode === 'direct') {
    const parsedQuantity = parseFoodQuantity(quantity);

    if (parsedQuantity <= 0 || !FOOD_UNIT_VALUES.includes(unit)) {
      throw new Error('Indicá una cantidad y unidad válidas.');
    }

    return {
      name: cleanName,
      mode,
      quantity: parsedQuantity,
      unit,
      purchasePlace: String(purchasePlace || '').trim(),
      ingredients: [],
    };
  }

  const cleanIngredients = normalizeIngredients(ingredients);

  if ((ingredients || []).length !== cleanIngredients.length) {
    throw new Error('Revisá los ingredientes del extra.');
  }

  return {
    name: cleanName,
    mode,
    quantity: 0,
    unit: '',
    purchasePlace: '',
    ingredients: cleanIngredients,
  };
}

export async function createFoodExtra({
  groupId,
  name,
  mode,
  quantity,
  unit,
  purchasePlace = '',
  ingredients = [],
  createdBy,
}) {
  validateGroupId(groupId);
  const cleanPayload = validateExtraPayload({ name, mode, quantity, unit, purchasePlace, ingredients });
  const payload = {
    ...cleanPayload,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(getFoodExtrasCollectionRef(groupId), payload);
  return { id: docRef.id, ...payload };
}

export async function updateFoodExtra({
  groupId,
  extraId,
  name,
  mode,
  quantity,
  unit,
  purchasePlace = '',
  ingredients = [],
}) {
  validateGroupId(groupId);

  if (!extraId) {
    throw new Error('Extra inválido.');
  }

  const cleanPayload = validateExtraPayload({ name, mode, quantity, unit, purchasePlace, ingredients });

  await updateDoc(getTripSubdocumentRef(groupId, 'foodExtras', extraId), {
    ...cleanPayload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFoodExtra({ groupId, extraId }) {
  validateGroupId(groupId);

  if (!extraId) {
    throw new Error('Extra inválido.');
  }

  await deleteDoc(getTripSubdocumentRef(groupId, 'foodExtras', extraId));
}

function validateDrinkPayload({
  name,
  calculationMode,
  quantity,
  unit,
  purchasePlace,
  participantIds,
  coverageMode,
  coverageDays,
}) {
  const cleanName = String(name || '').trim();
  const parsedQuantity = parseFoodQuantity(quantity);

  if (!cleanName) {
    throw new Error('El nombre de la bebida es obligatorio.');
  }

  if (!['fixed', 'perPersonPerDay'].includes(calculationMode)) {
    throw new Error('Tipo de cálculo de bebida inválido.');
  }

  if (parsedQuantity <= 0 || !FOOD_UNIT_VALUES.includes(unit)) {
    throw new Error('Indicá una cantidad y unidad válidas.');
  }

  if (calculationMode === 'fixed') {
    return {
      name: cleanName,
      calculationMode,
      quantity: parsedQuantity,
      unit,
      purchasePlace: String(purchasePlace || '').trim(),
      participantIds: [],
      coverageMode: 'trip',
      coverageDays: 0,
    };
  }

  const cleanParticipantIds = Array.from(new Set((participantIds || []).filter(Boolean)));

  if (cleanParticipantIds.length === 0) {
    throw new Error('Elegí al menos una persona que consuma esta bebida.');
  }

  if (!['trip', 'custom'].includes(coverageMode)) {
    throw new Error('Cobertura de bebida inválida.');
  }

  const parsedCoverageDays = coverageMode === 'custom' ? Number(coverageDays) : 0;

  if (coverageMode === 'custom' && (!Number.isInteger(parsedCoverageDays) || parsedCoverageDays <= 0)) {
    throw new Error('Indicá una cantidad válida de días de consumo.');
  }

  return {
    name: cleanName,
    calculationMode,
    quantity: parsedQuantity,
    unit,
    purchasePlace: String(purchasePlace || '').trim(),
    participantIds: cleanParticipantIds,
    coverageMode,
    coverageDays: parsedCoverageDays,
  };
}

export async function createDrinkPlan({
  groupId,
  name,
  calculationMode,
  quantity,
  unit,
  purchasePlace = '',
  participantIds = [],
  coverageMode = 'trip',
  coverageDays = 0,
  createdBy,
}) {
  validateGroupId(groupId);
  const cleanPayload = validateDrinkPayload({
    name,
    calculationMode,
    quantity,
    unit,
    purchasePlace,
    participantIds,
    coverageMode,
    coverageDays,
  });
  const payload = {
    ...cleanPayload,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(getDrinkPlansCollectionRef(groupId), payload);
  return { id: docRef.id, ...payload };
}

export async function updateDrinkPlan({
  groupId,
  drinkId,
  name,
  calculationMode,
  quantity,
  unit,
  purchasePlace = '',
  participantIds = [],
  coverageMode = 'trip',
  coverageDays = 0,
}) {
  validateGroupId(groupId);

  if (!drinkId) {
    throw new Error('Bebida inválida.');
  }

  const cleanPayload = validateDrinkPayload({
    name,
    calculationMode,
    quantity,
    unit,
    purchasePlace,
    participantIds,
    coverageMode,
    coverageDays,
  });

  await updateDoc(getTripSubdocumentRef(groupId, 'drinkPlans', drinkId), {
    ...cleanPayload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDrinkPlan({ groupId, drinkId }) {
  validateGroupId(groupId);

  if (!drinkId) {
    throw new Error('Bebida inválida.');
  }

  await deleteDoc(getTripSubdocumentRef(groupId, 'drinkPlans', drinkId));
}

function subscribeToCollection(collectionRef, callback, errorCallback, orderField = null) {
  const source = orderField ? query(collectionRef, orderBy(orderField, 'asc')) : collectionRef;

  return onSnapshot(
    source,
    (snapshot) => {
      callback(snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() })));
    },
    errorCallback,
  );
}

export function subscribeToMeals(groupId, callback, errorCallback) {
  if (!groupId) return () => {};
  return subscribeToCollection(getMealsCollectionRef(groupId), callback, errorCallback, 'name');
}

export function subscribeToMealPlan(groupId, callback, errorCallback) {
  if (!groupId) return () => {};
  return subscribeToCollection(getMealPlanCollectionRef(groupId), callback, errorCallback, 'date');
}

export function subscribeToFoodExtras(groupId, callback, errorCallback) {
  if (!groupId) return () => {};
  return subscribeToCollection(getFoodExtrasCollectionRef(groupId), callback, errorCallback, 'name');
}

export function subscribeToDrinkPlans(groupId, callback, errorCallback) {
  if (!groupId) return () => {};
  return subscribeToCollection(getDrinkPlansCollectionRef(groupId), callback, errorCallback, 'name');
}
