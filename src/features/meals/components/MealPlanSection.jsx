import { useMemo, useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { MEAL_TYPE_LABELS } from '@/features/meals/constants/mealConstants';
import {
  clearMealPlanSlot,
  setMealPlanSlot,
} from '@/features/meals/services/mealService';
import { formatTripDay } from '@/utils/tripUtils';
import styles from './MealsModule.module.scss';

function getPlanValue(plan) {
  if (!plan) return '';
  if (plan.assignmentType === 'meal') return `meal:${plan.mealId}`;
  return plan.assignmentType || '';
}

function MealPlanSection({ groupId, slots, meals, mealPlan, currentUserUid }) {
  const [savingSlotId, setSavingSlotId] = useState('');
  const [error, setError] = useState('');
  const [draftSelections, setDraftSelections] = useState({});
  const [customLabels, setCustomLabels] = useState({});

  const planMap = useMemo(
    () => Object.fromEntries(mealPlan.map((plan) => [plan.id, plan])),
    [mealPlan],
  );

  const days = useMemo(() => {
    const byDate = new Map();

    slots.forEach((slot) => {
      if (!byDate.has(slot.date)) {
        byDate.set(slot.date, []);
      }
      byDate.get(slot.date).push(slot);
    });

    return Array.from(byDate.entries()).map(([date, daySlots]) => ({ date, slots: daySlots }));
  }, [slots]);

  const savePlan = async (slot, payload) => {
    setError('');
    setSavingSlotId(slot.id);

    try {
      await setMealPlanSlot({
        groupId,
        slotId: slot.id,
        date: slot.date,
        mealType: slot.mealType,
        currentUserUid,
        ...payload,
      });

      setDraftSelections((current) => {
        const next = { ...current };
        delete next[slot.id];
        return next;
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar el plan de comidas.');
    } finally {
      setSavingSlotId('');
    }
  };

  const handleSelectionChange = async (slot, value) => {
    const currentPlan = planMap[slot.id];

    if (value === 'custom') {
      setDraftSelections((current) => ({ ...current, [slot.id]: 'custom' }));
      setCustomLabels((current) => ({
        ...current,
        [slot.id]: current[slot.id] ?? currentPlan?.label ?? '',
      }));
      return;
    }

    if (!value) {
      setError('');
      setSavingSlotId(slot.id);

      try {
        if (currentPlan) {
          await clearMealPlanSlot({ groupId, slotId: slot.id });
        }
        setDraftSelections((current) => {
          const next = { ...current };
          delete next[slot.id];
          return next;
        });
      } catch (err) {
        console.error(err);
        setError(err.message || 'No se pudo limpiar la comida.');
      } finally {
        setSavingSlotId('');
      }
      return;
    }

    if (value === 'leftovers') {
      await savePlan(slot, {
        assignmentType: 'leftovers',
        mealId: '',
        label: 'Sobras',
      });
      return;
    }

    if (value.startsWith('meal:')) {
      await savePlan(slot, {
        assignmentType: 'meal',
        mealId: value.slice(5),
        label: '',
      });
    }
  };

  const handleSaveCustom = async (slot) => {
    await savePlan(slot, {
      assignmentType: 'custom',
      mealId: '',
      label: customLabels[slot.id] || '',
    });
  };

  if (slots.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Plan diario</h2>
            <p>Almuerzos y cenas se generan a partir de las fechas del viaje.</p>
          </div>
        </div>

        <div className={styles.emptyState}>
          <strong>No hay días para planificar.</strong>
          <span>Configurá las fechas del viaje para habilitar el calendario.</span>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Plan diario</h2>
          <p>
            Elegí una comida del catálogo, marcá Sobras o cargá una opción puntual sin receta.
          </p>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.dayList}>
        {days.map((day) => (
          <article key={day.date} className={styles.dayCard}>
            <div className={styles.dayHeader}>
              <h3>{formatTripDay(day.date)}</h3>
              <span>{day.date}</span>
            </div>

            <div className={styles.slotsGrid}>
              {day.slots.map((slot) => {
                const plan = planMap[slot.id];
                const selection = draftSelections[slot.id] ?? getPlanValue(plan);
                const isSaving = savingSlotId === slot.id;

                return (
                  <div key={slot.id} className={styles.slotCard}>
                    <div className={styles.slotHeader}>
                      <strong>{MEAL_TYPE_LABELS[slot.mealType]}</strong>
                      <span>{isSaving ? 'Guardando...' : plan ? 'Planificado' : 'Pendiente'}</span>
                    </div>

                    <div className={styles.slotControls}>
                      <label className={styles.field}>
                        <span>Comida</span>
                        <select
                          value={selection}
                          disabled={isSaving}
                          onChange={(event) => handleSelectionChange(slot, event.target.value)}
                        >
                          <option value="">Sin definir</option>
                          {meals.map((meal) => (
                            <option key={meal.id} value={`meal:${meal.id}`}>
                              {meal.name}
                            </option>
                          ))}
                          <option value="leftovers">Sobras</option>
                          <option value="custom">Otra comida / sin receta</option>
                        </select>
                      </label>

                      {selection === 'custom' ? (
                        <div className={styles.customRow}>
                          <label className={styles.field}>
                            <span>Descripción</span>
                            <input
                              type="text"
                              value={customLabels[slot.id] ?? plan?.label ?? ''}
                              placeholder="Ej: Salir a comer afuera"
                              onChange={(event) =>
                                setCustomLabels((current) => ({
                                  ...current,
                                  [slot.id]: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <button
                            type="button"
                            className={styles.primaryButton}
                            disabled={isSaving}
                            onClick={() => handleSaveCustom(slot)}
                          >
                            Guardar
                          </button>
                        </div>
                      ) : null}

                      {plan ? (
                        <button
                          type="button"
                          className={styles.dangerButton}
                          disabled={isSaving}
                          onClick={() => handleSelectionChange(slot, '')}
                        >
                          <FiTrash2 aria-hidden="true" />
                          Quitar del día
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default MealPlanSection;
