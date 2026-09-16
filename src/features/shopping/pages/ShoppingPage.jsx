import { useMemo, useState } from 'react';
import {
  FiBookOpen,
  FiCheckCircle,
  FiCoffee,
  FiMapPin,
  FiPlusCircle,
  FiShoppingCart,
} from 'react-icons/fi';
import { useOutletContext } from 'react-router-dom';
import { useMealModuleData } from '@/features/meals/hooks/useMealModuleData';
import { useShoppingState } from '@/features/shopping/hooks/useShoppingState';
import { setShoppingItemChecked } from '@/features/shopping/services/shoppingService';
import {
  buildShoppingList,
  groupShoppingItemsByPlace,
  groupShoppingItemsByRecipe,
  isShoppingItemChecked,
} from '@/features/shopping/utils/shoppingUtils';
import { useAuth } from '@/hooks/useAuth';
import { getGroupMembers } from '@/services/firebase/groupService';
import { getTripDaysCount } from '@/utils/tripUtils';
import TripModuleHeader from '@/features/trips/components/TripModuleHeader';
import styles from './ShoppingPage.module.scss';

function ShoppingItemRow({
  item,
  shoppingState,
  updatingItemKey,
  onToggle,
  detail = '',
  quantityLabel,
  showTotal = false,
}) {
  const checked = isShoppingItemChecked(item, shoppingState);
  const isUpdating = updatingItemKey === item.itemKey;

  return (
    <li className={`${styles.shoppingItem} ${checked ? styles.checkedItem : ''}`}>
      <label className={styles.checkControl}>
        <input
          type="checkbox"
          checked={checked}
          disabled={isUpdating}
          onChange={() => onToggle(item)}
        />
        <span className={styles.itemContent}>
          <strong>{item.name}</strong>
          {detail ? <small>{detail}</small> : null}
        </span>
        <span className={styles.quantity}>
          <strong>{quantityLabel || item.quantityLabel}</strong>
          {showTotal ? <small>de {item.quantityLabel} total</small> : null}
        </span>
      </label>
    </li>
  );
}

function getRecipeGroupIcon(type) {
  if (type === 'extras') return FiPlusCircle;
  if (type === 'drinks') return FiCoffee;
  return FiBookOpen;
}

