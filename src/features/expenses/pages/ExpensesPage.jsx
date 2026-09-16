import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { FiPlusCircle, FiTrendingUp } from 'react-icons/fi';
import { TfiReceipt } from 'react-icons/tfi';
import ExpenseCard from '@/components/ExpenseCard';
import SettlementSummary from '@/components/SettlementSummary';
import TripModuleHeader from '@/features/trips/components/TripModuleHeader';
import { useGroupExpenses } from '@/hooks/useGroupExpenses';
import styles from './ExpensesPage.module.scss';

const MOVEMENT_FILTERS = {
  all: 'all',
  expenses: 'expenses',
  payments: 'payments',
};

function getTransactionType(expense) {
  return expense.transactionType || 'expense';
}

function ExpensesPage() {
  const { group } = useOutletContext();
  const { expenses, expensesLoading, expensesError, hasExpenses } = useGroupExpenses(group.id);
  const [movementFilter, setMovementFilter] = useState(MOVEMENT_FILTERS.all);

  const movementCounts = useMemo(() => {
    return expenses.reduce(
      (counts, expense) => {
        const transactionType = getTransactionType(expense);
        counts.all += 1;

        if (transactionType === 'payment') {
          counts.payments += 1;
        } else {
          counts.expenses += 1;
        }

        return counts;
      },
      { all: 0, expenses: 0, payments: 0 },
    );
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    if (movementFilter === MOVEMENT_FILTERS.all) {
      return expenses;
    }

    if (movementFilter === MOVEMENT_FILTERS.payments) {
      return expenses.filter((expense) => getTransactionType(expense) === 'payment');
    }

    return expenses.filter((expense) => getTransactionType(expense) !== 'payment');
  }, [expenses, movementFilter]);

  const hasFilteredExpenses = filteredExpenses.length > 0;

  return (
    <div className={styles.page}>
      <TripModuleHeader
        moduleId="expenses"
        title="Gastos del viaje"
        description="Balances, movimientos y pagos entre participantes."
        action={
          <Link to={`/viajes/${group.id}/gastos/nuevo`} className={styles.primaryAction}>
            <FiPlusCircle aria-hidden="true" />
            Agregar gasto
          </Link>
        }
      />

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelIcon}>
            <FiTrendingUp aria-hidden="true" />
          </div>
          <div>
            <h3>Resumen</h3>
            <p>Balances simplificados entre los participantes.</p>
          </div>
        </div>

        {expensesLoading ? (
          <div className={styles.placeholderBox}><p>Cargando resumen...</p></div>
        ) : (
          <SettlementSummary groupId={group.id} expenses={expenses} membersMap={group.membersMap} />
        )}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelIcon}>
            <TfiReceipt aria-hidden="true" />
          </div>
          <div>
            <h3>Movimientos</h3>
            <p>Gastos y pagos registrados en este viaje.</p>
          </div>
        </div>

        <div className={styles.movementFilters} aria-label="Filtrar movimientos">
          <button
            type="button"
            className={movementFilter === MOVEMENT_FILTERS.all ? styles.activeFilter : ''}
            onClick={() => setMovementFilter(MOVEMENT_FILTERS.all)}
          >
            Todos <span>{movementCounts.all}</span>
          </button>
          <button
            type="button"
            className={movementFilter === MOVEMENT_FILTERS.expenses ? styles.activeFilter : ''}
            onClick={() => setMovementFilter(MOVEMENT_FILTERS.expenses)}
          >
            Gastos <span>{movementCounts.expenses}</span>
          </button>
          <button
            type="button"
            className={movementFilter === MOVEMENT_FILTERS.payments ? styles.activeFilter : ''}
            onClick={() => setMovementFilter(MOVEMENT_FILTERS.payments)}
          >
            Pagos <span>{movementCounts.payments}</span>
          </button>
        </div>

        {expensesError ? <p className={styles.error}>{expensesError}</p> : null}

        {expensesLoading ? (
          <div className={styles.placeholderBox}>
            <TfiReceipt aria-hidden="true" />
            <p>Cargando movimientos...</p>
          </div>
        ) : null}

        {!expensesLoading && !hasExpenses ? (
          <div className={styles.placeholderBox}>
            <TfiReceipt aria-hidden="true" />
            <p>Todavía no hay movimientos cargados.</p>
          </div>
        ) : null}

        {!expensesLoading && hasExpenses && !hasFilteredExpenses ? (
          <div className={styles.placeholderBox}>
            <TfiReceipt aria-hidden="true" />
            <p>No hay movimientos para este filtro.</p>
          </div>
        ) : null}

        {!expensesLoading && hasFilteredExpenses ? (
          <div className={styles.expensesList}>
            {filteredExpenses.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                groupId={group.id}
                membersMap={group.membersMap}
              />
            ))}
          </div>
        ) : null}
      </article>
    </div>
  );
}

export default ExpensesPage;
