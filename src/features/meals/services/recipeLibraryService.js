import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/services/firebase/firebaseConfig';
import { validateMealPayload } from '@/features/meals/services/mealService';

export function getRecipeLibraryCollectionRef(userUid) {
  return collection(db, 'users', userUid, 'recipes');
}

function getRecipeLibraryDocumentRef(userUid, recipeId) {
  return doc(db, 'users', userUid, 'recipes', recipeId);
}

function validateUserUid(userUid) {
  if (!userUid) {
    throw new Error('Usuario inválido.');
  }
}

export async function createLibraryRecipe({ userUid, name, servings, ingredients = [] }) {
  validateUserUid(userUid);
  const cleanPayload = validateMealPayload({ name, servings, ingredients });
  const payload = {
    ...cleanPayload,
    createdBy: userUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(getRecipeLibraryCollectionRef(userUid), payload);
  return { id: docRef.id, ...payload };
}

export async function updateLibraryRecipe({ userUid, recipeId, name, servings, ingredients = [] }) {
  validateUserUid(userUid);

  if (!recipeId) {
    throw new Error('Receta inválida.');
  }

  const cleanPayload = validateMealPayload({ name, servings, ingredients });

  await updateDoc(getRecipeLibraryDocumentRef(userUid, recipeId), {
    ...cleanPayload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteLibraryRecipe({ userUid, recipeId }) {
  validateUserUid(userUid);

  if (!recipeId) {
    throw new Error('Receta inválida.');
  }

  await deleteDoc(getRecipeLibraryDocumentRef(userUid, recipeId));
}

export function subscribeToRecipeLibrary(userUid, callback, errorCallback) {
  if (!userUid) {
    return () => {};
  }

  const recipesQuery = query(getRecipeLibraryCollectionRef(userUid), orderBy('name', 'asc'));

  return onSnapshot(
    recipesQuery,
    (snapshot) => {
      callback(snapshot.docs.map((recipeDoc) => ({ id: recipeDoc.id, ...recipeDoc.data() })));
    },
    errorCallback,
  );
}
