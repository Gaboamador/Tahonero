import { Link, useOutletContext } from 'react-router-dom';
import {
  FiCalendar,
  FiChevronRight,
  FiCoffee,
  FiDollarSign,
  FiPackage,
  FiShoppingCart,
  FiUsers,
} from 'react-icons/fi';
import { getGroupMembers } from '@/services/firebase/groupService';
import { formatTripDateRange, getTripDaysCount, getTripMealSlots } from '@/utils/tripUtils';
import styles from './TripDashboardPage.module.scss';

function TripDashboardPage() {
  const { group } = useOutletContext();
  const members = getGroupMembers(group);
  const daysCount = getTripDaysCount(group.startDate, group.endDate);
  const hasDates = daysCount > 0;
  const mealSlots = getTripMealSlots({
    startDate: group.startDate,
    endDate: group.endDate,
    firstMeal: group.firstMeal || 'lunch',
    lastMeal: group.lastMeal || 'dinner',
  });

  return (
    <div className={styles.page}>
      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <FiCalendar aria-hidden="true" />
          <div>
            <span>Fechas</span>
            <strong>{formatTripDateRange(group.startDate, group.endDate)}</strong>
            <small>{hasDates ? `${daysCount} ${daysCount === 1 ? 'día' : 'días'} · ${mealSlots.length} comidas planificables` : 'Podés cargarlas desde Configurar viaje'}</small>
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

      <section className={styles.modulesSection}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Servicios</p>
            <h2>Módulos del viaje</h2>
          </div>
          <p>Cada módulo comparte el mismo viaje y sus participantes.</p>
        </div>

        <div className={styles.modulesGrid}>
          <Link to={`/viajes/${group.id}/gastos`} className={styles.moduleCard}>
            <div className={styles.moduleIcon}>
              <FiDollarSign aria-hidden="true" />
            </div>
            <div className={styles.moduleContent}>
              <span className={styles.availableBadge}>Disponible</span>
              <h3>Gastos</h3>
              <p>Dividí gastos, registrá pagos y consultá quién le debe a quién.</p>
            </div>
            <FiChevronRight className={styles.moduleArrow} aria-hidden="true" />
          </Link>

          <Link to={`/viajes/${group.id}/comidas`} className={styles.moduleCard}>
            <div className={styles.moduleIcon}>
              <FiCoffee aria-hidden="true" />
            </div>
            <div className={styles.moduleContent}>
              <span className={styles.availableBadge}>Disponible</span>
              <h3>Comidas</h3>
              <p>Planificá almuerzos, cenas, recetas, extras y bebidas del viaje.</p>
            </div>
            <FiChevronRight className={styles.moduleArrow} aria-hidden="true" />
          </Link>

          <article className={`${styles.moduleCard} ${styles.disabledModule}`}>
            <div className={styles.moduleIcon}>
              <FiShoppingCart aria-hidden="true" />
            </div>
            <div className={styles.moduleContent}>
              <span className={styles.soonBadge}>Próximamente</span>
              <h3>Compras</h3>
              <p>Generá la lista de ingredientes a partir del plan de comidas.</p>
            </div>
          </article>

          <article className={`${styles.moduleCard} ${styles.disabledModule}`}>
            <div className={styles.moduleIcon}>
              <FiPackage aria-hidden="true" />
            </div>
            <div className={styles.moduleContent}>
              <span className={styles.soonBadge}>Próximamente</span>
              <h3>Empanadas</h3>
              <p>Cada participante carga cantidades y gustos; el viaje consolida el pedido.</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export default TripDashboardPage;
