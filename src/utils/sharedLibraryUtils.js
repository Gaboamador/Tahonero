export function uniqueUserIds(userIds = []) {
  return Array.from(new Set((userIds || []).filter(Boolean)));
}

export function getTripRegisteredUserIds(group) {
  if (!group) return [];

  const memberUserIds = Object.values(group.membersMap || {})
    .map((member) => member?.userUid || (member?.type === 'user' ? member?.uid : ''))
    .filter(Boolean);

  return uniqueUserIds([
    ...(group.accessUserIds || []),
    ...memberUserIds,
    group.createdBy,
  ]);
}

export function buildLegacySharedId(ownerUid, legacyId) {
  if (!ownerUid || !legacyId) return '';
  return `legacy_${ownerUid}_${legacyId}`;
}
