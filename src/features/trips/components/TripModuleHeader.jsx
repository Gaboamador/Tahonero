import { getTripModule } from '@/features/trips/constants/tripModules';
import styles from './TripModuleHeader.module.scss';

function TripModuleHeader({ moduleId, title, description, action = null }) {
  const module = getTripModule(moduleId);
  const Icon = module?.icon;

  return (
    <header className={styles.header} data-module={moduleId}>
      <div className={styles.iconWrap}>{Icon ? <Icon aria-hidden="true" /> : null}</div>

      <div className={styles.content}>
        <span className={styles.label}>{module?.label || title}</span>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>

      {action ? <div className={styles.action}>{action}</div> : null}
    </header>
  );
}

export default TripModuleHeader;
