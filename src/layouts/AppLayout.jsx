import { NavLink, Outlet } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import { logout } from '@/services/firebase/authService';
import { useAuth } from '@/hooks/useAuth';
import styles from './AppLayout.module.scss';

function AppLayout() {
  const { currentUser } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand}>
          <img
            src="/icons/icon_variante.svg"
            alt=""
            className={styles.brandIcon}
            aria-hidden="true"
          />

          <span>TAHONERO</span>
        </NavLink>

        <div className={styles.userArea}>
          <span className={styles.userName}>
            {currentUser?.displayName || currentUser?.email || 'Usuario'}
          </span>

          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            <FiLogOut aria-hidden="true" />
            Salir
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;