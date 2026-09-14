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
import { normalizeFlavorList } from '@/features/empanadas/utils/empanadaUtils';
import { buildLegacySharedId, uniqueUserIds } from '@/utils/sharedLibraryUtils';

export function getSharedEmpanadaVendorsCollectionRef() {
  return collection(db, 'empanadaVendors');
}

function getSharedEmpanadaVendorRef(vendorId) {
  return doc(db, 'empanadaVendors', vendorId);
}

function getLegacyEmpanadaVendorsCollectionRef(userUid) {
  return collection(db, 'users', userUid, 'empanadaVendors');
}

function validateVendorPayload({ name, flavors }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('El nombre del local es obligatorio.');

  const cleanFlavors = normalizeFlavorList(flavors);
  if (cleanFlavors.length === 0 || cleanFlavors.length !== (flavors || []).length) {
    throw new Error('Todos los gustos necesitan sigla y nombre.');
  }

  return { name: cleanName, flavors: cleanFlavors };
}

export async function migrateLegacyEmpanadaVendorLibrary(userUid) {
  if (!userUid) throw new Error('Usuario inválido.');

  const [legacySnapshot, accessibleSharedSnapshot] = await Promise.all([
    getDocs(getLegacyEmpanadaVendorsCollectionRef(userUid)),
    getDocs(
      query(
        getSharedEmpanadaVendorsCollectionRef(),
        where('accessUserIds', 'array-contains', userUid),
      ),
    ),
  ]);
  if (legacySnapshot.empty) return;

  const existingByLegacyKey = new Map();
  accessibleSharedSnapshot.docs.forEach((sharedDoc) => {
    const data = sharedDoc.data();
    if (data.legacyOwnerUid && data.legacyVendorId) {
      existingByLegacyKey.set(`${data.legacyOwnerUid}:${data.legacyVendorId}`, sharedDoc.ref);
    }
  });

  for (const legacyDoc of legacySnapshot.docs) {
    const legacyData = legacyDoc.data();
    const legacyKey = `${userUid}:${legacyDoc.id}`;
    const existingRef = existingByLegacyKey.get(legacyKey);
    const sharedRef = existingRef || getSharedEmpanadaVendorRef(buildLegacySharedId(userUid, legacyDoc.id));
    const batch = writeBatch(db);

    if (existingRef) {
      batch.update(sharedRef, {
        accessUserIds: arrayUnion(userUid),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(sharedRef, {
        name: legacyData.name || '',
        flavors: normalizeFlavorList(legacyData.flavors || []),
        createdBy: legacyData.createdBy || userUid,
        accessUserIds: [userUid],
        legacyOwnerUid: userUid,
        legacyVendorId: legacyDoc.id,
        createdAt: legacyData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.delete(legacyDoc.ref);
    await batch.commit();
  }
}

export async function createEmpanadaVendor({ userUid, name, flavors, accessUserIds = [] }) {
  if (!userUid) throw new Error('Usuario inválido.');
  const clean = validateVendorPayload({ name, flavors });
  const payload = {
    ...clean,
    createdBy: userUid,
    accessUserIds: uniqueUserIds([userUid, ...accessUserIds]),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(getSharedEmpanadaVendorsCollectionRef(), payload);
  return { id: ref.id, ...payload, libraryScope: 'shared' };
}

export async function updateEmpanadaVendor({ vendorId, name, flavors }) {
  if (!vendorId) throw new Error('Local inválido.');
  const clean = validateVendorPayload({ name, flavors });
  await updateDoc(getSharedEmpanadaVendorRef(vendorId), {
    ...clean,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEmpanadaVendor({ userUid, vendor }) {
  if (!userUid || !vendor?.id) throw new Error('Local inválido.');
  const accessUserIds = uniqueUserIds(vendor.accessUserIds || []);
  if (vendor.createdBy !== userUid || accessUserIds.length > 1) {
    throw new Error('No se puede borrar un local compartido con otras personas.');
  }
  await deleteDoc(getSharedEmpanadaVendorRef(vendor.id));
}

export function subscribeToEmpanadaVendors(userUid, callback, errorCallback) {
  if (!userUid) return () => {};
  const vendorsQuery = query(
    getSharedEmpanadaVendorsCollectionRef(),
    where('accessUserIds', 'array-contains', userUid),
  );
  return onSnapshot(
    vendorsQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data(), libraryScope: 'shared' }))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es-AR'));
      callback(items);
    },
    errorCallback,
  );
}
