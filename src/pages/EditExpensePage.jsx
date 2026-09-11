import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { updateExpense } from '@/services/firebase/expenseService';
import { getGroupMembers, isUserGroupMember } from '@/services/firebase/groupService';
import { useAuth } from '@/hooks/useAuth';
import { useExpense } from '@/hooks/useExpense';
import { useGroup } from '@/hooks/useGroup';
import { formatMoneyFromCents, parseMoneyToCents, splitAmountEqually } from '@/utils/moneyUtils';
import styles from './EditExpensePage.module.scss';

function EditExpensePage() {
  const navigate = useNavigate();
  const { groupId, expenseId } = useParams();

  const { currentUser } = useAuth();
  const { group, groupLoading, groupError, groupExists } = useGroup(groupId);
  const { expense, expenseLoading, expenseError, expenseExists } = useExpense(groupId, expenseId);

  const members = useMemo(() => getGroupMembers(group), [group]);
  const currentUserIsMember = isUserGroupMember(group, currentUser?.uid);

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    paidBy: '',
    participantIds: [],
  });

  const [formInitialized, setFormInitialized] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalAmountCents = parseMoneyToCents(formData.amount);
  const previewSharesMap = splitAmountEqually(totalAmountCents, formData.participantIds);

  const loading = groupLoading || expenseLoading;
  const canRenderForm = groupExists && expenseExists && currentUserIsMember;

  useEffect(() => {
    if (!expense || formInitialized) {
      return;
    }

    setFormData({
      description: expense.description || '',
      amount: String((Number(expense.totalAmountCents) || 0) / 100).replace('.', ','),
      paidBy: expense.paidBy || '',
      participantIds: expense.participantIds || [],
    });

    setFormInitialized(true);
  }, [expense, formInitialized]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleParticipantToggle = (memberId) => {
    setFormData((current) => {
      const isSelected = current.participantIds.includes(memberId);

      const nextParticipantIds = isSelected
        ? current.participantIds.filter((participantId) => participantId !== memberId)
        : [...current.participantIds, memberId];

      return {
        ...current,
        participantIds: nextParticipantIds,
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setIsSubmitting(true);

    try {
      await updateExpense({
        groupId,
        expenseId,
        description: formData.description,
        totalAmountCents,
        paidBy: formData.paidBy,
        participantIds: formData.participantIds,
        membersMap: group.membersMap,
      });

      navigate(`/viajes/${groupId}/gastos`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo editar el gasto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className={styles.page}>
        <article className={styles.statusCard}>
          <h1>Cargando gasto...</h1>
        </article>
      </section>
    );
  }

  if (groupError || expenseError || !canRenderForm) {
    return (
      <section className={styles.page}>
        <button type="button" className={styles.backButton} onClick={() => navigate(`/viajes/${groupId}/gastos`)}>
          <FiArrowLeft aria-hidden="true" />
          Volver a gastos
        </button>

        <article className={styles.statusCard}>
          <h1>No se puede editar el gasto</h1>
          <p>
            {groupError ||
              expenseError ||
              'El viaje o el gasto no existen, o no tenés permisos para verlos.'}
          </p>
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
          <p className={styles.eyebrow}>Editar gasto</p>
          <h1>{expense.description}</h1>
          <p>Modificá quién pagó y entre quiénes se divide. El balance se recalcula automáticamente.</p>
        </div>

        <label className={styles.field}>
          <span>Descripción</span>
          <input
            type="text"
            name="description"
            placeholder="Ej: Supermercado"
            value={formData.description}
            onChange={handleChange}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Monto</span>
          <input
            type="text"
            name="amount"
            inputMode="decimal"
            placeholder="Ej: 25000"
            value={formData.amount}
            onChange={handleChange}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Pagado por</span>
          <select name="paidBy" value={formData.paidBy} onChange={handleChange} required>
            {members.map((member) => (
              <option key={member.uid} value={member.uid}>
                {member.displayName || member.email || 'Usuario'}
              </option>
            ))}
          </select>
        </label>

        <fieldset className={styles.participantsBox}>
          <legend>Participantes del gasto</legend>

          <div className={styles.participantsList}>
            {members.map((member) => {
              const isChecked = formData.participantIds.includes(member.uid);
              const shareCents = previewSharesMap[member.uid] || 0;

              return (
                <label key={member.uid} className={styles.participantItem}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleParticipantToggle(member.uid)}
                  />

                  <span className={styles.participantName}>
                    {member.displayName || member.email || 'Usuario'}
                  </span>

                  <span className={styles.sharePreview}>
                    {isChecked && totalAmountCents > 0
                      ? formatMoneyFromCents(shareCents)
                      : 'No participa'}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {error ? <p className={styles.error}>{error}</p> : null}

        <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
          <FiCheck aria-hidden="true" />
          {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </section>
  );
}

export default EditExpensePage;