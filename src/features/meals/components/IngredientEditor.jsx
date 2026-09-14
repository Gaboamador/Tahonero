import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { FOOD_UNITS } from '@/features/meals/constants/mealConstants';
import PurchasePlaceInput from '@/features/meals/components/PurchasePlaceInput';
import { createLocalId } from '@/features/meals/utils/mealUtils';
import styles from './MealsModule.module.scss';

function IngredientEditor({ ingredients, onChange, purchasePlaceSuggestions = [] }) {
  const handleAdd = () => {
    onChange([
      ...ingredients,
      {
        id: createLocalId('ingredient'),
        name: '',
        quantity: '',
        unit: 'g',
        purchasePlace: '',
      },
    ]);
  };

  const handleChange = (ingredientId, field, value) => {
    onChange(
      ingredients.map((ingredient) =>
        ingredient.id === ingredientId ? { ...ingredient, [field]: value } : ingredient,
      ),
    );
  };

  const handleRemove = (ingredientId) => {
    onChange(ingredients.filter((ingredient) => ingredient.id !== ingredientId));
  };

  return (
    <div className={styles.ingredientsEditor}>
      <div className={styles.subsectionHeader}>
        <div>
          <strong>Ingredientes</strong>
          <span>Opcionales. Podés indicar también dónde se compra cada ingrediente.</span>
        </div>

        <button type="button" className={styles.secondaryButton} onClick={handleAdd}>
          <FiPlus aria-hidden="true" />
          Agregar ingrediente
        </button>
      </div>

      {ingredients.length === 0 ? (
        <div className={styles.compactEmptyState}>Sin ingredientes cargados.</div>
      ) : (
        <div className={styles.ingredientRows}>
          {ingredients.map((ingredient) => (
            <div key={ingredient.id} className={styles.ingredientRow}>
              <label className={styles.field}>
                <span>Ingrediente</span>
                <input
                  type="text"
                  value={ingredient.name}
                  placeholder="Ej: Harina"
                  onChange={(event) => handleChange(ingredient.id, 'name', event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span>Cantidad</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ingredient.quantity}
                  placeholder="Ej: 1000"
                  onChange={(event) => handleChange(ingredient.id, 'quantity', event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span>Unidad</span>
                <select
                  value={ingredient.unit}
                  onChange={(event) => handleChange(ingredient.id, 'unit', event.target.value)}
                >
                  {FOOD_UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </label>

              <PurchasePlaceInput
                value={ingredient.purchasePlace || ''}
                onChange={(value) => handleChange(ingredient.id, 'purchasePlace', value)}
                suggestions={purchasePlaceSuggestions}
              />

              <button
                type="button"
                className={styles.iconDangerButton}
                onClick={() => handleRemove(ingredient.id)}
                aria-label={`Eliminar ingrediente ${ingredient.name || ''}`}
              >
                <FiTrash2 aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default IngredientEditor;
