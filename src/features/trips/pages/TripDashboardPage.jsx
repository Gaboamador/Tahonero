import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  FiAlertTriangle,
  FiArchive,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiCoffee,
  FiDollarSign,
  FiMapPin,
  FiPackage,
  FiShoppingCart,
  FiUsers,
} from 'react-icons/fi';
import { useEmpanadaModuleData } from '@/features/empanadas/hooks/useEmpanadaModuleData';
import { getOrderTotal } from '@/features/empanadas/utils/empanadaUtils';
import { useTripLeftovers } from '@/features/leftovers/hooks/useTripLeftovers';
import { buildLeftoverSummary } from '@/features/leftovers/utils/tripLeftoversUtils';
import { MEAL_TYPE_LABELS } from '@/features/meals/constants/mealConstants';
import { useMealModuleData } from '@/features/meals/hooks/useMealModuleData';
import { useShoppingState } from '@/features/shopping/hooks/useShoppingState';
import {
  buildShoppingList,
  isShoppingItemChecked,
} from '@/features/shopping/utils/shoppingUtils';
import { useGroupExpenses } from '@/hooks/useGroupExpenses';
import { getGroupMembers } from '@/services/firebase/groupService';
import { getGroupBalanceSummary } from '@/utils/balanceUtils';
import { formatMoneyFromCents } from '@/utils/moneyUtils';
import {
  formatTripDateRange,
  formatTripDay,
  getTripDaysCount,
  getTripMealSlots,
} from '@/utils/tripUtils';
import styles from './TripDashboardPage.module.scss';

function capitalize(value) {
  const text = String(value || '');
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
}

function formatMissingMeal(slot) {
  return `${capitalize(formatTripDay(slot.date))} · ${MEAL_TYPE_LABELS[slot.mealType]}`;
}

function getLocalDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function TripDashboardPage() {
  const { group } = useOutletContext();
  const members = useMemo(() => getGroupMembers(group), [group]);
  const daysCount = getTripDaysCount(group.startDate, group.endDate);
  const hasDates = daysCount > 0;
  const mealSlots = useMemo(
    () =>
      getTripMealSlots({
        startDate: group.startDate,
        endDate: group.endDate,
        firstMeal: group.firstMeal || 'lunch',
        lastMeal: group.lastMeal || 'dinner',
      }),
    [group.startDate, group.endDate, group.firstMeal, group.lastMeal],
  );

  const {
    expenses,
    expensesLoading,
    expensesError,
  } = useGroupExpenses(group.id);
  const {
    meals,
    mealPlan,
    foodExtras,
    drinkPlans,
    isLoading: mealsLoading,
    error: mealsError,
  } = useMealModuleData(group.id);
  const {
    shoppingState,
    isLoading: shoppingStateLoading,
    error: shoppingStateError,
  } = useShoppingState(group.id);
  const {
    config: empanadaConfig,
    orders: empanadaOrders,
    isLoading: empanadasLoading,
    error: empanadasError,
  } = useEmpanadaModuleData(group.id);
  const {
    records: leftoverRecords,
    isLoading: leftoversLoading,
    error: leftoversError,
  } = useTripLeftovers(group.id);

  const balanceSummary = useMemo(
    () => getGroupBalanceSummary({ expenses, membersMap: group.membersMap || {} }),
    [expenses, group.membersMap],
  );

  const currentMealSlotIds = useMemo(
    () => new Set(mealSlots.map((slot) => slot.id)),
    [mealSlots],
  );
  const definedMealSlotIds = useMemo(
    () =>
      new Set(
        mealPlan
          .filter((plan) => currentMealSlotIds.has(plan.id))
          .map((plan) => plan.id),
      ),
    [mealPlan, currentMealSlotIds],
  );
  const missingMealSlots = useMemo(
    () => mealSlots.filter((slot) => !definedMealSlotIds.has(slot.id)),
    [mealSlots, definedMealSlotIds],
  );
  const plannedMealsCount = mealSlots.length - missingMealSlots.length;

  const shoppingItems = useMemo(
    () =>
      buildShoppingList({
        meals,
        mealPlan,
        foodExtras,
        drinkPlans,
        participantCount: members.length,
        tripDaysCount: daysCount,
      }),
    [meals, mealPlan, foodExtras, drinkPlans, members.length, daysCount],
  );
  const checkedShoppingCount = useMemo(
    () => shoppingItems.filter((item) => isShoppingItemChecked(item, shoppingState)).length,
    [shoppingItems, shoppingState],
  );
  const pendingShoppingCount = shoppingItems.length - checkedShoppingCount;
  const unassignedPlaceCount = shoppingItems.filter((item) => !item.purchasePlace).length;
  const leftoverSummary = useMemo(
    () => buildLeftoverSummary({ shoppingItems, shoppingState, records: leftoverRecords }),
    [shoppingItems, shoppingState, leftoverRecords],
  );
  const tripHasEnded = Boolean(group.endDate) && getLocalDateString() >= group.endDate;

  const ordersByMember = useMemo(
    () => Object.fromEntries(empanadaOrders.map((order) => [order.memberId, order])),
    [empanadaOrders],
  );
  const pendingEmpanadaMembers = useMemo(
    () => members.filter((member) => ordersByMember[member.memberId]?.isFinalized !== true),
    [members, ordersByMember],
  );
  const allEmpanadaOrdersFinalized =
    Boolean(empanadaConfig) && members.length > 0 && pendingEmpanadaMembers.length === 0;
  const totalEmpanadas = empanadaOrders.reduce((total, order) => total + getOrderTotal(order), 0);

  const shoppingLoading = mealsLoading || shoppingStateLoading;
  const dashboardLoading =
    expensesLoading || mealsLoading || shoppingStateLoading || empanadasLoading || leftoversLoading;

  const alerts = useMemo(() => {
    const nextAlerts = [];

    if (!hasDates) {
      nextAlerts.push({
        id: 'trip-dates',
        icon: FiCalendar,
        title: 'Faltan las fechas del viaje',
        detail: 'Configurá inicio, fin, primera comida y última comida para habilitar la planificación.',
        to: `/viajes/${group.id}/editar`,
        action: 'Configurar viaje',
      });
    }

    if (!mealsLoading && mealSlots.length > 0 && missingMealSlots.length > 0) {
      const preview = missingMealSlots.slice(0, 2).map(formatMissingMeal).join(' · ');
      const remaining = missingMealSlots.length - 2;

      nextAlerts.push({
        id: 'missing-meals',
        icon: FiCoffee,
        title: `${missingMealSlots.length} ${missingMealSlots.length === 1 ? 'comida pendiente' : 'comidas pendientes'}`,
        detail: `${preview}${remaining > 0 ? ` · y ${remaining} más` : ''}`,
        to: `/viajes/${group.id}/comidas`,
        action: 'Completar plan',
      });
    }

    if (!shoppingLoading && unassignedPlaceCount > 0) {
      nextAlerts.push({
        id: 'purchase-places',
        icon: FiMapPin,
        title: `${unassignedPlaceCount} ${unassignedPlaceCount === 1 ? 'producto sin lugar de compra' : 'productos sin lugar de compra'}`,
        detail: 'Asignales un lugar desde Comidas para que la lista de compras quede ordenada por comercio.',
        to: `/viajes/${group.id}/comidas`,
        action: 'Asignar lugares',
      });
    }

    if (!shoppingLoading && pendingShoppingCount > 0) {
      nextAlerts.push({
        id: 'pending-shopping',
        icon: FiShoppingCart,
        title: `${pendingShoppingCount} ${pendingShoppingCount === 1 ? 'producto pendiente de compra' : 'productos pendientes de compra'}`,
        detail: `${checkedShoppingCount} de ${shoppingItems.length} productos ya están marcados como comprados.`,
        to: `/viajes/${group.id}/compras`,
        action: 'Ver compras',
      });
    }

    if (!empanadasLoading && empanadaConfig && pendingEmpanadaMembers.length > 0) {
      const names = pendingEmpanadaMembers
        .map((member) => member.displayName || member.email || 'Usuario')
        .join(', ');

      nextAlerts.push({
        id: 'empanada-orders',
        icon: FiPackage,
        title: 'Pedido de empanadas incompleto',
        detail: `Falta cerrar: ${names}.`,
        to: `/viajes/${group.id}/empanadas`,
        action: 'Ver pedidos',
      });
    }

    if (!empanadasLoading && empanadaConfig && (empanadaConfig.mealSlotIds || []).length === 0) {
      nextAlerts.push({
        id: 'empanada-slots',
        icon: FiPackage,
        title: 'Empanadas sin comidas asignadas',
        detail: 'Elegí en qué almuerzos o cenas del viaje se van a repartir las empanadas.',
        to: `/viajes/${group.id}/empanadas`,
        action: 'Asignar comidas',
      });
    }

    if (
      tripHasEnded &&
      !shoppingLoading &&
      !leftoversLoading &&
      leftoverSummary.purchasedCount > 0 &&
      leftoverSummary.pendingCount > 0
    ) {
      nextAlerts.push({
        id: 'pending-leftovers',
        icon: FiArchive,
        title: `${leftoverSummary.pendingCount} ${leftoverSummary.pendingCount === 1 ? 'producto pendiente de revisar' : 'productos pendientes de revisar'} en Sobras`,
        detail: 'Registrá qué quedó de lo comprado para conservar una referencia útil para el próximo viaje.',
        to: `/viajes/${group.id}/sobras`,
        action: 'Revisar sobras',
      });
    }

    if (!expensesLoading && balanceSummary.settlements.length > 0) {
      nextAlerts.push({
        id: 'pending-settlements',
        icon: FiDollarSign,
        title: `${balanceSummary.settlements.length} ${balanceSummary.settlements.length === 1 ? 'deuda pendiente' : 'deudas pendientes'}`,
        detail: 'Hay balances que todavía necesitan liquidarse entre participantes.',
        to: `/viajes/${group.id}/gastos`,
        action: 'Ver balances',
      });
    }

    return nextAlerts;
  }, [
    hasDates,
    mealsLoading,
    mealSlots.length,
    missingMealSlots,
    shoppingLoading,
    unassignedPlaceCount,
    pendingShoppingCount,
    checkedShoppingCount,
    shoppingItems.length,
    empanadasLoading,
    empanadaConfig,
    pendingEmpanadaMembers,
    tripHasEnded,
    leftoversLoading,
    leftoverSummary.purchasedCount,
    leftoverSummary.pendingCount,
    expensesLoading,
    balanceSummary.settlements.length,
    group.id,
  ]);

  const dataErrors = [expensesError, mealsError, shoppingStateError, empanadasError, leftoversError].filter(Boolean);

  return (
    <div className={styles.page}>
      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <FiCalendar aria-hidden="true" />
          <div>
            <span>Fechas</span>
            <strong>{formatTripDateRange(group.startDate, group.endDate)}</strong>
            <small>
              {hasDates
                ? `${daysCount} ${daysCount === 1 ? 'día' : 'días'} · ${mealSlots.length} comidas planificables`
                : 'Podés cargarlas desde Configurar viaje'}
            </small>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <FiUsers aria-hidden="true" />
          <div>
            <span>Participantes</span>
            <strong>{members.length}</strong>
            <small>{members.length === 1 ? 'persona en el viaje' : 'personas en el viaje'}</small>
          </div>
        </article>
      </section>

      <section className={styles.statusSection}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Estado general</p>
            <h2>Cómo viene el viaje</h2>
          </div>
          <p>Resumen derivado de los módulos. Se actualiza automáticamente cuando cambian los datos.</p>
        </div>

        <div className={styles.statusGrid}>
          <Link to={`/viajes/${group.id}/gastos`} className={styles.statusCard} data-module="expenses">
            <div className={styles.statusIcon}>
              <FiDollarSign aria-hidden="true" />
            </div>
            <div className={styles.statusContent}>
              <span className={styles.statusLabel}>Gastos</span>
              {expensesLoading ? (
                <strong>Cargando...</strong>
              ) : expensesError ? (
                <strong>No disponible</strong>
              ) : (
                <>
                  <strong>{formatMoneyFromCents(balanceSummary.totalSpentCents)}</strong>
                  <small>
                    {balanceSummary.settlements.length === 0
                      ? 'Balances liquidados'
                      : `${balanceSummary.settlements.length} ${balanceSummary.settlements.length === 1 ? 'deuda pendiente' : 'deudas pendientes'}`}
                  </small>
                </>
              )}
            </div>
            <FiChevronRight className={styles.statusArrow} aria-hidden="true" />
          </Link>

          <Link to={`/viajes/${group.id}/comidas`} className={styles.statusCard} data-module="meals">
            <div className={styles.statusIcon}>
              <FiCoffee aria-hidden="true" />
            </div>
            <div className={styles.statusContent}>
              <span className={styles.statusLabel}>Comidas</span>
              {mealsLoading ? (
                <strong>Cargando...</strong>
              ) : mealsError ? (
                <strong>No disponible</strong>
              ) : mealSlots.length === 0 ? (
                <>
                  <strong>Sin calendario</strong>
                  <small>Faltan fechas para generar el plan</small>
                </>
              ) : (
                <>
                  <strong>{plannedMealsCount}/{mealSlots.length} definidas</strong>
                  <small>
                    {missingMealSlots.length === 0
                      ? 'Plan diario completo'
                      : `${missingMealSlots.length} ${missingMealSlots.length === 1 ? 'pendiente' : 'pendientes'}`}
                  </small>
                </>
              )}
            </div>
            <FiChevronRight className={styles.statusArrow} aria-hidden="true" />
          </Link>

          <Link to={`/viajes/${group.id}/compras`} className={styles.statusCard} data-module="shopping">
            <div className={styles.statusIcon}>
              <FiShoppingCart aria-hidden="true" />
            </div>
            <div className={styles.statusContent}>
              <span className={styles.statusLabel}>Compras</span>
              {shoppingLoading ? (
                <strong>Cargando...</strong>
              ) : mealsError || shoppingStateError ? (
                <strong>No disponible</strong>
              ) : shoppingItems.length === 0 ? (
                <>
                  <strong>Sin productos</strong>
                  <small>La lista se genera desde Comidas</small>
                </>
              ) : (
                <>
                  <strong>{checkedShoppingCount}/{shoppingItems.length} comprados</strong>
                  <small>
                    {pendingShoppingCount === 0
                      ? 'Lista completa'
                      : `${pendingShoppingCount} ${pendingShoppingCount === 1 ? 'pendiente' : 'pendientes'}`}
                  </small>
                </>
              )}
            </div>
            <FiChevronRight className={styles.statusArrow} aria-hidden="true" />
          </Link>

          <Link to={`/viajes/${group.id}/empanadas`} className={styles.statusCard} data-module="empanadas">
            <div className={styles.statusIcon}>
              <FiPackage aria-hidden="true" />
            </div>
            <div className={styles.statusContent}>
              <span className={styles.statusLabel}>Empanadas</span>
              {empanadasLoading ? (
                <strong>Cargando...</strong>
              ) : empanadasError ? (
                <strong>No disponible</strong>
              ) : !empanadaConfig ? (
                <>
                  <strong>Sin configurar</strong>
                  <small>Módulo opcional</small>
                </>
              ) : allEmpanadaOrdersFinalized ? (
                <>
                  <strong>Listo para pedir</strong>
                  <small>{totalEmpanadas} empanadas · {empanadaConfig.vendorName}</small>
                </>
              ) : (
                <>
                  <strong>Pedido incompleto</strong>
                  <small>
                    {pendingEmpanadaMembers.length} {pendingEmpanadaMembers.length === 1 ? 'persona pendiente' : 'personas pendientes'}
                  </small>
                </>
              )}
            </div>
            <FiChevronRight className={styles.statusArrow} aria-hidden="true" />
          </Link>

          <Link to={`/viajes/${group.id}/sobras`} className={styles.statusCard} data-module="leftovers">
            <div className={styles.statusIcon}>
              <FiArchive aria-hidden="true" />
            </div>
            <div className={styles.statusContent}>
              <span className={styles.statusLabel}>Sobras</span>
              {leftoversLoading || shoppingLoading ? (
                <strong>Cargando...</strong>
              ) : leftoversError || mealsError || shoppingStateError ? (
                <strong>No disponible</strong>
              ) : leftoverSummary.purchasedCount === 0 ? (
                <>
                  <strong>Sin compras para revisar</strong>
                  <small>Aparecen los productos marcados como comprados</small>
                </>
              ) : (
                <>
                  <strong>{leftoverSummary.reviewedCount}/{leftoverSummary.purchasedCount} revisados</strong>
                  <small>
                    {leftoverSummary.leftoverCount > 0
                      ? `${leftoverSummary.leftoverCount} ${leftoverSummary.leftoverCount === 1 ? 'producto con sobrante' : 'productos con sobrantes'}`
                      : leftoverSummary.pendingCount === 0
                        ? 'Sin sobrantes registrados'
                        : `${leftoverSummary.pendingCount} ${leftoverSummary.pendingCount === 1 ? 'pendiente' : 'pendientes'}`}
                  </small>
                </>
              )}
            </div>
            <FiChevronRight className={styles.statusArrow} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className={styles.alertsSection}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Atención</p>
            <h2>Próximas acciones</h2>
          </div>
          <p>Sólo aparecen temas que requieren una decisión o una acción dentro del viaje.</p>
        </div>

        {dashboardLoading ? (
          <div className={styles.alertsLoading}>Actualizando el estado del viaje...</div>
        ) : null}

        {!dashboardLoading && dataErrors.length > 0 ? (
          <div className={styles.dataWarning}>
            <FiAlertTriangle aria-hidden="true" />
            <p>No se pudo cargar una parte del estado. Podés entrar a cada módulo para reintentar.</p>
          </div>
        ) : null}

        {!dashboardLoading && dataErrors.length === 0 && alerts.length === 0 ? (
          <div className={styles.allGood}>
            <FiCheckCircle aria-hidden="true" />
            <div>
              <strong>Todo al día</strong>
              <p>No hay acciones pendientes detectadas en los módulos configurados.</p>
            </div>
          </div>
        ) : null}

        {!dashboardLoading && alerts.length > 0 ? (
          <div className={styles.alertsList}>
            {alerts.map((alert) => {
              const AlertIcon = alert.icon;

              return (
                <Link key={alert.id} to={alert.to} className={styles.alertCard}>
                  <div className={styles.alertIcon}>
                    <AlertIcon aria-hidden="true" />
                  </div>
                  <div className={styles.alertContent}>
                    <strong>{alert.title}</strong>
                    <p>{alert.detail}</p>
                  </div>
                  <span className={styles.alertAction}>
                    {alert.action}
                    <FiChevronRight aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default TripDashboardPage;
