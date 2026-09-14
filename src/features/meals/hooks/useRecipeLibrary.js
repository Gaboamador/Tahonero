import { useEffect, useState } from 'react';
import { subscribeToRecipeLibrary } from '@/features/meals/services/recipeLibraryService';

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

    setIsLoading(true);
    setError('');

    return subscribeToRecipeLibrary(
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
  }, [userUid]);

  return { recipes, isLoading, error };
}
