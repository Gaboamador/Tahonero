import { useEffect, useState } from 'react';
import {
  migrateLegacyEmpanadaVendorLibrary,
  subscribeToEmpanadaVendors,
} from '@/features/empanadas/services/empanadaVendorLibraryService';

export function useEmpanadaVendorLibrary(userUid) {
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userUid) {
      setVendors([]);
      setError('');
      setIsLoading(false);
      return undefined;
    }

    let unsubscribe = () => {};
    let cancelled = false;

    setIsLoading(true);
    setError('');

    const start = async () => {
      try {
        await migrateLegacyEmpanadaVendorLibrary(userUid);
        if (cancelled) return;

        unsubscribe = subscribeToEmpanadaVendors(
          userUid,
          (items) => {
            setVendors(items);
            setIsLoading(false);
          },
          (err) => {
            console.error('No se pudieron cargar los locales de empanadas:', err);
            setError('No se pudieron cargar los locales de empanadas.');
            setIsLoading(false);
          },
        );
      } catch (err) {
        console.error('No se pudo migrar/cargar la biblioteca de locales:', err);
        if (!cancelled) {
          setVendors([]);
          setError('No se pudieron cargar los locales de empanadas.');
          setIsLoading(false);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userUid]);

  return { vendors, isLoading, error };
}
