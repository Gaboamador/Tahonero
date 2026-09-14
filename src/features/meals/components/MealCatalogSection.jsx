import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBookOpen, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import IngredientEditor from '@/features/meals/components/IngredientEditor';
import {
  createMeal,
  createMealAndLibraryRecipe,
  deleteMeal,
  saveTripMealToLibrary,
  updateMeal,
} from '@/features/meals/services/mealService';
import {
  calculateMealDemand,
  createLocalId,
  formatFoodQuantity,
} from '@/features/meals/utils/mealUtils';
import styles from './MealsModule.module.scss';

function createEmptyForm(participantCount) {
  return {
    name: '',
    servings: String(Math.max(participantCount, 1)),
    ingredients: [],
  };
}

function MealCatalogSection({
  groupId,
  meals,
  mealPlan,
  participantCount,
  currentUserUid,
  libraryRecipes = [],
  libraryLoading = false,
  purchasePlaceSuggestions = [],
}) {
  const [formData, setFormData] = useState(() => createEmptyForm(participantCount));
  const [editingMealId, setEditingMealId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [importingRecipeId, setImportingRecipeId] = useState('');
  const [savingMealId, setSavingMealId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setFormData(createEmptyForm(participantCount));
    setEditingMealId('');
    setIsFormOpen(false);
    setSaveToLibrary(true);
    setError('');
  };

  const handleOpenCreate = () => {
    setFormData(createEmptyForm(participantCount));
    setEditingMealId('');
    setSaveToLibrary(true);
    setIsLibraryOpen(false);
    setError('');
    setIsFormOpen(true);
  };

  const handleEdit = (meal) => {
    setEditingMealId(meal.id);
    setFormData({
      name: meal.name || '',
      servings: String(meal.servings || Math.max(participantCount, 1)),
      ingredients: (meal.ingredients || []).map((ingredient) => ({
        ...ingredient,
        id: ingredient.id || createLocalId('ingredient'),
        quantity: String(ingredient.quantity ?? ''),
        purchasePlace: ingredient.purchasePlace || '',
      })),
    });
    setIsLibraryOpen(false);
    setError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (editingMealId) {
        await updateMeal({
          groupId,
          mealId: editingMealId,
          ...formData,
        });
      } else if (saveToLibrary) {
        await createMealAndLibraryRecipe({
          groupId,
          ...formData,
          createdBy: currentUserUid,
        });
      } else {
        await createMeal({
          groupId,
          ...formData,
          createdBy: currentUserUid,
        });
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar la comida.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImport = async (recipe) => {
    const alreadyImported = meals.some(
      (meal) =>
        meal.sourceRecipeId === recipe.id && meal.sourceRecipeOwnerUid === currentUserUid,
    );

    if (alreadyImported) {
      setError(`"${recipe.name}" ya está importada en este viaje.`);
      return;
    }

    setError('');
    setImportingRecipeId(recipe.id);

    try {
      await createMeal({
        groupId,
        name: recipe.name,
        servings: recipe.servings,
        ingredients: recipe.ingredients || [],
        createdBy: currentUserUid,
        sourceRecipeId: recipe.id,
        sourceRecipeOwnerUid: currentUserUid,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo importar la comida.');
    } finally {
      setImportingRecipeId('');
    }
  };

  const handleSaveExistingToLibrary = async (meal) => {
    setError('');
    setSavingMealId(meal.id);

    try {
      await saveTripMealToLibrary({
        groupId,
        meal,
        currentUserUid,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar la comida en la biblioteca.');
    } finally {
      setSavingMealId('');
    }
  };

  const handleDelete = async (meal) => {
    if (!window.confirm(`¿Borrar "${meal.name}" del catálogo de este viaje?`)) {
      return;
    }

    setError('');

    try {
      await deleteMeal({ groupId, mealId: meal.id });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo borrar la comida.');
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Comidas del viaje</h2>
          <p>
            Importá una receta guardada o creá una comida específica para este viaje. Las importadas son copias independientes.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              setIsLibraryOpen((current) => !current);
              setIsFormOpen(false);
              setEditingMealId('');
              setError('');
            }}
          >
            <FiBookOpen aria-hidden="true" />
            Desde mi biblioteca
          </button>

          <button type="button" className={styles.primaryButton} onClick={handleOpenCreate}>
            <FiPlus aria-hidden="true" />
            Nueva comida
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {isLibraryOpen ? (
        <div className={styles.formCard}>
          <div className={styles.subsectionHeader}>
            <div>
              <strong>Mi biblioteca</strong>
              <span>Importar crea una snapshot dentro del viaje.</span>
            </div>
            <Link to="/biblioteca-comidas" className={styles.textLink}>Administrar biblioteca</Link>
          </div>

          {libraryLoading ? <div className={styles.compactEmptyState}>Cargando biblioteca...</div> : null}

          {!libraryLoading && libraryRecipes.length === 0 ? (
            <div className={styles.compactEmptyState}>
              No tenés comidas guardadas todavía. Podés crear una nueva y marcar “Guardar también en mi biblioteca”.
            </div>
          ) : null}

          {!libraryLoading && libraryRecipes.length > 0 ? (
            <div className={styles.libraryList}>
              {libraryRecipes.map((recipe) => {
                const alreadyImported = meals.some(
                  (meal) => meal.sourceRecipeId === recipe.id && meal.sourceRecipeOwnerUid === currentUserUid,
                );

                return (
                  <div key={recipe.id} className={styles.libraryRow}>
                    <div>
                      <strong>{recipe.name}</strong>
                      <span>Rinde {recipe.servings} · {(recipe.ingredients || []).length} ingredientes</span>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => handleImport(recipe)}
                      disabled={alreadyImported || importingRecipeId === recipe.id}
                    >
                      {alreadyImported
                        ? 'Ya importada'
                        : importingRecipeId === recipe.id
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
                placeholder="Ej: Pizza"
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Rinde para</span>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.servings}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, servings: event.target.value }))
                }
                required
              />
              <span>personas / porciones por receta base</span>
            </label>
          </div>

          <IngredientEditor
            ingredients={formData.ingredients}
            purchasePlaceSuggestions={purchasePlaceSuggestions}
            onChange={(ingredients) => setFormData((current) => ({ ...current, ingredients }))}
          />

          {!editingMealId ? (
            <label className={styles.inlineCheckbox}>
              <input
                type="checkbox"
                checked={saveToLibrary}
                onChange={(event) => setSaveToLibrary(event.target.checked)}
              />
              <span>Guardar también en mi biblioteca para reutilizarla en otros viajes</span>
            </label>
          ) : (
            <div className={styles.infoBox}>
              Los cambios de esta comida afectan sólo a este viaje, aunque haya sido importada desde tu biblioteca.
            </div>
          )}

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : editingMealId ? 'Guardar cambios' : 'Crear comida'}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={resetForm} disabled={isSubmitting}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {meals.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>Todavía no hay comidas en este viaje.</strong>
          <span>Importá una de tu biblioteca o creá una nueva para poder asignarla al calendario.</span>
        </div>
      ) : (
        <div className={styles.cardsList}>
          {meals.map((meal) => {
            const demand = calculateMealDemand({
              mealId: meal.id,
              mealPlans: mealPlan,
              participantCount,
              servings: meal.servings,
            });

            return (
              <article key={meal.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <div className={styles.itemTitle}>
                    <h3>{meal.name}</h3>
                    <div className={styles.metaRow}>
                      <span className={styles.metaBadge}>Rinde {meal.servings} personas</span>
                      <span className={styles.metaBadge}>
                        {(meal.ingredients || []).length} {(meal.ingredients || []).length === 1 ? 'ingrediente' : 'ingredientes'}
                      </span>
                      {meal.sourceRecipeId ? <span className={styles.accentBadge}>De biblioteca</span> : null}
                      {demand.occurrences > 0 ? (
                        <span className={styles.accentBadge}>
                          {demand.occurrences} {demand.occurrences === 1 ? 'comida' : 'comidas'} · {demand.requiredServings} porciones · {formatFoodQuantity(demand.recipeFactor)} receta base
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.itemActions}>
                    {!meal.sourceRecipeId ? (
                      <button
                        type="button"
                        className={styles.compactTextButton}
                        onClick={() => handleSaveExistingToLibrary(meal)}
                        disabled={savingMealId === meal.id}
                      >
                        <FiBookOpen aria-hidden="true" />
                        {savingMealId === meal.id ? 'Guardando...' : 'Guardar en biblioteca'}
                      </button>
                    ) : null}
                    <button type="button" className={styles.iconButton} onClick={() => handleEdit(meal)} aria-label={`Editar ${meal.name}`}>
                      <FiEdit2 aria-hidden="true" />
                    </button>
                    <button type="button" className={styles.iconDangerButton} onClick={() => handleDelete(meal)} aria-label={`Borrar ${meal.name}`}>
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {(meal.ingredients || []).length > 0 ? (
                  <ul className={styles.ingredientSummary}>
                    {meal.ingredients.map((ingredient) => (
                      <li key={ingredient.id || `${meal.id}-${ingredient.name}`}>
                        <span>
                          {ingredient.name}
                          {ingredient.purchasePlace ? <small> · {ingredient.purchasePlace}</small> : null}
                        </span>
                        <span>{formatFoodQuantity(ingredient.quantity)} {ingredient.unit}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.compactEmptyState}>Sin ingredientes: útil para comer afuera, pedir delivery u otras comidas que no generan compras.</div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default MealCatalogSection;
