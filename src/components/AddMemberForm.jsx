import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { addManualMemberToGroup } from '@/services/firebase/groupService';
import styles from './AddMemberForm.module.scss';

function AddMemberForm({ groupId }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await addManualMemberToGroup({
        groupId,
        name: formData.name,
        email: formData.email,
      });

      setFormData({
        name: '',
        email: '',
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo agregar el participante.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Nombre</span>
          <input
            type="text"
            name="name"
            placeholder="Ej: Juan"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Email opcional</span>
          <input
            type="email"
            name="email"
            placeholder="juan@email.com"
            value={formData.email}
            onChange={handleChange}
          />
        </label>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
        <FiPlus aria-hidden="true" />
        {isSubmitting ? 'Agregando...' : 'Agregar participante'}
      </button>
    </form>
  );
}

export default AddMemberForm;