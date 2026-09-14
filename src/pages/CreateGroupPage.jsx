import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { createGroup } from '@/services/firebase/groupService';
import { useAuth } from '@/hooks/useAuth';
import styles from './CreateGroupPage.module.scss';

function CreateGroupPage() {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    firstMeal: 'lunch',
    lastMeal: 'dinner',
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedUserProfile = userProfile || {
    uid: currentUser?.uid,
    displayName: currentUser?.displayName || '',
    email: currentUser?.email || '',
    photoURL: currentUser?.photoURL || '',
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setIsSubmitting(true);

    try {
      const group = await createGroup({
        name: formData.name,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        firstMeal: formData.firstMeal,
        lastMeal: formData.lastMeal,
        userProfile: resolvedUserProfile,
      });

      navigate(`/viajes/${group.id}`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo crear el viaje.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.page}>
      <button type="button" className={styles.backButton} onClick={() => navigate('/')}>
        <FiArrowLeft aria-hidden="true" />
        Volver
      </button>

      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>Nuevo viaje</p>
          <h1>Crear viaje</h1>
          <p>
            Esta va a ser la base compartida para gastos, comidas, compras y los demás módulos del viaje.
          </p>
        </div>

        <label className={styles.field}>
          <span>Nombre del viaje</span>
          <input
            type="text"
            name="name"
            placeholder="Ej: Bariloche 2027"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Descripción opcional</span>
          <textarea
            name="description"
            placeholder="Ej: Viaje de verano con amigos"
            rows={4}
            value={formData.description}
            onChange={handleChange}
          />
        </label>

        <div className={styles.dateFields}>
          <label className={styles.field}>
            <span>Fecha de inicio</span>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Fecha de fin</span>
            <input
              type="date"
              name="endDate"
              min={formData.startDate || undefined}
              value={formData.endDate}
              onChange={handleChange}
              required
            />
          </label>
        </div>

        <div className={styles.dateFields}>
          <label className={styles.field}>
            <span>Primera comida del viaje</span>
            <select name="firstMeal" value={formData.firstMeal} onChange={handleChange}>
              <option value="lunch">Almuerzo</option>
              <option value="dinner">Cena</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Última comida del viaje</span>
            <select name="lastMeal" value={formData.lastMeal} onChange={handleChange}>
              <option value="lunch">Almuerzo</option>
              <option value="dinner">Cena</option>
            </select>
          </label>
        </div>

        <p className={styles.hint}>
          Esto permite, por ejemplo, empezar el viaje un lunes a la noche o terminarlo un viernes después del almuerzo.
        </p>

        {error ? <p className={styles.error}>{error}</p> : null}

        <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
          <FiCheck aria-hidden="true" />
          {isSubmitting ? 'Creando...' : 'Crear viaje'}
        </button>
      </form>
    </section>
  );
}

export default CreateGroupPage;
