import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { getExpenseRef } from './expenseService';
import { findUserLookupByEmail, normalizeEmail } from './userService';
import { isValidTripDateRange } from '@/utils/tripUtils';

export function getGroupsCollectionRef() {
  return collection(db, 'groups');
}

export function getGroupRef(groupId) {
  return doc(db, 'groups', groupId);
}

export function buildMemberFromUser(userProfile, role = 'member') {
  return {
    uid: userProfile.uid,
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
    displayName: cleanName,
    email: cleanEmail,
    photoURL: '',
    role: 'member',
    type: 'manual',
    joinedAt: new Date().toISOString(),
  };
}

export async function createGroup({ name, description = '', startDate, endDate, userProfile }) {
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  if (!trimmedName) {
    throw new Error('El nombre del viaje es obligatorio.');
  }

  if (!startDate || !endDate || !isValidTripDateRange(startDate, endDate)) {
    throw new Error('Elegí un rango de fechas válido para el viaje.');
  }

  if (!userProfile?.uid) {
    throw new Error('No hay usuario autenticado.');
  }

  const ownerMember = buildMemberFromUser(userProfile, 'owner');

  const groupPayload = {
    entityType: 'trip',
    schemaVersion: 2,
    name: trimmedName,
    description: trimmedDescription,
    startDate,
    endDate,
    createdBy: userProfile.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    memberIds: [userProfile.uid],
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

  if (hasAnyDate && (!startDate || !endDate || !isValidTripDateRange(startDate, endDate))) {
    throw new Error('Completá ambas fechas con un rango válido.');
  }

  await updateDoc(getGroupRef(groupId), {
    entityType: 'trip',
    schemaVersion: 2,
    name: trimmedName,
    description: trimmedDescription,
    startDate: hasAnyDate ? startDate : deleteField(),
    endDate: hasAnyDate ? endDate : deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEmptyGroup({ group, expenses = [] }) {
  if (!group?.id) {
    throw new Error('Viaje inválido.');
  }

  if (expenses.length > 0) {
    throw new Error('No se puede borrar un viaje que ya tiene movimientos.');
  }

  const shouldDelete = window.confirm(
    `¿Borrar el viaje "${group.name}"? Esta acción no se puede deshacer.`,
  );

  if (!shouldDelete) {
    return false;
  }

  await deleteDoc(getGroupRef(group.id));
  return true;
}

export async function addManualMemberToGroup({ groupId, name, email = '' }) {
  if (!groupId) {
    throw new Error('Viaje inválido.');
  }

  const member = buildManualMember({ name, email });
  const groupRef = getGroupRef(groupId);

  await updateDoc(groupRef, {
    [`membersMap.${member.uid}`]: member,
    memberIds: arrayUnion(member.uid),
    updatedAt: serverTimestamp(),
  });

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

  if (group.memberIds?.includes(userLookup.uid)) {
    throw new Error('Ese usuario ya participa del viaje.');
  }

  const alreadyExistsByEmail = Object.values(group.membersMap || {}).some(
    (member) => normalizeEmail(member.email) === normalizedEmail,
  );

  if (alreadyExistsByEmail) {
    throw new Error('Ya existe un participante del viaje con ese email.');
  }

  const member = buildMemberFromLookup(userLookup, 'member');

  await updateDoc(getGroupRef(group.id), {
    [`membersMap.${member.uid}`]: member,
    memberIds: arrayUnion(member.uid),
    updatedAt: serverTimestamp(),
  });

  return member;
}

function replaceMemberIdInArray(items = [], oldMemberId, newMemberId) {
  const replaced = items.map((item) => (item === oldMemberId ? newMemberId : item));
  return Array.from(new Set(replaced));
}

function replaceMemberIdInSharesMap(sharesMap = {}, oldMemberId, newMemberId) {
  if (!sharesMap[oldMemberId]) {
    return sharesMap;
  }

  const nextSharesMap = {
    ...sharesMap,
  };

  const oldShare = Number(nextSharesMap[oldMemberId]) || 0;
  const existingNewShare = Number(nextSharesMap[newMemberId]) || 0;

  delete nextSharesMap[oldMemberId];

  nextSharesMap[newMemberId] = existingNewShare + oldShare;

  return nextSharesMap;
}

function buildLinkedExpenseUpdate({ expense, oldMemberId, newMember }) {
  const transactionType = expense.transactionType || 'expense';
  const update = {
    updatedAt: serverTimestamp(),
  };

  if (transactionType === 'payment') {
    if (expense.fromId === oldMemberId) {
      update.fromId = newMember.uid;
      update.fromName = newMember.displayName || newMember.email || 'Usuario';
    }

    if (expense.toId === oldMemberId) {
      update.toId = newMember.uid;
      update.toName = newMember.displayName || newMember.email || 'Usuario';
    }

    return update;
  }

  if (expense.paidBy === oldMemberId) {
    update.paidBy = newMember.uid;
    update.paidByName = newMember.displayName || newMember.email || 'Usuario';
  }

  if (expense.participantIds?.includes(oldMemberId)) {
    update.participantIds = replaceMemberIdInArray(
      expense.participantIds,
      oldMemberId,
      newMember.uid,
    );
  }

  if (expense.sharesMap?.[oldMemberId]) {
    update.sharesMap = replaceMemberIdInSharesMap(
      expense.sharesMap,
      oldMemberId,
      newMember.uid,
    );
  }

  return update;
}

export async function linkManualMemberToRegisteredUser({ group, manualMemberId, email, expenses = [] }) {
  if (!group?.id) {
    throw new Error('Viaje inválido.');
  }

  if (!manualMemberId) {
    throw new Error('Miembro inválido.');
  }

  const manualMember = group.membersMap?.[manualMemberId];

  if (!manualMember) {
    throw new Error('El miembro manual no existe.');
  }

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

  if (group.memberIds?.includes(userLookup.uid)) {
    throw new Error('Ese usuario ya participa del viaje.');
  }

  const alreadyExistsByEmail = Object.values(group.membersMap || {}).some(
    (member) => member.uid !== manualMemberId && normalizeEmail(member.email) === normalizedEmail,
  );

  if (alreadyExistsByEmail) {
    throw new Error('Ya existe otro participante del viaje con ese email.');
  }

  if (expenses.length > 450) {
    throw new Error('Hay demasiados movimientos para vincular este miembro de forma segura.');
  }

  const linkedMember = buildMemberFromLookup(userLookup, manualMember.role || 'member');
  const batch = writeBatch(db);

  batch.update(getGroupRef(group.id), {
    [`membersMap.${manualMemberId}`]: deleteField(),
    [`membersMap.${linkedMember.uid}`]: {
      ...linkedMember,
      linkedFromManualMemberId: manualMemberId,
      linkedFromManualMemberName: manualMember.displayName || '',
      linkedAt: new Date().toISOString(),
    },
    memberIds: arrayUnion(linkedMember.uid),
    updatedAt: serverTimestamp(),
  });

  batch.update(getGroupRef(group.id), {
    memberIds: arrayRemove(manualMemberId),
  });

  expenses.forEach((expense) => {
    const transactionType = expense.transactionType || 'expense';

    const isUsed =
      expense.paidBy === manualMemberId ||
      expense.participantIds?.includes(manualMemberId) ||
      Boolean(expense.sharesMap?.[manualMemberId]) ||
      expense.fromId === manualMemberId ||
      expense.toId === manualMemberId;

    if (!isUsed) {
      return;
    }

    const update = {
      ...buildLinkedExpenseUpdate({
        expense,
        oldMemberId: manualMemberId,
        newMember: linkedMember,
      }),
      transactionType,
    };

    batch.update(getExpenseRef(group.id, expense.id), update);
  });

  await batch.commit();

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

  await updateDoc(getGroupRef(group.id), {
    [`membersMap.${memberId}`]: deleteField(),
    memberIds: arrayRemove(memberId),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToUserGroups(uid, callback, errorCallback) {
  if (!uid) {
    return () => {};
  }

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

  return Object.values(group.membersMap).sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1;
    if (a.role !== 'owner' && b.role === 'owner') return 1;

    return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '');
  });
}

export function isUserGroupMember(group, uid) {
  if (!group || !uid) {
    return false;
  }

  return group.memberIds?.includes(uid);
}

export function isGroupOwner(group, uid) {
  if (!group || !uid) {
    return false;
  }

  return group.createdBy === uid || group.membersMap?.[uid]?.role === 'owner';
}