function ShoppingPage() {
  const { group } = useOutletContext();
  const { currentUser } = useAuth();
  const { meals, mealPlan, foodExtras, drinkPlans, isLoading: foodLoading, error: foodError } =
    useMealModuleData(group.id);
  const {
    shoppingState,
    isLoading: stateLoading,
    error: stateError,
  } = useShoppingState(group.id);

  const [groupingMode, setGroupingMode] = useState('place');
  const [updatingItemKey, setUpdatingItemKey] = useState('');
  const [actionError, setActionError] = useState('');

  const participantCount = useMemo(() => getGroupMembers(group).length, [group]);
  const tripDaysCount = getTripDaysCount(group.startDate, group.endDate);

  const shoppingItems = useMemo(
    () =>
      buildShoppingList({
        meals,
        mealPlan,
        foodExtras,
        drinkPlans,
        participantCount,
        tripDaysCount,
      }),
    [meals, mealPlan, foodExtras, drinkPlans, participantCount, tripDaysCount],
  );

  const placeGroups = useMemo(() => groupShoppingItemsByPlace(shoppingItems), [shoppingItems]);
  const recipeGroups = useMemo(() => groupShoppingItemsByRecipe(shoppingItems), [shoppingItems]);
  const checkedCount = shoppingItems.filter((item) =>
    isShoppingItemChecked(item, shoppingState),
  ).length;
  const pendingCount = shoppingItems.length - checkedCount;
  const placesCount = placeGroups.filter((groupItem) => !groupItem.isUnassigned).length;

  const handleToggle = async (item) => {
    const currentlyChecked = isShoppingItemChecked(item, shoppingState);

    setActionError('');
    setUpdatingItemKey(item.itemKey);

    try {
      await setShoppingItemChecked({
        groupId: group.id,
        itemKey: item.itemKey,
        signature: item.signature,
        checked: !currentlyChecked,
        currentUserUid: currentUser.uid,
      });
    } catch (error) {
      console.error(error);
      setActionError(error.message || 'No se pudo actualizar el ítem.');
    } finally {
      setUpdatingItemKey('');
    }
  };

  return (
    <div className={styles.page}>
      <TripModuleHeader
        moduleId="shopping"
        title="Lista consolidada del viaje"
        description="Se genera automáticamente desde el plan de comidas, extras y bebidas. Si cambian las cantidades necesarias, un ítem que ya estaba marcado vuelve a pendiente para que no pase desapercibido."
      />

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <FiShoppingCart aria-hidden="true" />
          <div>
            <span>Productos</span>
            <strong>{shoppingItems.length}</strong>
            <small>{pendingCount} pendientes</small>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <FiCheckCircle aria-hidden="true" />
          <div>
            <span>Comprados</span>
            <strong>{checkedCount}/{shoppingItems.length}</strong>
            <small>estado compartido en tiempo real</small>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <FiMapPin aria-hidden="true" />
          <div>
            <span>Lugares</span>
            <strong>{placesCount}</strong>
            <small>sin contar ítems sin lugar asignado</small>
          </div>
        </article>
      </section>

      {foodError ? <p className={styles.error}>{foodError}</p> : null}
      {stateError ? <p className={styles.error}>{stateError}</p> : null}
      {actionError ? <p className={styles.error}>{actionError}</p> : null}

      {foodLoading || stateLoading ? (
        <div className={styles.loading}>Calculando lista de compras...</div>
      ) : null}

      {!foodLoading && !stateLoading && shoppingItems.length === 0 ? (
        <section className={styles.emptyState}>
          <FiShoppingCart aria-hidden="true" />
          <h3>Todavía no hay nada para comprar</h3>
          <p>
            Asigná comidas al plan o agregá Extras/Bebidas. Los elementos aparecen acá automáticamente cuando generan una necesidad de compra.
          </p>
        </section>
      ) : null}

      {!foodLoading && !stateLoading && shoppingItems.length > 0 ? (
        <>
          <section className={styles.groupingBar} aria-label="Agrupamiento de la lista de compras">
            <span>Agrupar por</span>
            <div className={styles.segmentedControl} role="group" aria-label="Agrupar compras por">
              <button
                type="button"
                className={groupingMode === 'place' ? styles.activeSegment : ''}
                aria-pressed={groupingMode === 'place'}
                onClick={() => setGroupingMode('place')}
              >
                <FiMapPin aria-hidden="true" />
                Lugar
              </button>
              <button
                type="button"
                className={groupingMode === 'recipe' ? styles.activeSegment : ''}
                aria-pressed={groupingMode === 'recipe'}
                onClick={() => setGroupingMode('recipe')}
              >
                <FiBookOpen aria-hidden="true" />
                Receta
              </button>
            </div>
          </section>

          {groupingMode === 'place' ? (
            <div className={styles.placeList}>
              {placeGroups.map((placeGroup) => {
                const placeCheckedCount = placeGroup.items.filter((item) =>
                  isShoppingItemChecked(item, shoppingState),
                ).length;

                return (
                  <section key={placeGroup.key} className={styles.placeSection}>
                    <header className={styles.placeHeader}>
                      <div>
                        <FiMapPin aria-hidden="true" />
                        <div>
                          <h3>{placeGroup.label}</h3>
                          <p>
                            {placeCheckedCount}/{placeGroup.items.length} comprados
                          </p>
                        </div>
                      </div>
                    </header>

                    <ul className={styles.itemsList}>
                      {placeGroup.items.map((item) => (
                        <ShoppingItemRow
                          key={item.itemKey}
                          item={item}
                          shoppingState={shoppingState}
                          updatingItemKey={updatingItemKey}
                          onToggle={handleToggle}
                          detail={item.sources.join(' · ')}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className={styles.placeList}>
              {recipeGroups.map((recipeGroup) => {
                const RecipeGroupIcon = getRecipeGroupIcon(recipeGroup.type);
                const recipeCheckedCount = recipeGroup.items.filter(({ item }) =>
                  isShoppingItemChecked(item, shoppingState),
                ).length;

                return (
                  <section key={recipeGroup.key} className={styles.placeSection}>
                    <header className={styles.placeHeader}>
                      <div>
                        <RecipeGroupIcon aria-hidden="true" />
                        <div>
                          <h3>{recipeGroup.label}</h3>
                          <p>
                            {recipeCheckedCount}/{recipeGroup.items.length} comprados
                          </p>
                        </div>
                      </div>
                    </header>

                    <ul className={styles.itemsList}>
                      {recipeGroup.items.map(({ item, quantityLabel, details }) => {
                        const detailParts = [
                          details.length > 0 ? details.join(' · ') : '',
                          item.purchasePlace || 'Sin lugar asignado',
                        ].filter(Boolean);
                        const isShared = (item.sourceGroups || []).length > 1;

                        return (
                          <ShoppingItemRow
                            key={`${recipeGroup.key}:${item.itemKey}`}
                            item={item}
                            shoppingState={shoppingState}
                            updatingItemKey={updatingItemKey}
                            onToggle={handleToggle}
                            detail={detailParts.join(' · ')}
                            quantityLabel={quantityLabel}
                            showTotal={isShared}
                          />
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

export default ShoppingPage;
