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
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { findUserLookupByEmail, normalizeEmail } from './userService';
import { isValidTripDateRange } from '@/utils/tripUtils';

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
    schemaVersion: 3,
    name: trimmedName,
    description: trimmedDescription,
    startDate,
    endDate,
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
    update.schemaVersion = 3;
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
    schemaVersion: 3,
    participantIds: uniqueIds([...membershipState.participantIds, member.memberId]),
    accessUserIds: uniqueIds([...membershipState.accessUserIds, member.userUid]),
    memberIds: uniqueIds([
      ...membershipState.legacyMemberIds,
      member.memberId,
      member.userUid,
    ]),
    updatedAt: serverTimestamp(),
  });

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
    schemaVersion: 3,
    participantIds: membershipState.participantIds,
    accessUserIds: uniqueIds([...membershipState.accessUserIds, userLookup.uid]),
    memberIds: uniqueIds([...membershipState.legacyMemberIds, userLookup.uid]),
    updatedAt: serverTimestamp(),
  });

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