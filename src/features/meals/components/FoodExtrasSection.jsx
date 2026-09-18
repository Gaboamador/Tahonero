import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBookOpen, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import IngredientEditor from '@/features/meals/components/IngredientEditor';
import PurchasePlaceInput from '@/features/meals/components/PurchasePlaceInput';
import { EXTRA_MODES, FOOD_UNITS } from '@/features/meals/constants/mealConstants';
import {
  createFoodExtra,
  deleteFoodExtra,
  updateFoodExtra,
} from '@/features/meals/services/mealService';
import {
  importRecurringFoodItemToTrip,
  RECURRING_ITEM_KINDS,
  saveTripRecurringItemToLibrary,
  updateRecurringItemFromTrip,
} from '@/features/meals/services/recurringFoodLibraryService';
import { createEmptyIngredient, createLocalId, formatFoodQuantity } from '@/features/meals/utils/mealUtils';
import styles from './MealsModule.module.scss';

function createEmptyForm() {
  return {
    name: '',
    mode: EXTRA_MODES.direct,
    quantity: '',
    unit: 'unidad',
    purchasePlace: '',
    ingredients: [],
  };
}

function FoodExtrasSection({
  groupId,
  foodExtras,
  currentUserUid,
  sharedUserIds = [],
  recurringExtras = [],
  recurringLoading = false,
  purchasePlaceSuggestions = [],
}) {
  const [formData, setFormData] = useState(createEmptyForm);
  const [editingExtraId, setEditingExtraId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [importingItemId, setImportingItemId] = useState('');
  const [savingExtraId, setSavingExtraId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setFormData(createEmptyForm());
    setEditingExtraId('');
    setIsFormOpen(false);
    setError('');
  };

  const handleEdit = (extra) => {
    setEditingExtraId(extra.id);
    setFormData({
      name: extra.name || '',
      mode: extra.mode || EXTRA_MODES.direct,
      quantity: extra.quantity ? String(extra.quantity) : '',
      unit: extra.unit || 'unidad',
      purchasePlace: extra.purchasePlace || '',
      ingredients:
        extra.mode === EXTRA_MODES.recipe
          ? (extra.ingredients || []).length > 0
            ? extra.ingredients.map((ingredient) => ({
                ...ingredient,
                id: ingredient.id || createLocalId('ingredient'),
                quantity: String(ingredient.quantity ?? ''),
                purchasePlace: ingredient.purchasePlace || '',
              }))
            : [createEmptyIngredient()]
          : [],
    });
    setError('');
    setIsLibraryOpen(false);
    setIsFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const payload = {
        groupId,
        ...formData,
      };

      if (editingExtraId) {
        await updateFoodExtra({ ...payload, extraId: editingExtraId });
      } else {
        await createFoodExtra({ ...payload, createdBy: currentUserUid });
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar el extra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImport = async (item) => {
    if (foodExtras.some((extra) => extra.sourceRecurringItemId === item.id)) {
      setError(`"${item.name}" ya está agregado a este viaje.`);
      return;
    }

    setError('');
    setImportingItemId(item.id);

    try {
      await importRecurringFoodItemToTrip({
        groupId,
        item,
        createdBy: currentUserUid,
        accessUserIds: sharedUserIds,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo importar el extra recurrente.');
    } finally {
      setImportingItemId('');
    }
  };

  const handleSaveToLibrary = async (extra) => {
    setError('');
    setSavingExtraId(extra.id);

    try {
      await saveTripRecurringItemToLibrary({
        groupId,
        kind: RECURRING_ITEM_KINDS.extra,
        tripItem: extra,
        currentUserUid,
        accessUserIds: sharedUserIds,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar el extra como recurrente.');
    } finally {
      setSavingExtraId('');
    }
  };

  const handleUpdateLibraryItem = async (extra) => {
    if (!window.confirm(`¿Actualizar la plantilla recurrente "${extra.name}" con la versión de este viaje? Los viajes anteriores no cambian.`)) {
      return;
    }

    setError('');
    setSavingExtraId(extra.id);

    try {
      await updateRecurringItemFromTrip({
        kind: RECURRING_ITEM_KINDS.extra,
        tripItem: extra,
        currentUserUid,
        accessUserIds: sharedUserIds,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo actualizar la plantilla recurrente.');
    } finally {
      setSavingExtraId('');
    }
  };

  const handleDelete = async (extra) => {
    if (!window.confirm(`¿Borrar "${extra.name}" de los extras?`)) {
      return;
    }

    setError('');

    try {
      await deleteFoodExtra({ groupId, extraId: extra.id });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo borrar el extra.');
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Extras</h2>
          <p>
            Cosas del viaje que generan compras pero no pertenecen a un almuerzo o una cena: yerba, galletitas, picada y similares.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              setIsLibraryOpen((current) => !current);
              setIsFormOpen(false);
              setEditingExtraId('');
              setError('');
            }}
          >
            <FiBookOpen aria-hidden="true" />
            Desde recurrentes
          </button>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              if (isFormOpen && !editingExtraId) {
                resetForm();
              } else {
                setFormData(createEmptyForm());
                setEditingExtraId('');
                setError('');
                setIsLibraryOpen(false);
                setIsFormOpen(true);
              }
            }}
          >
            <FiPlus aria-hidden="true" />
            Nuevo extra
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {isLibraryOpen ? (
        <div className={styles.formCard}>
          <div className={styles.subsectionHeader}>
            <div>
              <strong>Extras recurrentes</strong>
              <span>Importar crea una snapshot independiente dentro del viaje.</span>
            </div>
            <Link to="/biblioteca-recurrentes" className={styles.textLink}>Administrar biblioteca</Link>
          </div>

          {recurringLoading ? <div className={styles.compactEmptyState}>Cargando recurrentes...</div> : null}

          {!recurringLoading && recurringExtras.length === 0 ? (
            <div className={styles.compactEmptyState}>
              Todavía no tenés extras recurrentes. Podés crear uno en la biblioteca.
            </div>
          ) : null}

          {!recurringLoading && recurringExtras.length > 0 ? (
            <div className={styles.libraryList}>
              {recurringExtras.map((item) => {
                const alreadyImported = foodExtras.some(
                  (extra) => extra.sourceRecurringItemId === item.id,
                );

                return (
                  <div key={item.id} className={styles.libraryRow}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.mode === EXTRA_MODES.direct
                          ? `${formatFoodQuantity(item.quantity)} ${item.unit}`
                          : `${(item.ingredients || []).length} ingredientes`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => handleImport(item)}
                      disabled={alreadyImported || importingItemId === item.id}
                    >
                      {alreadyImported
                        ? 'Ya agregado'
                        : importingItemId === item.id
                          ? 'Importando...'
                          : 'Importar'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {isFormOpen ? (
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className={styles.twoColumnGrid}>
            <label className={styles.field}>
              <span>Nombre</span>
              <input
                type="text"
                value={formData.name}
                placeholder="Ej: Yerba"
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Cómo se carga</span>
              <select
                value={formData.mode}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    mode: event.target.value,
                    quantity: '',
                    purchasePlace: '',
                    ingredients:
                      event.target.value === EXTRA_MODES.recipe
                        ? [createEmptyIngredient()]
                        : [],
                  }))
                }
              >
                <option value={EXTRA_MODES.direct}>Cantidad directa</option>
                <option value={EXTRA_MODES.recipe}>Lista de ingredientes</option>
              </select>
            </label>
          </div>

          {formData.mode === EXTRA_MODES.direct ? (
            <>
              <div className={styles.twoColumnGrid}>
                <label className={styles.field}>
                  <span>Cantidad</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.quantity}
                    placeholder="Ej: 2"
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
            </>
          ) : (
            <IngredientEditor
              ingredients={formData.ingredients}
              purchasePlaceSuggestions={purchasePlaceSuggestions}
              onChange={(ingredients) => setFormData((current) => ({ ...current, ingredients }))}
            />
          )}

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : editingExtraId ? 'Guardar cambios' : 'Crear extra'}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={resetForm} disabled={isSubmitting}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {foodExtras.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>No hay extras cargados.</strong>
          <span>Podés dejarlos para después si el viaje no los necesita.</span>
        </div>
      ) : (
        <div className={styles.cardsList}>
          {foodExtras.map((extra) => (
            <article key={extra.id} className={styles.itemCard}>
              <div className={styles.itemHeader}>
                <div className={styles.itemTitle}>
                  <h3>{extra.name}</h3>
                  <div className={styles.metaRow}>
                    <span className={styles.warmBadge}>Extra</span>
                    {extra.mode === EXTRA_MODES.direct ? (
                      <>
                        <span className={styles.metaBadge}>{formatFoodQuantity(extra.quantity)} {extra.unit}</span>
                        {extra.purchasePlace ? <span className={styles.metaBadge}>{extra.purchasePlace}</span> : null}
                      </>
                    ) : (
                      <span className={styles.metaBadge}>{(extra.ingredients || []).length} ingredientes</span>
                    )}
                    {extra.sourceRecurringItemId ? <span className={styles.accentBadge}>Recurrente</span> : null}
                  </div>
                </div>

                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.compactTextButton}
                    onClick={() => extra.sourceRecurringItemId
                      ? handleUpdateLibraryItem(extra)
                      : handleSaveToLibrary(extra)}
                    disabled={savingExtraId === extra.id}
                  >
                    <FiBookOpen aria-hidden="true" />
                    {savingExtraId === extra.id
                      ? 'Guardando...'
                      : extra.sourceRecurringItemId
                        ? 'Actualizar recurrente'
                        : 'Guardar como recurrente'}
                  </button>
                  <button type="button" className={styles.iconButton} onClick={() => handleEdit(extra)} aria-label={`Editar ${extra.name}`}>
                    <FiEdit2 aria-hidden="true" />
                  </button>
                  <button type="button" className={styles.iconDangerButton} onClick={() => handleDelete(extra)} aria-label={`Borrar ${extra.name}`}>
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </div>
              </div>

              {extra.mode === EXTRA_MODES.recipe && (extra.ingredients || []).length > 0 ? (
                <ul className={styles.ingredientSummary}>
                  {extra.ingredients.map((ingredient) => (
                    <li key={ingredient.id || `${extra.id}-${ingredient.name}`}>
                      <span>
                        {ingredient.name}
                        {ingredient.purchasePlace ? <small> · {ingredient.purchasePlace}</small> : null}
                      </span>
                      <span>{formatFoodQuantity(ingredient.quantity)} {ingredient.unit}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default FoodExtrasSection;
