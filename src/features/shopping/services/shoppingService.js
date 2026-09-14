import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase/firebaseConfig';

export function getShoppingStateCollectionRef(groupId) {
  return collection(db, 'groups', groupId, 'shoppingState');
}

function getShoppingStateRef(groupId, itemKey) {
  return doc(db, 'groups', groupId, 'shoppingState', itemKey);
}

export async function setShoppingItemChecked({
  groupId,
  itemKey,
  signature,
  checked,
  currentUserUid,
}) {
  if (!groupId || !itemKey || !currentUserUid) {
    throw new Error('Ítem de compra inválido.');
  }

  const stateRef = getShoppingStateRef(groupId, itemKey);

  if (!checked) {
    await deleteDoc(stateRef);
    return;
  }

  await setDoc(stateRef, {
    checked: true,
    signature,
    updatedBy: currentUserUid,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToShoppingState(groupId, callback, errorCallback) {
  if (!groupId) {
    return () => {};
  }

  return onSnapshot(
    getShoppingStateCollectionRef(groupId),
    (snapshot) => {
      const state = {};

      snapshot.docs.forEach((stateDoc) => {
        state[stateDoc.id] = {
          id: stateDoc.id,
          ...stateDoc.data(),
        };
      });

      callback(state);
    },
    errorCallback,
  );
}
