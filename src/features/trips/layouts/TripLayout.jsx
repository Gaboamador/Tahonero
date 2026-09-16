import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiSettings } from 'react-icons/fi';
import { TRIP_MODULES } from '@/features/trips/constants/tripModules';
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
        <button type="button" className={styles.fallbackBackButton} onClick={() => navigate('/')}>
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
      <header className={styles.tripBar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate('/')}
          aria-label="Volver a todos los viajes"
        >
          <FiArrowLeft aria-hidden="true" />
          <span>Viajes</span>
        </button>

        <div className={styles.tripContext}>
          <strong>{group.name}</strong>
          <span>
            {formatTripDateRange(group.startDate, group.endDate)}
            {daysCount > 0 ? ` · ${daysCount} ${daysCount === 1 ? 'día' : 'días'}` : ''}
          </span>
        </div>

        <NavLink
          to={`/viajes/${group.id}/editar`}
          className={styles.settingsLink}
          aria-label="Configurar viaje"
        >
          <FiSettings aria-hidden="true" />
          <span>Configurar</span>
        </NavLink>
      </header>

      <nav className={styles.tripNav} aria-label="Módulos del viaje">
        {TRIP_MODULES.map((module) => {
          const Icon = module.icon;
          const to = module.path
            ? `/viajes/${group.id}/${module.path}`
            : `/viajes/${group.id}`;

          return (
            <NavLink
              key={module.id}
              end={module.id === 'summary'}
              to={to}
              data-module={module.id}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.activeNavLink : ''}`
              }
            >
              <Icon aria-hidden="true" />
              {module.label}
            </NavLink>
          );
        })}
      </nav>

      <Outlet context={{ group }} />
    </section>
  );
}

export default TripLayout;
