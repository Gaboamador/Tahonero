import { useEffect, useState } from 'react';
import { subscribeToGroup } from '@/services/firebase/groupService';

export function useGroup(groupId) {
  const [group, setGroup] = useState(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupError, setGroupError] = useState('');

  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      setGroupLoading(false);
      setGroupError('Grupo inválido.');
      return undefined;
    }

    setGroupLoading(true);
    setGroupError('');

    const unsubscribe = subscribeToGroup(
      groupId,
      (nextGroup) => {
        setGroup(nextGroup);
        setGroupError('');
        setGroupLoading(false);
      },
      (error) => {
        console.error('No se pudo cargar el viaje:', error);
        setGroup(null);
        setGroupError('No se pudo cargar el viaje.');
        setGroupLoading(false);
      },
    );

    return unsubscribe;
  }, [groupId]);

  return {
    group,
    groupLoading,
    groupError,
    groupExists: Boolean(group),
  };
}