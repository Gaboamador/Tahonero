import { useEffect, useMemo, useState } from 'react';
import { FiArchive, FiCheck, FiCheckCircle, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { useOutletContext } from 'react-router-dom';
import { useTripLeftovers } from '@/features/leftovers/hooks/useTripLeftovers';
import {
  addManualLeftover,
  deleteTripLeftover,
  saveShoppingLeftoverReview,
} from '@/features/leftovers/services/tripLeftoversService';
import {
  buildLeftoverSummary,
  getAllLeftoverUnits,
  getCompatibleLeftoverUnits,
  getCurrentShoppingReview,
  getStaleShoppingReview,
} from '@/features/leftovers/utils/tripLeftoversUtils';
import { useMealModuleData } from '@/features/meals/hooks/useMealModuleData';
import { formatFoodQuantity } from '@/features/meals/utils/mealUtils';
import { useShoppingState } from '@/features/shopping/hooks/useShoppingState';
import { buildShoppingList } from '@/features/shopping/utils/shoppingUtils';
import TripModuleHeader from '@/features/trips/components/TripModuleHeader';
import { useAuth } from '@/hooks/useAuth';
import { getGroupMembers } from '@/services/firebase/groupService';
import { getTripDaysCount } from '@/utils/tripUtils';
import styles from './LeftoversPage.module.scss';

function PurchasedItemReview({ item, record, staleRecord, groupId, currentUserUid, onError }) {
  const [mode, setMode] = useState(record?.status || 'unreviewed');
  const [leftoverQuantity, setLeftoverQuantity] = useState(
    record?.status === 'leftover' ? String(record.leftoverQuantity || '') : '',
  );
  const [leftoverUnit, setLeftoverUnit] = useState(record?.leftoverUnit || item.unit);
  const [actualPurchasedQuantity, setActualPurchasedQuantity] = useState(
    record?.actualPurchasedQuantity > 0 ? String(record.actualPurchasedQuantity) : '',
  );
  const [actualPurchasedUnit, setActualPurchasedUnit] = useState(
    record?.actualPurchasedUnit || item.unit,
  );
  const [note, setNote] = useState(record?.note || '');
  const [showNoLeftoverDetails, setShowNoLeftoverDetails] = useState(
    record?.status === 'none' && (record.actualPurchasedQuantity > 0 || Boolean(record.note)),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMode(record?.status || 'unreviewed');
    setLeftoverQuantity(
      record?.status === 'leftover' ? String(record.leftoverQuantity || '') : '',
    );
    setLeftoverUnit(record?.leftoverUnit || item.unit);
    setActualPurchasedQuantity(
      record?.actualPurchasedQuantity > 0 ? String(record.actualPurchasedQuantity) : '',
    );
    setActualPurchasedUnit(record?.actualPurchasedUnit || item.unit);
    setNote(record?.note || '');
    setShowNoLeftoverDetails(
      record?.status === 'none' && (record.actualPurchasedQuantity > 0 || Boolean(record.note)),
    );
  }, [record, item.unit]);

  const compatibleUnits = getCompatibleLeftoverUnits(item.unit);

  const saveReview = async ({ nextStatus = mode } = {}) => {
    setIsSaving(true);
    onError('');

    try {
      await saveShoppingLeftoverReview({
        groupId,
        item,
        status: nextStatus,
        leftoverQuantity: nextStatus === 'leftover' ? leftoverQuantity : 0,
        leftoverUnit,
        actualPurchasedQuantity,
        actualPurchasedUnit,
        note,
        currentUserUid,
      });
      setMode(nextStatus);
    } catch (error) {
      console.error(error);
      onError(error.message || 'No se pudo guardar la revisión.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNoLeftover = () => {
    saveReview({ nextStatus: 'none' });
  };

  return (
    <article className={`${styles.reviewCard} ${record ? styles.reviewedCard : ''}`}>
      <div className={styles.productTopRow}>
        <div className={styles.productInfo}>
          <strong>{item.name}</strong>
          <span>
            Compra planificada: <b>{item.quantityLabel}</b>
            {item.purchasePlace ? ` · ${item.purchasePlace}` : ''}
          </span>
          {item.sources.length > 0 ? <small>{item.sources.join(' · ')}</small> : null}
        </div>

        <span className={`${styles.reviewStatus} ${record ? styles.reviewStatusDone : ''}`}>
          {record ? <FiCheck aria-hidden="true" /> : null}
          {record ? 'Revisado' : 'Sin revisar'}
        </span>
      </div>

      {staleRecord && !record ? (
        <p className={styles.staleNotice}>
          <FiRefreshCw aria-hidden="true" />
          La cantidad planificada cambió desde la última revisión. Revisalo de nuevo.
        </p>
      ) : null}

      <div className={styles.choiceRow} aria-label={`Estado de ${item.name}`}>
        <button
          type="button"
          className={mode === 'none' ? styles.activeNoLeftover : ''}
          disabled={isSaving}
          onClick={handleNoLeftover}
        >
          No sobró
        </button>
        <button
          type="button"
          className={mode === 'leftover' ? styles.activeLeftover : ''}
          disabled={isSaving}
          onClick={() => setMode('leftover')}
        >
          Sobró
        </button>
      </div>

      {mode === 'none' ? (
        <div className={styles.noLeftoverDetails}>
          <button
            type="button"
            className={styles.detailsToggle}
            onClick={() => setShowNoLeftoverDetails((current) => !current)}
          >
            {showNoLeftoverDetails ? 'Ocultar detalle' : 'Compré otra cantidad / agregar nota'}
          </button>

          {showNoLeftoverDetails ? (
            <div className={styles.noLeftoverForm}>
              <label className={styles.field}>
                <span>Cuánto compraste realmente <small>(opcional)</small></span>
                <div className={styles.quantityField}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={actualPurchasedQuantity}
                    onChange={(event) => setActualPurchasedQuantity(event.target.value)}
                    placeholder={formatFoodQuantity(item.quantity)}
                  />
                  <select
                    value={actualPurchasedUnit}
                    onChange={(event) => setActualPurchasedUnit(event.target.value)}
                  >
                    {compatibleUnits.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </label>

              <label className={`${styles.field} ${styles.noteField}`}>
                <span>Nota <small>(opcional)</small></span>
                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ej. se consumió todo el paquete"
                />
              </label>

              <button
                type="button"
                className={styles.secondarySaveButton}
                disabled={isSaving}
                onClick={() => saveReview({ nextStatus: 'none' })}
              >
                <FiCheck aria-hidden="true" />
                {isSaving ? 'Guardando...' : 'Guardar detalle'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === 'leftover' ? (
        <div className={styles.leftoverForm}>
          <label className={styles.field}>
            <span>Cuánto sobró</span>
            <div className={styles.quantityField}>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={leftoverQuantity}
                onChange={(event) => setLeftoverQuantity(event.target.value)}
                placeholder="0"
              />
              <select value={leftoverUnit} onChange={(event) => setLeftoverUnit(event.target.value)}>
                {compatibleUnits.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </label>

          <label className={styles.field}>
            <span>Cuánto compraste realmente <small>(opcional)</small></span>
            <div className={styles.quantityField}>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={actualPurchasedQuantity}
                onChange={(event) => setActualPurchasedQuantity(event.target.value)}
                placeholder={formatFoodQuantity(item.quantity)}
              />
              <select
                value={actualPurchasedUnit}
                onChange={(event) => setActualPurchasedUnit(event.target.value)}
              >
                {compatibleUnits.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </label>

          <label className={`${styles.field} ${styles.noteField}`}>
            <span>Nota <small>(opcional)</small></span>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. quedó un paquete cerrado"
            />
          </label>

          <button
            type="button"
            className={styles.saveButton}
            disabled={isSaving}
            onClick={() => saveReview({ nextStatus: 'leftover' })}
          >
            <FiCheck aria-hidden="true" />
            {isSaving ? 'Guardando...' : 'Guardar sobra'}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function LeftoversPage() {
  const { group } = useOutletContext();
  const { currentUser } = useAuth();
  const { meals, mealPlan, foodExtras, drinkPlans, isLoading: foodLoading, error: foodError } =
    useMealModuleData(group.id);
  const { shoppingState, isLoading: shoppingLoading, error: shoppingError } =
    useShoppingState(group.id);
  const { records, isLoading: leftoversLoading, error: leftoversError } = useTripLeftovers(group.id);

  const [actionError, setActionError] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualQuantity, setManualQuantity] = useState('');
  const [manualUnit, setManualUnit] = useState('unidad');
  const [manualNote, setManualNote] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState('');

  const participantCount = useMemo(() => getGroupMembers(group).length, [group]);
  const tripDaysCount = getTripDaysCount(group.startDate, group.endDate);
  const shoppingItems = useMemo(
    () =>
      buildShoppingList({
        meals,
        mealPlan,
        foodExtras,
        drinkPlans,
        participantCount,
        tripDaysCount,
      }),
    [meals, mealPlan, foodExtras, drinkPlans, participantCount, tripDaysCount],
  );

  const summary = useMemo(
    () => buildLeftoverSummary({ shoppingItems, shoppingState, records }),
    [shoppingItems, shoppingState, records],
  );

  const handleAddManual = async (event) => {
    event.preventDefault();
    setActionError('');
    setIsAddingManual(true);

    try {
      await addManualLeftover({
        groupId: group.id,
        name: manualName,
        quantity: manualQuantity,
        unit: manualUnit,
        note: manualNote,
        currentUserUid: currentUser.uid,
      });
      setManualName('');
      setManualQuantity('');
      setManualUnit('unidad');
      setManualNote('');
    } catch (error) {
      console.error(error);
      setActionError(error.message || 'No se pudo agregar la sobra.');
    } finally {
      setIsAddingManual(false);
    }
  };

  const handleDeleteManual = async (record) => {
    const shouldDelete = window.confirm(`¿Eliminar "${record.name}" de las sobras?`);
    if (!shouldDelete) return;

    setActionError('');
    setDeletingRecordId(record.id);

    try {
      await deleteTripLeftover({ groupId: group.id, recordId: record.id });
    } catch (error) {
      console.error(error);
      setActionError(error.message || 'No se pudo eliminar la sobra.');
    } finally {
      setDeletingRecordId('');
    }
  };

  const isLoading = foodLoading || shoppingLoading || leftoversLoading;
  const loadError = foodError || shoppingError || leftoversError;

  return (
    <div className={styles.page}>
      <TripModuleHeader
        moduleId="leftovers"
        title="Sobras del viaje"
        description="Registrá qué quedó de lo comprado para ajustar mejor las cantidades en viajes futuros."
      />

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <FiCheckCircle aria-hidden="true" />
          <div>
            <span>Revisados</span>
            <strong>{summary.reviewedCount}/{summary.purchasedCount}</strong>
            <small>productos comprados</small>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <FiArchive aria-hidden="true" />
          <div>
            <span>Con sobrantes</span>
            <strong>{summary.leftoverCount}</strong>
            <small>incluye cargas manuales</small>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <FiRefreshCw aria-hidden="true" />
          <div>
            <span>Pendientes</span>
            <strong>{summary.pendingCount}</strong>
            <small>productos por revisar</small>
          </div>
        </article>
      </section>

      {loadError ? <p className={styles.error}>{loadError}</p> : null}
      {actionError ? <p className={styles.error}>{actionError}</p> : null}
      {isLoading ? <div className={styles.loading}>Preparando el registro de sobras...</div> : null}

      {!isLoading ? (
        <section className={`${styles.panel} ${styles.consolidatedPanel}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelIcon}><FiArchive aria-hidden="true" /></div>
            <div>
              <h3>Sobró del viaje</h3>
              <p>Consolidado de todo lo que quedó, incluyendo las sobras agregadas manualmente.</p>
            </div>
          </div>

          {summary.consolidatedLeftovers.length === 0 ? (
            <div className={`${styles.emptyState} ${styles.consolidatedEmptyState}`}>
              <FiArchive aria-hidden="true" />
              <strong>
                {summary.pendingCount > 0
                  ? 'Todavía no hay sobras registradas'
                  : 'No quedaron sobras registradas'}
              </strong>
              <p>
                {summary.pendingCount > 0
                  ? 'A medida que revises lo comprado, lo que marques como sobrante va a aparecer acá.'
                  : 'La revisión está completa y no hay productos marcados con sobrantes.'}
              </p>
            </div>
          ) : (
            <ul className={styles.consolidatedList}>
              {summary.consolidatedLeftovers.map((leftover) => (
                <li key={leftover.key}>
                  <div>
                    <strong>{leftover.name}</strong>
                    {leftover.recordCount > 1 ? (
                      <small>Consolidado de {leftover.recordCount} registros</small>
                    ) : null}
                  </div>
                  <span>
                    {formatFoodQuantity(leftover.quantity)} {leftover.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {!isLoading ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelIcon}><FiCheckCircle aria-hidden="true" /></div>
            <div>
              <h3>Revisar lo comprado</h3>
              <p>La lista sale de los productos que marcaste como comprados en Compras.</p>
            </div>
          </div>

          {summary.purchasedItems.length === 0 ? (
            <div className={styles.emptyState}>
              <FiArchive aria-hidden="true" />
              <strong>No hay productos comprados para revisar</strong>
              <p>Cuando marques productos como comprados, van a aparecer acá automáticamente.</p>
            </div>
          ) : (
            <div className={styles.reviewList}>
              {summary.purchasedItems.map((item) => (
                <PurchasedItemReview
                  key={item.itemKey}
                  item={item}
                  record={getCurrentShoppingReview(item, records)}
                  staleRecord={getStaleShoppingReview(item, records)}
                  groupId={group.id}
                  currentUserUid={currentUser.uid}
                  onError={setActionError}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelIcon}><FiPlus aria-hidden="true" /></div>
          <div>
            <h3>Agregar otra sobra</h3>
            <p>Para alimentos que se compraron fuera de la lista o que no quedaron registrados en Compras.</p>
          </div>
        </div>

        <form className={styles.manualForm} onSubmit={handleAddManual}>
          <label className={styles.field}>
            <span>Alimento</span>
            <input
              type="text"
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              placeholder="Ej. pan lactal"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Cuánto sobró</span>
            <div className={styles.quantityField}>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={manualQuantity}
                onChange={(event) => setManualQuantity(event.target.value)}
                placeholder="0"
                required
              />
              <select value={manualUnit} onChange={(event) => setManualUnit(event.target.value)}>
                {getAllLeftoverUnits().map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </label>

          <label className={`${styles.field} ${styles.manualNote}`}>
            <span>Nota <small>(opcional)</small></span>
            <input
              type="text"
              value={manualNote}
              onChange={(event) => setManualNote(event.target.value)}
              placeholder="Ej. paquete cerrado"
            />
          </label>

          <button type="submit" className={styles.saveButton} disabled={isAddingManual}>
            <FiPlus aria-hidden="true" />
            {isAddingManual ? 'Agregando...' : 'Agregar sobra'}
          </button>
        </form>

        {summary.manualLeftovers.length > 0 ? (
          <ul className={styles.manualList}>
            {summary.manualLeftovers.map((record) => (
              <li key={record.id}>
                <div>
                  <strong>{record.name}</strong>
                  <span>{formatFoodQuantity(record.leftoverQuantity)} {record.leftoverUnit}</span>
                  {record.note ? <small>{record.note}</small> : null}
                </div>
                <button
                  type="button"
                  className={styles.deleteButton}
                  disabled={deletingRecordId === record.id}
                  onClick={() => handleDeleteManual(record)}
                  aria-label={`Eliminar ${record.name}`}
                >
                  <FiTrash2 aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

export default LeftoversPage;
