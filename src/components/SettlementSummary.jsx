import { Link } from 'react-router-dom';
import { FiCheckCircle, FiCreditCard, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import { getGroupBalanceSummary, getMemberDisplayName } from '@/utils/balanceUtils';
import { formatMoneyFromCents } from '@/utils/moneyUtils';
import styles from './SettlementSummary.module.scss';

function SettlementSummary({ groupId, expenses, membersMap }) {
  const { balances, settlements, totalSpentCents, totalPaymentsCents, isSettled } =
    getGroupBalanceSummary({
      expenses,
      membersMap,
    });

  return (
    <div className={styles.summary}>
      <div className={styles.totalsGrid}>
        <div className={styles.totalCard}>
          <span>Total gastado</span>
          <strong>{formatMoneyFromCents(totalSpentCents)}</strong>
        </div>

        <div className={styles.totalCard}>
          <span>Pagos registrados</span>
          <strong>{formatMoneyFromCents(totalPaymentsCents)}</strong>
        </div>
      </div>

      <section className={styles.section}>
        <h3>Quién le paga a quién</h3>

        {isSettled ? (
          <div className={styles.settledBox}>
            <FiCheckCircle aria-hidden="true" />
            <p>Todos están en cero. No hay deudas pendientes.</p>
          </div>
        ) : (
          <ul className={styles.settlementsList}>
            {settlements.map((settlement) => (
              <li
                key={`${settlement.fromId}-${settlement.toId}-${settlement.amountCents}`}
                className={styles.settlementItem}
              >
                <span>
                  <strong>{getMemberDisplayName(settlement.fromMember)}</strong> le paga a{' '}
                  <strong>{getMemberDisplayName(settlement.toMember)}</strong>
                </span>

                <div className={styles.settlementActions}>
                  <strong>{formatMoneyFromCents(settlement.amountCents)}</strong>

                  <Link
                    to={`/viajes/${groupId}/pagos/nuevo?fromId=${settlement.fromId}&toId=${settlement.toId}&amountCents=${settlement.amountCents}`}
                    className={styles.paymentLink}
                  >
                    <FiCreditCard aria-hidden="true" />
                    Registrar pago
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h3>Balances individuales</h3>

        <ul className={styles.balancesList}>
          {balances.map((balance) => {
            const isPositive = balance.netCents > 0;
            const isNegative = balance.netCents < 0;
            const isNeutral = balance.netCents === 0;

            return (
              <li key={balance.memberId} className={styles.balanceItem}>
                <div>
                  <strong>{getMemberDisplayName(balance.member)}</strong>
                  <span>
                    Gastos pagados {formatMoneyFromCents(balance.expensePaidCents)} · Le
                    correspondía {formatMoneyFromCents(balance.owedCents)}
                  </span>

                  {balance.settlementPaidCents > 0 || balance.settlementReceivedCents > 0 ? (
                    <span>
                      Pagos realizados {formatMoneyFromCents(balance.settlementPaidCents)} · Pagos
                      recibidos {formatMoneyFromCents(balance.settlementReceivedCents)}
                    </span>
                  ) : null}
                </div>

                <div
                  className={[
                    styles.balanceAmount,
                    isPositive ? styles.positive : '',
                    isNegative ? styles.negative : '',
                    isNeutral ? styles.neutral : '',
                  ].join(' ')}
                >
                  {isPositive ? <FiTrendingUp aria-hidden="true" /> : null}
                  {isNegative ? <FiTrendingDown aria-hidden="true" /> : null}
                  <strong>{formatMoneyFromCents(balance.netCents)}</strong>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default SettlementSummary;