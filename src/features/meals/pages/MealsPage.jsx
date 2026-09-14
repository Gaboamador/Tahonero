import { useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FiCoffee, FiPackage, FiShoppingCart, FiUsers } from 'react-icons/fi';
import DrinkPlansSection from '@/features/meals/components/DrinkPlansSection';
import FoodExtrasSection from '@/features/meals/components/FoodExtrasSection';
import MealCatalogSection from '@/features/meals/components/MealCatalogSection';
import MealPlanSection from '@/features/meals/components/MealPlanSection';
import { useMealModuleData } from '@/features/meals/hooks/useMealModuleData';
import { reconcileTripMealLibraryAccess } from '@/features/meals/services/mealService';
import { useRecipeLibrary } from '@/features/meals/hooks/useRecipeLibrary';
import { collectPurchasePlaces } from '@/features/meals/utils/mealUtils';
import { useAuth } from '@/hooks/useAuth';
import { getGroupMembers } from '@/services/firebase/groupService';
import { getTripDaysCount, getTripMealSlots } from '@/utils/tripUtils';
import { getTripRegisteredUserIds } from '@/utils/sharedLibraryUtils';
import styles from './MealsPage.module.scss';

function MealsPage() {
  const { group } = useOutletContext();
  const { currentUser } = useAuth();
  const { meals, mealPlan, foodExtras, drinkPlans, isLoading, error } = useMealModuleData(group.id);
  const {
    recipes: libraryRecipes,
    isLoading: libraryLoading,
    error: libraryError,
  } = useRecipeLibrary(currentUser?.uid);

  const members = useMemo(() => getGroupMembers(group), [group]);
  const sharedUserIds = useMemo(() => getTripRegisteredUserIds(group), [group]);
  const tripDaysCount = getTripDaysCount(group.startDate, group.endDate);
  const slots = useMemo(
    () =>
      getTripMealSlots({
        startDate: group.startDate,
        endDate: group.endDate,
        firstMeal: group.firstMeal || 'lunch',
        lastMeal: group.lastMeal || 'dinner',
      }),
    [group.startDate, group.endDate, group.firstMeal, group.lastMeal],
  );

  const purchasePlaceSuggestions = useMemo(
    () => collectPurchasePlaces({ meals, foodExtras, drinkPlans, libraryRecipes }),
    [meals, foodExtras, drinkPlans, libraryRecipes],
  );

  const plannedSlots = slots.filter((slot) => mealPlan.some((plan) => plan.id === slot.id)).length;

  useEffect(() => {
    if (libraryLoading || !currentUser?.uid || meals.length === 0) {
      return;
    }

    reconcileTripMealLibraryAccess({
      groupId: group.id,
      meals,
      libraryRecipes,
      currentUserUid: currentUser.uid,
      accessUserIds: sharedUserIds,
    }).catch((err) => {
      console.error('No se pudo sincronizar el acceso a las recetas compartidas:', err);
    });
  }, [
    group.id,
    meals,
    libraryRecipes,
    libraryLoading,
    currentUser?.uid,
    sharedUserIds,
  ]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Comidas</p>
          <h2>Plan alimentario del viaje</h2>
          <p>
            Organizá el calendario, importá recetas compartidas, agregá extras y calculá bebidas. Los lugares de compra quedan preparados para ordenar Compras.
          </p>
        </div>
      </section>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <FiCoffee aria-hidden="true" />
          <div>
            <span>Plan diario</span>
            <strong>{plannedSlots}/{slots.length}</strong>
            <small>almuerzos y cenas definidos</small>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <FiUsers aria-hidden="true" />
          <div>
            <span>Participantes</span>
            <strong>{members.length}</strong>
            <small>base para calcular porciones</small>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <FiPackage aria-hidden="true" />
          <div>
            <span>Comidas del viaje</span>
            <strong>{meals.length}</strong>
            <small>{libraryRecipes.length} disponibles en la biblioteca</small>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <FiShoppingCart aria-hidden="true" />
          <div>
            <span>Transversales</span>
            <strong>{foodExtras.length + drinkPlans.length}</strong>
            <small>extras y bebidas</small>
          </div>
        </article>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}
      {libraryError ? <p className={styles.error}>{libraryError}</p> : null}
      {isLoading ? <div className={styles.loading}>Cargando datos de comidas...</div> : null}

      <MealPlanSection
        groupId={group.id}
        slots={slots}
        meals={meals}
        mealPlan={mealPlan}
        currentUserUid={currentUser.uid}
      />

      <MealCatalogSection
        groupId={group.id}
        meals={meals}
        mealPlan={mealPlan}
        participantCount={members.length}
        currentUserUid={currentUser.uid}
        sharedUserIds={sharedUserIds}
        libraryRecipes={libraryRecipes}
        libraryLoading={libraryLoading}
        purchasePlaceSuggestions={purchasePlaceSuggestions}
      />

      <FoodExtrasSection
        groupId={group.id}
        foodExtras={foodExtras}
        currentUserUid={currentUser.uid}
        purchasePlaceSuggestions={purchasePlaceSuggestions}
      />

      <DrinkPlansSection
        groupId={group.id}
        drinkPlans={drinkPlans}
        members={members}
        tripDaysCount={tripDaysCount}
        currentUserUid={currentUser.uid}
        purchasePlaceSuggestions={purchasePlaceSuggestions}
      />
    </div>
  );
}

export default MealsPage;
