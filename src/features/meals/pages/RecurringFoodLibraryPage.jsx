import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCoffee,
  FiEdit2,
  FiPackage,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';
import IngredientEditor from '@/features/meals/components/IngredientEditor';
import PurchasePlaceInput from '@/features/meals/components/PurchasePlaceInput';
import moduleStyles from '@/features/meals/components/MealsModule.module.scss';
import {
  DRINK_CALCULATION_MODES,
  DRINK_COVERAGE_MODES,
  EXTRA_MODES,
  FOOD_UNITS,
} from '@/features/meals/constants/mealConstants';
import { useRecurringFoodLibrary } from '@/features/meals/hooks/useRecurringFoodLibrary';
import {
  createRecurringFoodItem,
  createRecurringFoodPreset,
  deleteRecurringFoodItem,
  deleteRecurringFoodPreset,
  RECURRING_ITEM_KINDS,
  updateRecurringFoodItem,
  updateRecurringFoodPreset,
} from '@/features/meals/services/recurringFoodLibraryService';
import {
  collectPurchasePlaces,
  createEmptyIngredient,
  createLocalId,
  formatFoodQuantity,
} from '@/features/meals/utils/mealUtils';
import { useAuth } from '@/hooks/useAuth';
import styles from './RecurringFoodLibraryPage.module.scss';

function createEmptyExtraForm() {
  return {
    name: '',
    mode: EXTRA_MODES.direct,
    quantity: '',
    unit: 'unidad',
    purchasePlace: '',
    ingredients: [],
  };
}

function createEmptyDrinkForm() {
  return {
    name: '',
    calculationMode: DRINK_CALCULATION_MODES.fixed,
    quantity: '',
    unit: 'l',
    purchasePlace: '',
    coverageMode: DRINK_COVERAGE_MODES.trip,
    coverageDays: '',
  };
}

function createEmptyPresetForm() {
  return {
    name: '',
    itemIds: [],
  };
}

