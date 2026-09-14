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
import { validateMealPayload } from '@/features/meals/services/mealValidation';
import { buildLegacySharedId, uniqueUserIds } from '@/utils/sharedLibraryUtils';

export function getSharedRecipeCollectionRef() {
  return collection(db, 'recipes');
}

export function getSharedRecipeDocumentRef(recipeId) {
  return doc(db, 'recipes', recipeId);
}

function getLegacyRecipeCollectionRef(userUid) {
  return collection(db, 'users', userUid, 'recipes');
}

function validateUserUid(userUid) {
  if (!userUid) {
    throw new Error('Usuario inválido.');
  }
}

export async function migrateLegacyRecipeLibrary(userUid) {
  validateUserUid(userUid);

  const [legacySnapshot, accessibleSharedSnapshot] = await Promise.all([
    getDocs(getLegacyRecipeCollectionRef(userUid)),
    getDocs(
      query(
        getSharedRecipeCollectionRef(),
        where('accessUserIds', 'array-contains', userUid),
      ),
    ),
  ]);
  if (legacySnapshot.empty) return;

  const existingByLegacyKey = new Map();
  accessibleSharedSnapshot.docs.forEach((sharedDoc) => {
    const data = sharedDoc.data();
    if (data.legacyOwnerUid && data.legacyRecipeId) {
      existingByLegacyKey.set(`${data.legacyOwnerUid}:${data.legacyRecipeId}`, sharedDoc.ref);
    }
  });

  for (const legacyDoc of legacySnapshot.docs) {
    const legacyData = legacyDoc.data();
    const legacyKey = `${userUid}:${legacyDoc.id}`;
    const existingRef = existingByLegacyKey.get(legacyKey);
    const sharedRef = existingRef || getSharedRecipeDocumentRef(buildLegacySharedId(userUid, legacyDoc.id));
    const batch = writeBatch(db);

    if (existingRef) {
      batch.update(sharedRef, {
        accessUserIds: arrayUnion(userUid),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(sharedRef, {
        name: legacyData.name || '',
        servings: Number(legacyData.servings) || 1,
        ingredients: legacyData.ingredients || [],
        createdBy: legacyData.createdBy || userUid,
        accessUserIds: [userUid],
        legacyOwnerUid: userUid,
        legacyRecipeId: legacyDoc.id,
        createdAt: legacyData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.delete(legacyDoc.ref);
    await batch.commit();
  }
}

export async function createLibraryRecipe({
  userUid,
  name,
  servings,
  ingredients = [],
  accessUserIds = [],
}) {
  validateUserUid(userUid);
  const cleanPayload = validateMealPayload({ name, servings, ingredients });
  const payload = {
    ...cleanPayload,
    createdBy: userUid,
    accessUserIds: uniqueUserIds([userUid, ...accessUserIds]),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(getSharedRecipeCollectionRef(), payload);
  return { id: docRef.id, ...payload, libraryScope: 'shared' };
}

export async function updateLibraryRecipe({ recipeId, name, servings, ingredients = [] }) {
  if (!recipeId) {
    throw new Error('Receta inválida.');
  }

  const cleanPayload = validateMealPayload({ name, servings, ingredients });

  await updateDoc(getSharedRecipeDocumentRef(recipeId), {
    ...cleanPayload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteLibraryRecipe({ userUid, recipe }) {
  validateUserUid(userUid);

  if (!recipe?.id) {
    throw new Error('Receta inválida.');
  }

  const accessUserIds = uniqueUserIds(recipe.accessUserIds || []);
  if (recipe.createdBy !== userUid || accessUserIds.length > 1) {
    throw new Error('No se puede borrar una receta compartida con otras personas.');
  }

  await deleteDoc(getSharedRecipeDocumentRef(recipe.id));
}

export function subscribeToRecipeLibrary(userUid, callback, errorCallback) {
  if (!userUid) {
    return () => {};
  }

  const recipesQuery = query(
    getSharedRecipeCollectionRef(),
    where('accessUserIds', 'array-contains', userUid),
  );

  return onSnapshot(
    recipesQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map((recipeDoc) => ({
          id: recipeDoc.id,
          ...recipeDoc.data(),
          libraryScope: 'shared',
        }))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es-AR'));
      callback(items);
    },
    errorCallback,
  );
}
