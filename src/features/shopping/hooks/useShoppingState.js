import { useEffect, useState } from 'react';
import { subscribeToShoppingState } from '@/features/shopping/services/shoppingService';

export function useShoppingState(groupId) {
  const [shoppingState, setShoppingState] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!groupId) {
      setShoppingState({});
      setIsLoading(false);
      setError('');
      return undefined;
    }

    setIsLoading(true);
    setError('');

    return subscribeToShoppingState(
      groupId,
      (nextState) => {
        setShoppingState(nextState);
        setIsLoading(false);
      },
      (err) => {
        console.error('No se pudo cargar el estado de compras:', err);
        setShoppingState({});
        setError('No se pudo cargar el estado de la lista de compras.');
        setIsLoading(false);
      },
    );
  }, [groupId]);

  return {
    shoppingState,
    isLoading,
    error,
  };
}
