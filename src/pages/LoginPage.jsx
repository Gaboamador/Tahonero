import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { loginWithEmail, loginWithGoogle } from '@/services/firebase/authService';
import { useAuth } from '@/hooks/useAuth';
import styles from './AuthPage.module.scss';

function LoginPage() {
  const { isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleEmailLogin = async (event) => {
    event.preventDefault();

    setError('');
    setIsSubmitting(true);

    try {
      await loginWithEmail(formData);
    } catch (err) {
      console.error(err);
      setError('No se pudo iniciar sesión. Revisá el email y la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      await loginWithGoogle();
    } catch (err) {
      console.error(err);
      setError('No se pudo iniciar sesión con Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.authPage}>
      <section className={styles.card}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>Tahonero</p>
          <h1>Iniciar sesión</h1>
          <p>Entrá para cargar gastos compartidos y ver quién le debe a quién.</p>
        </div>

        <form className={styles.form} onSubmit={handleEmailLogin}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Contraseña</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </label>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className={styles.separator}>
          <span>o</span>
        </div>

        <button
          type="button"
          className={styles.googleButton}
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
        >
          <FcGoogle aria-hidden="true" />
          Continuar con Google
        </button>

        <p className={styles.footerText}>
          ¿No tenés cuenta? <Link to="/registro">Crear cuenta</Link>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;