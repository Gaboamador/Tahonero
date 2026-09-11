import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { createPayment } from '@/services/firebase/expenseService';
import { getGroupMembers, isUserGroupMember } from '@/services/firebase/groupService';
import { useAuth } from '@/hooks/useAuth';
import { useGroup } from '@/hooks/useGroup';
import { parseMoneyToCents } from '@/utils/moneyUtils';
import styles from './CreatePaymentPage.module.scss';

function CreatePaymentPage() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();

  const { currentUser } = useAuth();
  const { group, groupLoading, groupError, groupExists } = useGroup(groupId);

  const members = useMemo(() => getGroupMembers(group), [group]);
  const currentUserIsMember = isUserGroupMember(group, currentUser?.uid);

  const initialAmountCents = Number(searchParams.get('amountCents')) || 0;

  const [formData, setFormData] = useState({
    fromId: searchParams.get('fromId') || '',
    toId: searchParams.get('toId') || '',
    amount: initialAmountCents > 0 ? String(initialAmountCents / 100).replace('.', ',') : '',
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canRenderForm = groupExists && currentUserIsMember;

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
      await createPayment({
        groupId,
        fromId: formData.fromId,
        toId: formData.toId,
        totalAmountCents: parseMoneyToCents(formData.amount),
        membersMap: group.membersMap,
        createdBy: currentUser.uid,
      });

      navigate(`/viajes/${groupId}/gastos`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo registrar el pago.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (groupLoading) {
    return (
      <section className={styles.page}>
        <article className={styles.statusCard}>
          <h1>Cargando viaje...</h1>
        </article>
      </section>
    );
  }

  if (groupError || !canRenderForm) {
    return (
      <section className={styles.page}>
        <button type="button" className={styles.backButton} onClick={() => navigate('/')}>
          <FiArrowLeft aria-hidden="true" />
          Volver
        </button>

        <article className={styles.statusCard}>
          <h1>No se puede registrar el pago</h1>
          <p>{groupError || 'El viaje no existe o no tenés permisos para verlo.'}</p>
        </article>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <button type="button" className={styles.backButton} onClick={() => navigate(`/viajes/${groupId}/gastos`)}>
        <FiArrowLeft aria-hidden="true" />
        Volver a gastos
      </button>

      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>Registrar pago</p>
          <h1>Liquidar deuda</h1>
          <p>
            Registrá un pago entre miembros. Esto no suma al total gastado, sólo ajusta los balances.
          </p>
        </div>

        <label className={styles.field}>
          <span>Quién paga</span>
          <select name="fromId" value={formData.fromId} onChange={handleChange} required>
            <option value="">Elegir miembro</option>
            {members.map((member) => (
              <option key={member.uid} value={member.uid}>
                {member.displayName || member.email || 'Usuario'}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Quién recibe</span>
          <select name="toId" value={formData.toId} onChange={handleChange} required>
            <option value="">Elegir miembro</option>
            {members.map((member) => (
              <option key={member.uid} value={member.uid}>
                {member.displayName || member.email || 'Usuario'}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Monto</span>
          <input
            type="text"
            name="amount"
            inputMode="decimal"
            placeholder="Ej: 15000"
            value={formData.amount}
            onChange={handleChange}
            required
          />
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}

        <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
          <FiCheck aria-hidden="true" />
          {isSubmitting ? 'Registrando...' : 'Registrar pago'}
        </button>
      </form>
    </section>
  );
}

export default CreatePaymentPage;