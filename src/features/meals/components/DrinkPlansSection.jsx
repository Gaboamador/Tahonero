import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import PurchasePlaceInput from '@/features/meals/components/PurchasePlaceInput';
import {
  DRINK_CALCULATION_MODES,
  DRINK_COVERAGE_MODES,
  FOOD_UNITS,
} from '@/features/meals/constants/mealConstants';
import {
  createDrinkPlan,
  deleteDrinkPlan,
  updateDrinkPlan,
} from '@/features/meals/services/mealService';
import { calculateDrinkTotal, formatFoodQuantity } from '@/features/meals/utils/mealUtils';
import styles from './MealsModule.module.scss';

function createEmptyForm(members) {
  return {
    name: '',
    calculationMode: DRINK_CALCULATION_MODES.fixed,
    quantity: '',
    unit: 'l',
    purchasePlace: '',
    participantIds: members.map((member) => member.memberId),
    coverageMode: DRINK_COVERAGE_MODES.trip,
    coverageDays: '',
  };
}

function DrinkPlansSection({
  groupId,
  drinkPlans,
  members,
  tripDaysCount,
  currentUserUid,
  purchasePlaceSuggestions = [],
}) {
  const [formData, setFormData] = useState(() => createEmptyForm(members));
  const [editingDrinkId, setEditingDrinkId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isFormOpen && !editingDrinkId) {
      setFormData(createEmptyForm(members));
    }
  }, [members, isFormOpen, editingDrinkId]);

  const resetForm = () => {
    setFormData(createEmptyForm(members));
    setEditingDrinkId('');
    setIsFormOpen(false);
    setError('');
  };

  const previewPlan = useMemo(
    () => ({
      ...formData,
      quantity: Number(String(formData.quantity || '').replace(',', '.')) || 0,
      coverageDays: Number(formData.coverageDays) || 0,
    }),
    [formData],
  );

  const previewTotal = calculateDrinkTotal({ drinkPlan: previewPlan, tripDaysCount });

  const handleParticipantToggle = (memberId) => {
    setFormData((current) => ({
      ...current,
      participantIds: current.participantIds.includes(memberId)
        ? current.participantIds.filter((id) => id !== memberId)
        : [...current.participantIds, memberId],
    }));
  };

  const handleEdit = (drink) => {
    setEditingDrinkId(drink.id);
    setFormData({
      name: drink.name || '',
      calculationMode: drink.calculationMode || DRINK_CALCULATION_MODES.fixed,
      quantity: String(drink.quantity ?? ''),
      unit: drink.unit || 'l',
      purchasePlace: drink.purchasePlace || '',
      participantIds:
        drink.calculationMode === DRINK_CALCULATION_MODES.perPersonPerDay
          ? drink.participantIds || []
          : members.map((member) => member.memberId),
      coverageMode: drink.coverageMode || DRINK_COVERAGE_MODES.trip,
      coverageDays: drink.coverageDays ? String(drink.coverageDays) : '',
    });
    setError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (
      formData.calculationMode === DRINK_CALCULATION_MODES.perPersonPerDay &&
      formData.coverageMode === DRINK_COVERAGE_MODES.trip &&
      tripDaysCount <= 0
    ) {
      setError('El viaje no tiene fechas. Elegí una cantidad personalizada de días.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = { groupId, ...formData };

      if (editingDrinkId) {
        await updateDrinkPlan({ ...payload, drinkId: editingDrinkId });
      } else {
        await createDrinkPlan({ ...payload, createdBy: currentUserUid });
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar la bebida.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (drink) => {
    if (!window.confirm(`¿Borrar "${drink.name}" de las bebidas?`)) {
      return;
    }

    setError('');

    try {
      await deleteDrinkPlan({ groupId, drinkId: drink.id });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo borrar la bebida.');
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Bebidas</h2>
          <p>
            Cargá una cantidad fija o calculá consumo por persona y por día. El resultado queda listo para que Compras lo use después.
          </p>
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            if (isFormOpen && !editingDrinkId) {
              resetForm();
            } else {
              setFormData(createEmptyForm(members));
              setEditingDrinkId('');
              setError('');
              setIsFormOpen(true);
            }
          }}
        >
          <FiPlus aria-hidden="true" />
          Nueva bebida
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {isFormOpen ? (
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className={styles.twoColumnGrid}>
            <label className={styles.field}>
              <span>Nombre</span>
              <input
                type="text"
                value={formData.name}
                placeholder="Ej: Coca Cola"
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Tipo de cálculo</span>
              <select
                value={formData.calculationMode}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    calculationMode: event.target.value,
                    participantIds: members.map((member) => member.memberId),
                    coverageMode: DRINK_COVERAGE_MODES.trip,
                    coverageDays: '',
                  }))
                }
              >
                <option value={DRINK_CALCULATION_MODES.fixed}>Cantidad fija</option>
                <option value={DRINK_CALCULATION_MODES.perPersonPerDay}>Por persona / por día</option>
              </select>
            </label>
          </div>

          <div className={styles.twoColumnGrid}>
            <label className={styles.field}>
              <span>
                {formData.calculationMode === DRINK_CALCULATION_MODES.perPersonPerDay
                  ? 'Cantidad por persona y por día'
                  : 'Cantidad total'}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={formData.quantity}
                placeholder="Ej: 1,5"
                onChange={(event) => setFormData((current) => ({ ...current, quantity: event.target.value }))}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Unidad</span>
              <select
                value={formData.unit}
                onChange={(event) => setFormData((current) => ({ ...current, unit: event.target.value }))}
              >
                {FOOD_UNITS.map((unit) => (
                  <option key={unit.value} value={unit.value}>{unit.label}</option>
                ))}
              </select>
            </label>
          </div>

          <PurchasePlaceInput
            value={formData.purchasePlace}
            onChange={(purchasePlace) => setFormData((current) => ({ ...current, purchasePlace }))}
            suggestions={purchasePlaceSuggestions}
          />

          {formData.calculationMode === DRINK_CALCULATION_MODES.perPersonPerDay ? (
            <>
              <div className={styles.subsectionHeader}>
                <div>
                  <strong>Quiénes consumen</strong>
                  <span>El cálculo usa sólo los participantes seleccionados.</span>
                </div>
              </div>

              <div className={styles.checkboxList}>
                {members.map((member) => (
                  <label key={member.memberId} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={formData.participantIds.includes(member.memberId)}
                      onChange={() => handleParticipantToggle(member.memberId)}
                    />
                    <span>{member.displayName || member.email || 'Usuario'}</span>
                  </label>
                ))}
              </div>

              <div className={styles.twoColumnGrid}>
                <label className={styles.field}>
                  <span>Días de consumo</span>
                  <select
                    value={formData.coverageMode}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        coverageMode: event.target.value,
                        coverageDays: '',
                      }))
                    }
                  >
                    <option value={DRINK_COVERAGE_MODES.trip} disabled={tripDaysCount <= 0}>
                      Todos los días del viaje ({tripDaysCount})
                    </option>
                    <option value={DRINK_COVERAGE_MODES.custom}>Cantidad personalizada</option>
                  </select>
                </label>

                {formData.coverageMode === DRINK_COVERAGE_MODES.custom ? (
                  <label className={styles.field}>
                    <span>Cantidad de días</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.coverageDays}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, coverageDays: event.target.value }))
                      }
                      required
                    />
                  </label>
                ) : <div />}
              </div>
            </>
          ) : null}

          {previewTotal > 0 ? (
            <div className={styles.totalPreview}>
              <span>Total calculado:</span>
              <strong>{formatFoodQuantity(previewTotal)} {formData.unit}</strong>
            </div>
          ) : null}

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : editingDrinkId ? 'Guardar cambios' : 'Crear bebida'}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={resetForm} disabled={isSubmitting}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {drinkPlans.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>No hay bebidas cargadas.</strong>
          <span>Podés usar cantidades fijas o calcular consumo automáticamente.</span>
        </div>
      ) : (
        <div className={styles.cardsList}>
          {drinkPlans.map((drink) => {
            const total = calculateDrinkTotal({ drinkPlan: drink, tripDaysCount });
            const selectedMemberNames = members
              .filter((member) => (drink.participantIds || []).includes(member.memberId))
              .map((member) => member.displayName || member.email || 'Usuario');

            return (
              <article key={drink.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <div className={styles.itemTitle}>
                    <h3>{drink.name}</h3>
                    <div className={styles.metaRow}>
                      <span className={styles.accentBadge}>Total: {formatFoodQuantity(total)} {drink.unit}</span>
                      <span className={styles.metaBadge}>
                        {drink.calculationMode === DRINK_CALCULATION_MODES.fixed
                          ? 'Cantidad fija'
                          : `${formatFoodQuantity(drink.quantity)} ${drink.unit} / persona / día`}
                      </span>
                      {drink.purchasePlace ? <span className={styles.metaBadge}>{drink.purchasePlace}</span> : null}
                    </div>
                    {drink.calculationMode === DRINK_CALCULATION_MODES.perPersonPerDay ? (
                      <p>
                        {selectedMemberNames.length} {selectedMemberNames.length === 1 ? 'persona' : 'personas'} · {' '}
                        {drink.coverageMode === DRINK_COVERAGE_MODES.custom ? drink.coverageDays : tripDaysCount} días
                      </p>
                    ) : null}
                  </div>

                  <div className={styles.itemActions}>
                    <button type="button" className={styles.iconButton} onClick={() => handleEdit(drink)} aria-label={`Editar ${drink.name}`}>
                      <FiEdit2 aria-hidden="true" />
                    </button>
                    <button type="button" className={styles.iconDangerButton} onClick={() => handleDelete(drink)} aria-label={`Borrar ${drink.name}`}>
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default DrinkPlansSection;
