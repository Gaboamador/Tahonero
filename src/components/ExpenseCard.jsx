import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCreditCard, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { TfiReceipt } from 'react-icons/tfi';
import { deleteExpense } from '@/services/firebase/expenseService';
import { formatMoneyFromCents } from '@/utils/moneyUtils';
import styles from './ExpenseCard.module.scss';

function ExpenseCard({ expense, groupId, membersMap }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const transactionType = expense.transactionType || 'expense';
  const isPayment = transactionType === 'payment';

  const participantNames = expense.participantIds
    ?.map((participantId) => {
      const member = membersMap?.[participantId];
      return member?.displayName || member?.email || 'Usuario';
    })
    .join(', ');

  const handleDelete = async () => {
    const label = isPayment ? expense.description : `el gasto "${expense.description}"`;

    const shouldDelete = window.confirm(
      `¿Borrar ${label}? Esta acción no se puede deshacer.`,
    );

    if (!shouldDelete) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteExpense({
        groupId,
        expenseId: expense.id,
      });
    } catch (error) {
      console.error(error);
      window.alert('No se pudo borrar el movimiento.');
      setIsDeleting(false);
    }
  };

  return (
    <article className={`${styles.card} ${isPayment ? styles.paymentCard : ''}`}>
      <div className={styles.iconBox}>
        {isPayment ? <FiCreditCard aria-hidden="true" /> : <TfiReceipt aria-hidden="true" />}
      </div>

      <div className={styles.content}>
        <div className={styles.titleRow}>
          <h3>{expense.description}</h3>
          <strong>{formatMoneyFromCents(expense.totalAmountCents, expense.currency)}</strong>
        </div>

        {isPayment ? (
          <p>
            <strong>{expense.fromName}</strong> le pagó a <strong>{expense.toName}</strong>
          </p>
        ) : (
          <>
            <p>
              Pagó <strong>{expense.paidByName}</strong>
            </p>

            <p className={styles.participants}>
              Participan <FiArrowRight aria-hidden="true" />{' '}
              {participantNames || 'Sin participantes'}
            </p>
          </>
        )}
      </div>

      <div className={styles.actions}>
        {!isPayment ? (
          <Link
            to={`/viajes/${groupId}/gastos/${expense.id}/editar`}
            className={styles.actionButton}
            aria-label={`Editar gasto ${expense.description}`}
          >
            <FiEdit2 aria-hidden="true" />
          </Link>
        ) : null}

        <button
          type="button"
          className={`${styles.actionButton} ${styles.deleteButton}`}
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label={`Borrar movimiento ${expense.description}`}
        >
          <FiTrash2 aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export default ExpenseCard;