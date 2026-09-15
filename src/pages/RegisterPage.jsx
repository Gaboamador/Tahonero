import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { loginWithGoogle, registerWithEmail } from '@/services/firebase/authService';
import { useAuth } from '@/hooks/useAuth';
import styles from './AuthPage.module.scss';

function RegisterPage() {
  const { isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
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

  const handleRegister = async (event) => {
    event.preventDefault();

    setError('');
    setIsSubmitting(true);

    try {
      await registerWithEmail(formData);
    } catch (err) {
      console.error(err);
      setError('No se pudo crear la cuenta. Revisá los datos e intentá de nuevo.');
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
      setError('No se pudo continuar con Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.authPage}>
      <section className={styles.card}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>Tahonero</p>
          <h1>Crear cuenta</h1>
          <p>Creá tu usuario para empezar a dividir gastos sin límites diarios.</p>
        </div>

        <form className={styles.form} onSubmit={handleRegister}>
          <label className={styles.field}>
            <span>Nombre</span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </label>

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
              autoComplete="new-password"
              minLength={6}
              value={formData.password}
              onChange={handleChange}
              required
            />
          </label>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
            {isSubmitting ? 'Creando...' : 'Crear cuenta'}
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
          ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </section>
    </main>
  );
}

export default RegisterPage;