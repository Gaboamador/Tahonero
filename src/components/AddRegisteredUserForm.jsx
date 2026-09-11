import { useState } from 'react';
import { FiUserPlus } from 'react-icons/fi';
import { addRegisteredUserToGroup } from '@/services/firebase/groupService';
import styles from './AddRegisteredUserForm.module.scss';

function AddRegisteredUserForm({ group }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage('');
    setError('');
    setIsSubmitting(true);

    try {
      const member = await addRegisteredUserToGroup({
        group,
        email,
      });

      setEmail('');
      setMessage(`${member.displayName || member.email} fue agregado al viaje.`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo agregar el participante.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>Agregar participante registrado por email</span>
        <input
          type="email"
          placeholder="usuario@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      {message ? <p className={styles.success}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
        <FiUserPlus aria-hidden="true" />
        {isSubmitting ? 'Agregando...' : 'Agregar participante'}
      </button>
    </form>
  );
}

export default AddRegisteredUserForm;