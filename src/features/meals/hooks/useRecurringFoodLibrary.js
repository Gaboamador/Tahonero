import { useEffect, useMemo, useState } from 'react';
import {
  RECURRING_ITEM_KINDS,
  subscribeToRecurringFoodItems,
  subscribeToRecurringFoodPresets,
} from '@/features/meals/services/recurringFoodLibraryService';

export function useRecurringFoodLibrary(userUid) {
  const [items, setItems] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loadingParts, setLoadingParts] = useState({ items: true, presets: true });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userUid) {
      setItems([]);
      setPresets([]);
      setLoadingParts({ items: false, presets: false });
      setError('');
      return undefined;
    }

    setItems([]);
    setPresets([]);
    setLoadingParts({ items: true, presets: true });
    setError('');

    const handleError = (part) => (err) => {
      console.error('No se pudo cargar la biblioteca de recurrentes:', err);
      setError('No se pudo cargar la biblioteca de recurrentes.');
      setLoadingParts((current) => ({ ...current, [part]: false }));
    };

    const unsubscribers = [
      subscribeToRecurringFoodItems(
        userUid,
        (nextItems) => {
          setItems(nextItems);
          setLoadingParts((current) => ({ ...current, items: false }));
        },
        handleError('items'),
      ),
      subscribeToRecurringFoodPresets(
        userUid,
        (nextPresets) => {
          setPresets(nextPresets);
          setLoadingParts((current) => ({ ...current, presets: false }));
        },
        handleError('presets'),
      ),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [userUid]);

  const extras = useMemo(
    () => items.filter((item) => item.kind === RECURRING_ITEM_KINDS.extra),
    [items],
  );
  const drinks = useMemo(
    () => items.filter((item) => item.kind === RECURRING_ITEM_KINDS.drink),
    [items],
  );

  return {
    items,
    extras,
    drinks,
    presets,
    isLoading: Object.values(loadingParts).some(Boolean),
    error,
  };
}
