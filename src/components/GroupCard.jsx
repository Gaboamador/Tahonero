import { Link } from 'react-router-dom';
import { FiArrowRight, FiCalendar, FiUsers } from 'react-icons/fi';
import { formatTripDateRange } from '@/utils/tripUtils';
import styles from './GroupCard.module.scss';

function GroupCard({ group }) {
  const membersCount = Object.keys(group.membersMap || {}).length;

  return (
    <article className={styles.card}>
      <div className={styles.iconBox}>
        <FiUsers aria-hidden="true" />
      </div>

      <div className={styles.content}>
        <h2>{group.name}</h2>

        {group.description ? <p>{group.description}</p> : <p>Viaje compartido.</p>}

        <div className={styles.metaRow}>
          <span className={styles.meta}>
            {membersCount === 1 ? '1 participante' : `${membersCount} participantes`}
          </span>
          <span className={styles.meta}>
            <FiCalendar aria-hidden="true" />
            {formatTripDateRange(group.startDate, group.endDate)}
          </span>
        </div>
      </div>

      <Link to={`/viajes/${group.id}`} className={styles.link}>
        Abrir
        <FiArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}

export default GroupCard;
