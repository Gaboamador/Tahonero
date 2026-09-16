import { useEffect, useState } from 'react';
import { subscribeToTripLeftovers } from '@/features/leftovers/services/tripLeftoversService';

export function useTripLeftovers(groupId) {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!groupId) {
      setRecords([]);
      setIsLoading(false);
      setError('');
      return undefined;
    }

    setIsLoading(true);
    setError('');

    return subscribeToTripLeftovers(
      groupId,
      (nextRecords) => {
        setRecords(nextRecords);
        setIsLoading(false);
      },
      (err) => {
        console.error('No se pudieron cargar las sobras:', err);
        setRecords([]);
        setError('No se pudieron cargar las sobras del viaje.');
        setIsLoading(false);
      },
    );
  }, [groupId]);

  return { records, isLoading, error };
}
