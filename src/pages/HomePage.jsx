import { Link } from 'react-router-dom';
import { FiBookOpen, FiMap, FiPackage, FiPlusCircle, FiRepeat } from 'react-icons/fi';
import GroupCard from '@/components/GroupCard';
import { useAuth } from '@/hooks/useAuth';
import { useUserGroups } from '@/hooks/useUserGroups';
import styles from './HomePage.module.scss';

function HomePage() {
  const { currentUser, userProfile } = useAuth();
  const { groups, groupsLoading, groupsError, hasGroups } = useUserGroups();

  const displayName =
    userProfile?.displayName || currentUser?.displayName || currentUser?.email || 'Usuario';

  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Inicio</p>
          <h1>Hola, {displayName}</h1>
          <p>
            Acá aparecen tus viajes compartidos. Cada viaje va a reunir gastos, participantes y
            los próximos módulos de organización.
          </p>
        </div>

        <div className={styles.heroActions}>
          <Link to="/biblioteca-comidas" className={styles.secondaryAction}>
            <FiBookOpen aria-hidden="true" />
            Biblioteca de comidas
          </Link>

          <Link to="/biblioteca-recurrentes" className={styles.secondaryAction}>
            <FiRepeat aria-hidden="true" />
            Recurrentes
          </Link>

          <Link to="/biblioteca-empanadas" className={styles.secondaryAction}>
            <FiPackage aria-hidden="true" />
            Locales de empanadas
          </Link>

          <Link to="/viajes/nuevo" className={styles.primaryAction}>
            <FiPlusCircle aria-hidden="true" />
            Crear viaje
          </Link>
        </div>
      </div>

      {groupsError ? <p className={styles.error}>{groupsError}</p> : null}

      {groupsLoading ? (
        <article className={styles.emptyState}>
          <h2>Cargando viajes...</h2>
        </article>
      ) : null}

      {!groupsLoading && !hasGroups ? (
        <article className={styles.emptyState}>
          <FiMap aria-hidden="true" />
          <h2>Todavía no hay viajes</h2>
          <p>Creá tu primer viaje para empezar a organizarlo con el grupo.</p>
        </article>
      ) : null}

      {!groupsLoading && hasGroups ? (
        <div className={styles.groupsGrid}>
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default HomePage;
