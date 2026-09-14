import { useEffect, useState } from 'react';
import {
  migrateLegacyRecipeLibrary,
  subscribeToRecipeLibrary,
} from '@/features/meals/services/recipeLibraryService';

export function useRecipeLibrary(userUid) {
  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userUid) {
      setRecipes([]);
      setIsLoading(false);
      setError('');
      return undefined;
    }

    let unsubscribe = () => {};
    let cancelled = false;

    setIsLoading(true);
    setError('');

    const start = async () => {
      try {
        await migrateLegacyRecipeLibrary(userUid);
        if (cancelled) return;

        unsubscribe = subscribeToRecipeLibrary(
          userUid,
          (items) => {
            setRecipes(items);
            setIsLoading(false);
          },
          (err) => {
            console.error('No se pudo cargar la biblioteca de comidas:', err);
            setRecipes([]);
            setError('No se pudo cargar la biblioteca de comidas.');
            setIsLoading(false);
          },
        );
      } catch (err) {
        console.error('No se pudo migrar/cargar la biblioteca de comidas:', err);
        if (!cancelled) {
          setRecipes([]);
          setError('No se pudo cargar la biblioteca de comidas.');
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

  return { recipes, isLoading, error };
}
