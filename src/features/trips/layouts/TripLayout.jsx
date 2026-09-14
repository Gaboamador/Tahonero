import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCalendar,
  FiCoffee,
  FiDollarSign,
  FiHome,
  FiPackage,
  FiSettings,
  FiShoppingCart,
  FiUsers,
} from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { useGroup } from '@/hooks/useGroup';
import { isUserGroupMember } from '@/services/firebase/groupService';
import { formatTripDateRange, getTripDaysCount } from '@/utils/tripUtils';
import styles from './TripLayout.module.scss';

function TripLayout() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { currentUser } = useAuth();
  const { group, groupLoading, groupError, groupExists } = useGroup(groupId);

  const currentUserIsMember = isUserGroupMember(group, currentUser?.uid);

  if (groupLoading) {
    return (
      <section className={styles.page}>
        <article className={styles.statusCard}>
          <h1>Cargando viaje...</h1>
        </article>
      </section>
    );
  }

  if (groupError || !groupExists || !currentUserIsMember) {
    return (
      <section className={styles.page}>
        <button type="button" className={styles.backButton} onClick={() => navigate('/')}>
          <FiArrowLeft aria-hidden="true" />
          Volver
        </button>

        <article className={styles.statusCard}>
          <h1>Viaje no disponible</h1>
          <p>{groupError || 'El viaje no existe o no tenés permisos para verlo.'}</p>
        </article>
      </section>
    );
  }

  const daysCount = getTripDaysCount(group.startDate, group.endDate);

  return (
    <section className={styles.page}>
      <button type="button" className={styles.backButton} onClick={() => navigate('/')}>
        <FiArrowLeft aria-hidden="true" />
        Todos los viajes
      </button>

      <header className={styles.tripHeader}>
        <div className={styles.tripInfo}>
          <p className={styles.eyebrow}>Viaje</p>
          <h1>{group.name}</h1>
          <p>{group.description || 'Viaje compartido.'}</p>

          <div className={styles.dateRow}>
            <FiCalendar aria-hidden="true" />
            <span>{formatTripDateRange(group.startDate, group.endDate)}</span>
            {daysCount > 0 ? (
              <span className={styles.daysBadge}>
                {daysCount} {daysCount === 1 ? 'día' : 'días'}
              </span>
            ) : null}
          </div>
        </div>

        <NavLink to={`/viajes/${group.id}/editar`} className={styles.settingsLink}>
          <FiSettings aria-hidden="true" />
          Configurar viaje
        </NavLink>
      </header>

      <nav className={styles.tripNav} aria-label="Secciones del viaje">
        <NavLink
          end
          to={`/viajes/${group.id}`}
          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.activeNavLink : ''}`}
        >
          <FiHome aria-hidden="true" />
          Inicio
        </NavLink>

        <NavLink
          to={`/viajes/${group.id}/gastos`}
          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.activeNavLink : ''}`}
        >
          <FiDollarSign aria-hidden="true" />
          Gastos
        </NavLink>

        <NavLink
          to={`/viajes/${group.id}/comidas`}
          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.activeNavLink : ''}`}
        >
          <FiCoffee aria-hidden="true" />
          Comidas
        </NavLink>

        <NavLink
          to={`/viajes/${group.id}/compras`}
          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.activeNavLink : ''}`}
        >
          <FiShoppingCart aria-hidden="true" />
          Compras
        </NavLink>

        <NavLink
          to={`/viajes/${group.id}/empanadas`}
          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.activeNavLink : ''}`}
        >
          <FiPackage aria-hidden="true" />
          Empanadas
        </NavLink>

        <NavLink
          to={`/viajes/${group.id}/participantes`}
          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.activeNavLink : ''}`}
        >
          <FiUsers aria-hidden="true" />
          Participantes
        </NavLink>
      </nav>

      <Outlet context={{ group }} />
    </section>
  );
}

export default TripLayout;