function RecurringFoodLibraryPage() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const {
    items,
    extras,
    drinks,
    presets,
    isLoading,
    error: loadError,
  } = useRecurringFoodLibrary(currentUser?.uid);
  const [extraForm, setExtraForm] = useState(createEmptyExtraForm);
  const [drinkForm, setDrinkForm] = useState(createEmptyDrinkForm);
  const [presetForm, setPresetForm] = useState(createEmptyPresetForm);
  const [editingExtraId, setEditingExtraId] = useState('');
  const [editingDrinkId, setEditingDrinkId] = useState('');
  const [editingPresetId, setEditingPresetId] = useState('');
  const [openForm, setOpenForm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const returnTo = location.state?.returnTo || '/';
  const returnScrollY = location.state?.returnScrollY;
  const returnLabel = location.state?.returnLabel;

  const purchasePlaceSuggestions = useMemo(
    () => collectPurchasePlaces({ recurringItems: items }),
    [items],
  );
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  const closeForms = () => {
    setExtraForm(createEmptyExtraForm());
    setDrinkForm(createEmptyDrinkForm());
    setPresetForm(createEmptyPresetForm());
    setEditingExtraId('');
    setEditingDrinkId('');
    setEditingPresetId('');
    setOpenForm('');
    setError('');
  };

  const openNewExtra = () => {
    closeForms();
    setOpenForm(RECURRING_ITEM_KINDS.extra);
  };

  const openNewDrink = () => {
    closeForms();
    setOpenForm(RECURRING_ITEM_KINDS.drink);
  };

  const openNewPreset = () => {
    closeForms();
    setOpenForm('preset');
  };

  const handleEditExtra = (extra) => {
    closeForms();
    setEditingExtraId(extra.id);
    setExtraForm({
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
    setOpenForm(RECURRING_ITEM_KINDS.extra);
  };

  const handleEditDrink = (drink) => {
    closeForms();
    setEditingDrinkId(drink.id);
    setDrinkForm({
      name: drink.name || '',
      calculationMode: drink.calculationMode || DRINK_CALCULATION_MODES.fixed,
      quantity: String(drink.quantity ?? ''),
      unit: drink.unit || 'l',
      purchasePlace: drink.purchasePlace || '',
      coverageMode: drink.coverageMode || DRINK_COVERAGE_MODES.trip,
      coverageDays: drink.coverageDays ? String(drink.coverageDays) : '',
    });
    setOpenForm(RECURRING_ITEM_KINDS.drink);
  };

  const handleEditPreset = (preset) => {
    closeForms();
    setEditingPresetId(preset.id);
    setPresetForm({
      name: preset.name || '',
      itemIds: (preset.itemIds || []).filter((itemId) => itemsById.has(itemId)),
    });
    setOpenForm('preset');
  };

  const handleSubmitExtra = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (editingExtraId) {
        await updateRecurringFoodItem({
          itemId: editingExtraId,
          kind: RECURRING_ITEM_KINDS.extra,
          ...extraForm,
        });
      } else {
        await createRecurringFoodItem({
          userUid: currentUser.uid,
          kind: RECURRING_ITEM_KINDS.extra,
          ...extraForm,
        });
      }
      closeForms();
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar el extra recurrente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDrink = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (editingDrinkId) {
        await updateRecurringFoodItem({
          itemId: editingDrinkId,
          kind: RECURRING_ITEM_KINDS.drink,
          ...drinkForm,
        });
      } else {
        await createRecurringFoodItem({
          userUid: currentUser.uid,
          kind: RECURRING_ITEM_KINDS.drink,
          ...drinkForm,
        });
      }
      closeForms();
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar la bebida recurrente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPreset = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (editingPresetId) {
        await updateRecurringFoodPreset({
          presetId: editingPresetId,
          ...presetForm,
        });
      } else {
        await createRecurringFoodPreset({
          userUid: currentUser.uid,
          ...presetForm,
        });
      }
      closeForms();
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar el habitual.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`¿Borrar "${item.name}" de la biblioteca? Los viajes que ya lo importaron no se modifican.`)) {
      return;
    }

    setError('');
    try {
      await deleteRecurringFoodItem({ userUid: currentUser.uid, item });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo borrar el elemento recurrente.');
    }
  };

  const handleDeletePreset = async (preset) => {
    if (!window.confirm(`¿Borrar el habitual "${preset.name}"? Los viajes que ya lo usaron no se modifican.`)) {
      return;
    }

    setError('');
    try {
      await deleteRecurringFoodPreset({ userUid: currentUser.uid, preset });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo borrar el habitual.');
    }
  };

  const togglePresetItem = (itemId) => {
    setPresetForm((current) => ({
      ...current,
      itemIds: current.itemIds.includes(itemId)
        ? current.itemIds.filter((id) => id !== itemId)
        : [...current.itemIds, itemId],
    }));
  };

  return (
    <section className={styles.page}>
      <Link
        to={returnTo}
        state={Number.isFinite(returnScrollY) ? { restoreScrollY: returnScrollY } : undefined}
        className={styles.backLink}
      >
        <FiArrowLeft aria-hidden="true" />
        {returnLabel ? `Volver a ${returnLabel}` : 'Volver al inicio'}
      </Link>

      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Biblioteca compartida</p>
          <h1>Recurrentes</h1>
          <p>
            Guardá extras y bebidas que se repiten entre viajes. Los Habituales agrupan varios recurrentes para cargarlos juntos de una sola vez.
          </p>
        </div>
      </div>

      {loadError ? <p className={moduleStyles.error}>{loadError}</p> : null}
      {error ? <p className={moduleStyles.error}>{error}</p> : null}
      {isLoading ? <div className={styles.loading}>Cargando biblioteca...</div> : null}

      <section className={moduleStyles.section}>
        <div className={moduleStyles.sectionHeader}>
          <div>
            <h2>Extras recurrentes</h2>
            <p>Pan, yerba, rolitos, picada y otras compras que no pertenecen a una comida puntual.</p>
          </div>
          <button type="button" className={moduleStyles.primaryButton} onClick={openNewExtra}>
            <FiPlus aria-hidden="true" />
            Nuevo extra
          </button>
        </div>

        {openForm === RECURRING_ITEM_KINDS.extra ? (
          <form className={moduleStyles.formCard} onSubmit={handleSubmitExtra}>
            <div className={moduleStyles.twoColumnGrid}>
              <label className={moduleStyles.field}>
                <span>Nombre</span>
                <input
                  type="text"
                  value={extraForm.name}
                  placeholder="Ej: Pan"
                  onChange={(event) => setExtraForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>

              <label className={moduleStyles.field}>
                <span>Cómo se carga</span>
                <select
                  value={extraForm.mode}
                  onChange={(event) =>
                    setExtraForm((current) => ({
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

            {extraForm.mode === EXTRA_MODES.direct ? (
              <>
                <div className={moduleStyles.twoColumnGrid}>
                  <label className={moduleStyles.field}>
                    <span>Cantidad</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={extraForm.quantity}
                      placeholder="Ej: 2"
                      onChange={(event) => setExtraForm((current) => ({ ...current, quantity: event.target.value }))}
                      required
                    />
                  </label>

                  <label className={moduleStyles.field}>
                    <span>Unidad</span>
                    <select
                      value={extraForm.unit}
                      onChange={(event) => setExtraForm((current) => ({ ...current, unit: event.target.value }))}
                    >
                      {FOOD_UNITS.map((unit) => (
                        <option key={unit.value} value={unit.value}>{unit.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <PurchasePlaceInput
                  value={extraForm.purchasePlace}
                  onChange={(purchasePlace) => setExtraForm((current) => ({ ...current, purchasePlace }))}
                  suggestions={purchasePlaceSuggestions}
                />
              </>
            ) : (
              <IngredientEditor
                ingredients={extraForm.ingredients}
                purchasePlaceSuggestions={purchasePlaceSuggestions}
                onChange={(ingredients) => setExtraForm((current) => ({ ...current, ingredients }))}
              />
            )}

            <div className={moduleStyles.formActions}>
              <button type="submit" className={moduleStyles.primaryButton} disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : editingExtraId ? 'Guardar cambios' : 'Guardar recurrente'}
              </button>
              <button type="button" className={moduleStyles.secondaryButton} onClick={closeForms} disabled={isSubmitting}>
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        {!isLoading && extras.length === 0 ? (
          <div className={moduleStyles.compactEmptyState}>Todavía no hay extras recurrentes.</div>
        ) : null}

        {extras.length > 0 ? (
          <div className={moduleStyles.cardsList}>
            {extras.map((extra) => (
              <article key={extra.id} className={moduleStyles.itemCard}>
                <div className={moduleStyles.itemHeader}>
                  <div className={moduleStyles.itemTitle}>
                    <h3>{extra.name}</h3>
                    <div className={moduleStyles.metaRow}>
                      <span className={moduleStyles.warmBadge}>Extra</span>
                      {extra.mode === EXTRA_MODES.direct ? (
                        <span className={moduleStyles.metaBadge}>
                          {formatFoodQuantity(extra.quantity)} {extra.unit}
                        </span>
                      ) : (
                        <span className={moduleStyles.metaBadge}>
                          {(extra.ingredients || []).length} ingredientes
                        </span>
                      )}
                      {extra.purchasePlace ? <span className={moduleStyles.metaBadge}>{extra.purchasePlace}</span> : null}
                      <span className={moduleStyles.metaBadge}>Compartido con {(extra.accessUserIds || []).length || 1}</span>
                    </div>
                  </div>

                  <div className={moduleStyles.itemActions}>
                    <button type="button" className={moduleStyles.iconButton} onClick={() => handleEditExtra(extra)} aria-label={`Editar ${extra.name}`}>
                      <FiEdit2 aria-hidden="true" />
                    </button>
                    {extra.createdBy === currentUser.uid && (extra.accessUserIds || []).length <= 1 ? (
                      <button type="button" className={moduleStyles.iconDangerButton} onClick={() => handleDeleteItem(extra)} aria-label={`Borrar ${extra.name}`}>
                        <FiTrash2 aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {extra.mode === EXTRA_MODES.recipe && (extra.ingredients || []).length > 0 ? (
                  <ul className={moduleStyles.ingredientSummary}>
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
        ) : null}
      </section>

      <section className={moduleStyles.section}>
        <div className={moduleStyles.sectionHeader}>
          <div>
            <h2>Bebidas recurrentes</h2>
            <p>Guardá cantidades fijas o consumos por persona y día. Las personas se eligen recién al importar al viaje.</p>
          </div>
          <button type="button" className={moduleStyles.primaryButton} onClick={openNewDrink}>
            <FiPlus aria-hidden="true" />
            Nueva bebida
          </button>
        </div>

        {openForm === RECURRING_ITEM_KINDS.drink ? (
          <form className={moduleStyles.formCard} onSubmit={handleSubmitDrink}>
            <div className={moduleStyles.twoColumnGrid}>
              <label className={moduleStyles.field}>
                <span>Nombre</span>
                <input
                  type="text"
                  value={drinkForm.name}
                  placeholder="Ej: Coca Cola"
                  onChange={(event) => setDrinkForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>

              <label className={moduleStyles.field}>
                <span>Tipo de cálculo</span>
                <select
                  value={drinkForm.calculationMode}
                  onChange={(event) =>
                    setDrinkForm((current) => ({
                      ...current,
                      calculationMode: event.target.value,
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

            <div className={moduleStyles.twoColumnGrid}>
              <label className={moduleStyles.field}>
                <span>
                  {drinkForm.calculationMode === DRINK_CALCULATION_MODES.perPersonPerDay
                    ? 'Cantidad por persona y por día'
                    : 'Cantidad total'}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={drinkForm.quantity}
                  placeholder="Ej: 0,5"
                  onChange={(event) => setDrinkForm((current) => ({ ...current, quantity: event.target.value }))}
                  required
                />
              </label>

              <label className={moduleStyles.field}>
                <span>Unidad</span>
                <select
                  value={drinkForm.unit}
                  onChange={(event) => setDrinkForm((current) => ({ ...current, unit: event.target.value }))}
                >
                  {FOOD_UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <PurchasePlaceInput
              value={drinkForm.purchasePlace}
              onChange={(purchasePlace) => setDrinkForm((current) => ({ ...current, purchasePlace }))}
              suggestions={purchasePlaceSuggestions}
            />

            {drinkForm.calculationMode === DRINK_CALCULATION_MODES.perPersonPerDay ? (
              <div className={moduleStyles.twoColumnGrid}>
                <label className={moduleStyles.field}>
                  <span>Días de consumo</span>
                  <select
                    value={drinkForm.coverageMode}
                    onChange={(event) =>
                      setDrinkForm((current) => ({
                        ...current,
                        coverageMode: event.target.value,
                        coverageDays: '',
                      }))
                    }
                  >
                    <option value={DRINK_COVERAGE_MODES.trip}>Todos los días del viaje</option>
                    <option value={DRINK_COVERAGE_MODES.custom}>Cantidad personalizada</option>
                  </select>
                </label>

                {drinkForm.coverageMode === DRINK_COVERAGE_MODES.custom ? (
                  <label className={moduleStyles.field}>
                    <span>Cantidad de días</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={drinkForm.coverageDays}
                      onChange={(event) => setDrinkForm((current) => ({ ...current, coverageDays: event.target.value }))}
                      required
                    />
                  </label>
                ) : <div />}
              </div>
            ) : null}

            <div className={moduleStyles.infoBox}>
              Las plantillas por persona no guardan participantes. Al importarlas se seleccionan automáticamente todos los participantes actuales del viaje.
            </div>

            <div className={moduleStyles.formActions}>
              <button type="submit" className={moduleStyles.primaryButton} disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : editingDrinkId ? 'Guardar cambios' : 'Guardar recurrente'}
              </button>
              <button type="button" className={moduleStyles.secondaryButton} onClick={closeForms} disabled={isSubmitting}>
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        {!isLoading && drinks.length === 0 ? (
          <div className={moduleStyles.compactEmptyState}>Todavía no hay bebidas recurrentes.</div>
        ) : null}

        {drinks.length > 0 ? (
          <div className={moduleStyles.cardsList}>
            {drinks.map((drink) => (
              <article key={drink.id} className={moduleStyles.itemCard}>
                <div className={moduleStyles.itemHeader}>
                  <div className={moduleStyles.itemTitle}>
                    <h3>{drink.name}</h3>
                    <div className={moduleStyles.metaRow}>
                      <span className={moduleStyles.accentBadge}>Bebida</span>
                      <span className={moduleStyles.metaBadge}>
                        {drink.calculationMode === DRINK_CALCULATION_MODES.fixed
                          ? `${formatFoodQuantity(drink.quantity)} ${drink.unit} fijos`
                          : `${formatFoodQuantity(drink.quantity)} ${drink.unit} / persona / día`}
                      </span>
                      {drink.calculationMode === DRINK_CALCULATION_MODES.perPersonPerDay ? (
                        <span className={moduleStyles.metaBadge}>
                          {drink.coverageMode === DRINK_COVERAGE_MODES.custom
                            ? `${drink.coverageDays} días`
                            : 'Todo el viaje'}
                        </span>
                      ) : null}
                      {drink.purchasePlace ? <span className={moduleStyles.metaBadge}>{drink.purchasePlace}</span> : null}
                      <span className={moduleStyles.metaBadge}>Compartida con {(drink.accessUserIds || []).length || 1}</span>
                    </div>
                  </div>

                  <div className={moduleStyles.itemActions}>
                    <button type="button" className={moduleStyles.iconButton} onClick={() => handleEditDrink(drink)} aria-label={`Editar ${drink.name}`}>
                      <FiEdit2 aria-hidden="true" />
                    </button>
                    {drink.createdBy === currentUser.uid && (drink.accessUserIds || []).length <= 1 ? (
                      <button type="button" className={moduleStyles.iconDangerButton} onClick={() => handleDeleteItem(drink)} aria-label={`Borrar ${drink.name}`}>
                        <FiTrash2 aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className={moduleStyles.section}>
        <div className={moduleStyles.sectionHeader}>
          <div>
            <h2>Habituales</h2>
            <p>Agrupá los recurrentes que suelen ir juntos para agregarlos a un viaje con una sola acción.</p>
          </div>
          <button
            type="button"
            className={moduleStyles.primaryButton}
            onClick={openNewPreset}
            disabled={items.length === 0}
          >
            <FiPlus aria-hidden="true" />
            Nuevo habitual
          </button>
        </div>

        {openForm === 'preset' ? (
          <form className={moduleStyles.formCard} onSubmit={handleSubmitPreset}>
            <label className={moduleStyles.field}>
              <span>Nombre</span>
              <input
                type="text"
                value={presetForm.name}
                placeholder="Ej: Habituales del finde"
                onChange={(event) => setPresetForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>

            <div className={styles.presetPicker}>
              {items.map((item) => (
                <label key={item.id} className={styles.presetOption}>
                  <input
                    type="checkbox"
                    checked={presetForm.itemIds.includes(item.id)}
                    onChange={() => togglePresetItem(item.id)}
                  />
                  <span className={styles.presetOptionIcon}>
                    {item.kind === RECURRING_ITEM_KINDS.extra
                      ? <FiPackage aria-hidden="true" />
                      : <FiCoffee aria-hidden="true" />}
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.kind === RECURRING_ITEM_KINDS.extra ? 'Extra' : 'Bebida'}</small>
                  </span>
                </label>
              ))}
            </div>

            <div className={moduleStyles.formActions}>
              <button type="submit" className={moduleStyles.primaryButton} disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : editingPresetId ? 'Guardar cambios' : 'Guardar habitual'}
              </button>
              <button type="button" className={moduleStyles.secondaryButton} onClick={closeForms} disabled={isSubmitting}>
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        {!isLoading && presets.length === 0 ? (
          <div className={moduleStyles.compactEmptyState}>
            Todavía no hay Habituales. Primero guardá al menos un extra o una bebida recurrente.
          </div>
        ) : null}

        {presets.length > 0 ? (
          <div className={moduleStyles.cardsList}>
            {presets.map((preset) => {
              const presetItems = (preset.itemIds || [])
                .map((itemId) => itemsById.get(itemId))
                .filter(Boolean);

              return (
                <article key={preset.id} className={moduleStyles.itemCard}>
                  <div className={moduleStyles.itemHeader}>
                    <div className={moduleStyles.itemTitle}>
                      <h3>{preset.name}</h3>
                      <div className={moduleStyles.metaRow}>
                        <span className={moduleStyles.accentBadge}>{presetItems.length} recurrentes</span>
                        <span className={moduleStyles.metaBadge}>Compartido con {(preset.accessUserIds || []).length || 1}</span>
                      </div>
                    </div>

                    <div className={moduleStyles.itemActions}>
                      <button type="button" className={moduleStyles.iconButton} onClick={() => handleEditPreset(preset)} aria-label={`Editar ${preset.name}`}>
                        <FiEdit2 aria-hidden="true" />
                      </button>
                      {preset.createdBy === currentUser.uid && (preset.accessUserIds || []).length <= 1 ? (
                        <button type="button" className={moduleStyles.iconDangerButton} onClick={() => handleDeletePreset(preset)} aria-label={`Borrar ${preset.name}`}>
                          <FiTrash2 aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.presetContents}>
                    {presetItems.map((item) => (
                      <span key={item.id}>{item.name}</span>
                    ))}
                    {presetItems.length < (preset.itemIds || []).length ? (
                      <span>Hay elementos que ya no están disponibles.</span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </section>
  );
}

export default RecurringFoodLibraryPage;
