import { useEffect, useState } from 'react';
import { subscribeToUserGroups } from '@/services/firebase/groupService';
import { useAuth } from './useAuth';

export function useUserGroups() {
  const { currentUser } = useAuth();

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState('');

  useEffect(() => {
    if (!currentUser?.uid) {
      setGroups([]);
      setGroupsLoading(false);
      setGroupsError('');
      return undefined;
    }

    setGroupsLoading(true);
    setGroupsError('');

    const unsubscribe = subscribeToUserGroups(
      currentUser.uid,
      (nextGroups) => {
        setGroups(nextGroups);
        setGroupsError('');
        setGroupsLoading(false);
      },
      (error) => {
        console.error('No se pudieron cargar los viajes:', error);
        setGroupsError('No se pudieron cargar los viajes.');
        setGroupsLoading(false);
      },
    );

    return unsubscribe;
  }, [currentUser?.uid]);

  return {
    groups,
    groupsLoading,
    groupsError,
    hasGroups: groups.length > 0,
  };
}