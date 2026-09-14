import { useState } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import IngredientEditor from '@/features/meals/components/IngredientEditor';
import PurchasePlaceInput from '@/features/meals/components/PurchasePlaceInput';
import { EXTRA_MODES, FOOD_UNITS } from '@/features/meals/constants/mealConstants';
import {
  createFoodExtra,
  deleteFoodExtra,
  updateFoodExtra,
} from '@/features/meals/services/mealService';
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
  purchasePlaceSuggestions = [],
}) {
  const [formData, setFormData] = useState(createEmptyForm);
  const [editingExtraId, setEditingExtraId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
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
              setIsFormOpen(true);
            }
          }}
        >
          <FiPlus aria-hidden="true" />
          Nuevo extra
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
                  </div>
                </div>

                <div className={styles.itemActions}>
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
