import { useMemo, useState } from 'react';
import { FiRepeat } from 'react-icons/fi';
import { DRINK_CALCULATION_MODES, DRINK_COVERAGE_MODES } from '@/features/meals/constants/mealConstants';
import {
  importRecurringFoodPresetToTrip,
  RECURRING_ITEM_KINDS,
} from '@/features/meals/services/recurringFoodLibraryService';
import styles from './MealsModule.module.scss';

function RecurringPresetsSection({
  groupId,
  presets,
  recurringItems,
  foodExtras,
  drinkPlans,
  members,
  tripDaysCount,
  currentUserUid,
  sharedUserIds = [],
  libraryLoading = false,
  onManageLibrary,
}) {
  const [importingPresetId, setImportingPresetId] = useState('');
  const [error, setError] = useState('');

  const itemsById = useMemo(
    () => new Map(recurringItems.map((item) => [item.id, item])),
    [recurringItems],
  );
  const importedSourceIds = useMemo(
    () => new Set(
      [...foodExtras, ...drinkPlans]
        .map((item) => item.sourceRecurringItemId)
        .filter(Boolean),
    ),
    [foodExtras, drinkPlans],
  );
  const participantIds = useMemo(
    () => members.map((member) => member.memberId).filter(Boolean),
    [members],
  );

  const handleImport = async (preset) => {
    const availableItems = (preset.itemIds || [])
      .map((itemId) => itemsById.get(itemId))
      .filter(Boolean);
    const pendingItems = availableItems.filter((item) => !importedSourceIds.has(item.id));

    if (pendingItems.length === 0) {
      setError(`Todos los elementos de "${preset.name}" ya están agregados al viaje.`);
      return;
    }

    const invalidTripDrink = pendingItems.find(
      (item) =>
        item.kind === RECURRING_ITEM_KINDS.drink
        && item.calculationMode === DRINK_CALCULATION_MODES.perPersonPerDay
        && item.coverageMode === DRINK_COVERAGE_MODES.trip
        && tripDaysCount <= 0,
    );

    if (invalidTripDrink) {
      setError(`El viaje no tiene fechas. No se puede calcular "${invalidTripDrink.name}" para todos los días del viaje.`);
      return;
    }

    setError('');
    setImportingPresetId(preset.id);

    try {
      await importRecurringFoodPresetToTrip({
        groupId,
        preset,
        items: pendingItems,
        createdBy: currentUserUid,
        accessUserIds: sharedUserIds,
        participantIds,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo agregar el habitual al viaje.');
    } finally {
      setImportingPresetId('');
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Habituales</h2>
          <p>
            Agregá de una sola vez el conjunto de extras y bebidas que suelen repetirse en tus viajes.
          </p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onManageLibrary}>
          <FiRepeat aria-hidden="true" />
          Administrar recurrentes
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {libraryLoading ? (
        <div className={styles.compactEmptyState}>Cargando Habituales...</div>
      ) : null}

      {!libraryLoading && presets.length === 0 ? (
        <div className={styles.compactEmptyState}>
          Todavía no tenés Habituales. Podés crear uno en la biblioteca de recurrentes.
        </div>
      ) : null}

      {!libraryLoading && presets.length > 0 ? (
        <div className={styles.libraryList}>
          {presets.map((preset) => {
            const presetItems = (preset.itemIds || [])
              .map((itemId) => itemsById.get(itemId))
              .filter(Boolean);
            const pendingCount = presetItems.filter((item) => !importedSourceIds.has(item.id)).length;

            return (
              <div key={preset.id} className={styles.libraryRow}>
                <div>
                  <strong>{preset.name}</strong>
                  <span>
                    {presetItems.length} recurrentes · {pendingCount === 0
                      ? 'todos ya agregados'
                      : `${pendingCount} por agregar`}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => handleImport(preset)}
                  disabled={pendingCount === 0 || importingPresetId === preset.id}
                >
                  {pendingCount === 0
                    ? 'Ya agregado'
                    : importingPresetId === preset.id
                      ? 'Agregando...'
                      : 'Agregar al viaje'}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default RecurringPresetsSection;
