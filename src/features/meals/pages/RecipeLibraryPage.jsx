import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import IngredientEditor from '@/features/meals/components/IngredientEditor';
import moduleStyles from '@/features/meals/components/MealsModule.module.scss';
import { useRecipeLibrary } from '@/features/meals/hooks/useRecipeLibrary';
import {
  createLibraryRecipe,
  deleteLibraryRecipe,
  updateLibraryRecipe,
} from '@/features/meals/services/recipeLibraryService';
import {
  collectPurchasePlaces,
  createEmptyIngredient,
  createLocalId,
  formatFoodQuantity,
} from '@/features/meals/utils/mealUtils';
import { useAuth } from '@/hooks/useAuth';
import styles from './RecipeLibraryPage.module.scss';

function createEmptyForm() {
  return {
    name: '',
    servings: '1',
    ingredients: [createEmptyIngredient()],
  };
}

function RecipeLibraryPage() {
  const { currentUser } = useAuth();
  const { recipes, isLoading, error: loadError } = useRecipeLibrary(currentUser?.uid);
  const [formData, setFormData] = useState(createEmptyForm);
  const [editingRecipeId, setEditingRecipeId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const purchasePlaceSuggestions = collectPurchasePlaces({ libraryRecipes: recipes });

  const resetForm = () => {
    setFormData(createEmptyForm());
    setEditingRecipeId('');
    setIsFormOpen(false);
    setError('');
  };

  const handleEdit = (recipe) => {
    setEditingRecipeId(recipe.id);
    setFormData({
      name: recipe.name || '',
      servings: String(recipe.servings || 1),
      ingredients:
        (recipe.ingredients || []).length > 0
          ? recipe.ingredients.map((ingredient) => ({
              ...ingredient,
              id: ingredient.id || createLocalId('ingredient'),
              quantity: String(ingredient.quantity ?? ''),
              purchasePlace: ingredient.purchasePlace || '',
            }))
          : [createEmptyIngredient()],
    });
    setError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (editingRecipeId) {
        await updateLibraryRecipe({
          recipeId: editingRecipeId,
          ...formData,
        });
      } else {
        await createLibraryRecipe({
          userUid: currentUser.uid,
          ...formData,
        });
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar la receta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (recipe) => {
    if (!window.confirm(`¿Borrar "${recipe.name}" de la biblioteca compartida? Los viajes que ya la importaron no se modifican.`)) {
      return;
    }

    setError('');

    try {
      await deleteLibraryRecipe({ userUid: currentUser.uid, recipe });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo borrar la receta.');
    }
  };

  return (
    <section className={styles.page}>
      <Link to="/" className={styles.backLink}>
        <FiArrowLeft aria-hidden="true" />
        Volver al inicio
      </Link>

      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Biblioteca compartida</p>
          <h1>Comidas guardadas</h1>
          <p>
            Las recetas se comparten con las personas con las que las usás en un viaje. Al importarlas, cada viaje recibe una copia independiente.
          </p>
        </div>

        <button
          type="button"
          className={moduleStyles.primaryButton}
          onClick={() => {
            if (isFormOpen && !editingRecipeId) {
              resetForm();
            } else {
              setFormData(createEmptyForm());
              setEditingRecipeId('');
              setError('');
              setIsFormOpen(true);
            }
          }}
        >
          <FiPlus aria-hidden="true" />
          Nueva comida
        </button>
      </div>

      {loadError ? <p className={moduleStyles.error}>{loadError}</p> : null}
      {error ? <p className={moduleStyles.error}>{error}</p> : null}

      {isFormOpen ? (
        <form className={moduleStyles.formCard} onSubmit={handleSubmit}>
          <div className={moduleStyles.twoColumnGrid}>
            <label className={moduleStyles.field}>
              <span>Nombre</span>
              <input
                type="text"
                value={formData.name}
                placeholder="Ej: Pizza"
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>

            <label className={moduleStyles.field}>
              <span>Rinde para</span>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.servings}
                onChange={(event) => setFormData((current) => ({ ...current, servings: event.target.value }))}
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

          <div className={moduleStyles.formActions}>
            <button type="submit" className={moduleStyles.primaryButton} disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : editingRecipeId ? 'Guardar cambios' : 'Guardar receta'}
            </button>
            <button type="button" className={moduleStyles.secondaryButton} onClick={resetForm} disabled={isSubmitting}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {isLoading ? <div className={styles.loading}>Cargando biblioteca...</div> : null}

      {!isLoading && recipes.length === 0 ? (
        <div className={moduleStyles.emptyState}>
          <strong>Todavía no tenés comidas disponibles.</strong>
          <span>Las recetas que crees o recibas al compartir un viaje van a poder reutilizarse en viajes futuros.</span>
        </div>
      ) : null}

      {!isLoading && recipes.length > 0 ? (
        <div className={moduleStyles.cardsList}>
          {recipes.map((recipe) => (
            <article key={recipe.id} className={moduleStyles.itemCard}>
              <div className={moduleStyles.itemHeader}>
                <div className={moduleStyles.itemTitle}>
                  <h3>{recipe.name}</h3>
                  <div className={moduleStyles.metaRow}>
                    <span className={moduleStyles.metaBadge}>Rinde {recipe.servings} personas</span>
                    <span className={moduleStyles.metaBadge}>
                      {(recipe.ingredients || []).length} {(recipe.ingredients || []).length === 1 ? 'ingrediente' : 'ingredientes'}
                    </span>
                    <span className={moduleStyles.metaBadge}>Compartida con {(recipe.accessUserIds || []).length || 1}</span>
                  </div>
                </div>

                <div className={moduleStyles.itemActions}>
                  <button type="button" className={moduleStyles.iconButton} onClick={() => handleEdit(recipe)} aria-label={`Editar ${recipe.name}`}>
                    <FiEdit2 aria-hidden="true" />
                  </button>
                  {recipe.createdBy === currentUser.uid && (recipe.accessUserIds || []).length <= 1 ? (
                    <button type="button" className={moduleStyles.iconDangerButton} onClick={() => handleDelete(recipe)} aria-label={`Borrar ${recipe.name}`}>
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>

              {(recipe.ingredients || []).length > 0 ? (
                <ul className={moduleStyles.ingredientSummary}>
                  {recipe.ingredients.map((ingredient) => (
                    <li key={ingredient.id || `${recipe.id}-${ingredient.name}`}>
                      <span>
                        {ingredient.name}
                        {ingredient.purchasePlace ? <small> · {ingredient.purchasePlace}</small> : null}
                      </span>
                      <span>{formatFoodQuantity(ingredient.quantity)} {ingredient.unit}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={moduleStyles.compactEmptyState}>Sin ingredientes.</div>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default RecipeLibraryPage;
