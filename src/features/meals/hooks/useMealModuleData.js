import { useEffect, useState } from 'react';
import {
  subscribeToDrinkPlans,
  subscribeToFoodExtras,
  subscribeToMealPlan,
  subscribeToMeals,
} from '@/features/meals/services/mealService';

export function useMealModuleData(groupId) {
  const [meals, setMeals] = useState([]);
  const [mealPlan, setMealPlan] = useState([]);
  const [foodExtras, setFoodExtras] = useState([]);
  const [drinkPlans, setDrinkPlans] = useState([]);
  const [loadingParts, setLoadingParts] = useState({
    meals: true,
    mealPlan: true,
    foodExtras: true,
    drinkPlans: true,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!groupId) {
      setMeals([]);
      setMealPlan([]);
      setFoodExtras([]);
      setDrinkPlans([]);
      setLoadingParts({ meals: false, mealPlan: false, foodExtras: false, drinkPlans: false });
      return undefined;
    }

    setError('');
    setLoadingParts({ meals: true, mealPlan: true, foodExtras: true, drinkPlans: true });

    const handleError = (part, message) => (err) => {
      console.error(message, err);
      setError('No se pudieron cargar todos los datos de comidas.');
      setLoadingParts((current) => ({ ...current, [part]: false }));
    };

    const unsubscribers = [
      subscribeToMeals(
        groupId,
        (items) => {
          setMeals(items);
          setLoadingParts((current) => ({ ...current, meals: false }));
        },
        handleError('meals', 'No se pudieron cargar las comidas:'),
      ),
      subscribeToMealPlan(
        groupId,
        (items) => {
          setMealPlan(items);
          setLoadingParts((current) => ({ ...current, mealPlan: false }));
        },
        handleError('mealPlan', 'No se pudo cargar el plan de comidas:'),
      ),
      subscribeToFoodExtras(
        groupId,
        (items) => {
          setFoodExtras(items);
          setLoadingParts((current) => ({ ...current, foodExtras: false }));
        },
        handleError('foodExtras', 'No se pudieron cargar los extras:'),
      ),
      subscribeToDrinkPlans(
        groupId,
        (items) => {
          setDrinkPlans(items);
          setLoadingParts((current) => ({ ...current, drinkPlans: false }));
        },
        handleError('drinkPlans', 'No se pudieron cargar las bebidas:'),
      ),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [groupId]);

  return {
    meals,
    mealPlan,
    foodExtras,
    drinkPlans,
    isLoading: Object.values(loadingParts).some(Boolean),
    error,
  };
}
