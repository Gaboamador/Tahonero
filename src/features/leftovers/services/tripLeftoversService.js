import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/services/firebase/firebaseConfig';

function getTripLeftoversCollectionRef(groupId) {
  return collection(db, 'groups', groupId, 'tripLeftovers');
}

function getShoppingLeftoverRef(groupId, itemKey) {
  return doc(db, 'groups', groupId, 'tripLeftovers', itemKey);
}

export function subscribeToTripLeftovers(groupId, callback, errorCallback) {
  if (!groupId) {
    return () => {};
  }

  return onSnapshot(
    getTripLeftoversCollectionRef(groupId),
    (snapshot) => {
      const records = snapshot.docs
        .map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));

      callback(records);
    },
    errorCallback,
  );
}

export async function saveShoppingLeftoverReview({
  groupId,
  item,
  status,
  leftoverQuantity = 0,
  leftoverUnit,
  actualPurchasedQuantity = 0,
  actualPurchasedUnit,
  note = '',
  currentUserUid,
}) {
  if (!groupId || !item?.itemKey || !currentUserUid) {
    throw new Error('Producto inválido.');
  }

  if (!['none', 'leftover'].includes(status)) {
    throw new Error('Estado de sobra inválido.');
  }

  const numericLeftover = Number(leftoverQuantity) || 0;
  const numericActualPurchased = Number(actualPurchasedQuantity) || 0;

  if (status === 'leftover' && numericLeftover <= 0) {
    throw new Error('Indicá cuánto sobró.');
  }

  if (numericActualPurchased < 0) {
    throw new Error('La cantidad comprada no puede ser negativa.');
  }

  await setDoc(getShoppingLeftoverRef(groupId, item.itemKey), {
    sourceType: 'shopping',
    sourceItemKey: item.itemKey,
    sourceSignature: item.signature,
    name: item.name,
    plannedQuantity: Number(item.quantity) || 0,
    plannedUnit: item.unit,
    plannedQuantityLabel: item.quantityLabel,
    purchasePlace: item.purchasePlace || '',
    status,
    leftoverQuantity: status === 'leftover' ? numericLeftover : 0,
    leftoverUnit: leftoverUnit || item.unit,
    actualPurchasedQuantity: numericActualPurchased,
    actualPurchasedUnit: actualPurchasedUnit || item.unit,
    note: String(note || '').trim(),
    updatedBy: currentUserUid,
    updatedAt: serverTimestamp(),
  });
}

export async function addManualLeftover({
  groupId,
  name,
  quantity,
  unit,
  note = '',
  currentUserUid,
}) {
  const cleanName = String(name || '').trim();
  const numericQuantity = Number(quantity) || 0;

  if (!groupId || !cleanName || numericQuantity <= 0 || !unit || !currentUserUid) {
    throw new Error('Completá el alimento, la cantidad y la unidad.');
  }

  await addDoc(getTripLeftoversCollectionRef(groupId), {
    sourceType: 'manual',
    sourceItemKey: '',
    sourceSignature: '',
    name: cleanName,
    plannedQuantity: 0,
    plannedUnit: unit,
    plannedQuantityLabel: '',
    purchasePlace: '',
    status: 'leftover',
    leftoverQuantity: numericQuantity,
    leftoverUnit: unit,
    actualPurchasedQuantity: 0,
    actualPurchasedUnit: unit,
    note: String(note || '').trim(),
    updatedBy: currentUserUid,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTripLeftover({ groupId, recordId }) {
  if (!groupId || !recordId) {
    throw new Error('Registro inválido.');
  }

  await deleteDoc(doc(db, 'groups', groupId, 'tripLeftovers', recordId));
}
