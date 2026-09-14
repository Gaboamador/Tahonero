import { useEffect, useRef, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { FOOD_UNITS } from '@/features/meals/constants/mealConstants';
import PurchasePlaceInput from '@/features/meals/components/PurchasePlaceInput';
import { createEmptyIngredient } from '@/features/meals/utils/mealUtils';
import styles from './MealsModule.module.scss';

function IngredientEditor({ ingredients, onChange, purchasePlaceSuggestions = [] }) {
  const nameInputRefs = useRef(new Map());
  const [pendingFocusId, setPendingFocusId] = useState('');

  useEffect(() => {
    if (!pendingFocusId) {
      return;
    }

    const input = nameInputRefs.current.get(pendingFocusId);

    if (input) {
      input.focus();
      setPendingFocusId('');
    }
  }, [ingredients, pendingFocusId]);

  const handleAdd = () => {
    const ingredient = createEmptyIngredient();
    onChange([...ingredients, ingredient]);
    setPendingFocusId(ingredient.id);
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
      </div>

      {ingredients.length === 0 ? (
        <div className={styles.compactEmptyState}>Sin ingredientes cargados.</div>
      ) : (
        <div className={styles.ingredientRows}>
          {ingredients.map((ingredient) => (
            <div key={ingredient.id} className={styles.ingredientRow}>
              <label className={`${styles.field} ${styles.ingredientNameField}`}>
                <span>Ingrediente</span>
                <input
                  ref={(node) => {
                    if (node) {
                      nameInputRefs.current.set(ingredient.id, node);
                    } else {
                      nameInputRefs.current.delete(ingredient.id);
                    }
                  }}
                  type="text"
                  value={ingredient.name}
                  placeholder="Ej: Harina"
                  onChange={(event) => handleChange(ingredient.id, 'name', event.target.value)}
                />
              </label>

              <label className={`${styles.field} ${styles.ingredientQuantityField}`}>
                <span>Cantidad</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ingredient.quantity}
                  placeholder="Ej: 1000"
                  onChange={(event) => handleChange(ingredient.id, 'quantity', event.target.value)}
                />
              </label>

              <label className={`${styles.field} ${styles.ingredientUnitField}`}>
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
                className={styles.ingredientPlaceField}
              />

              <button
                type="button"
                className={`${styles.iconDangerButton} ${styles.ingredientDeleteButton}`}
                onClick={() => handleRemove(ingredient.id)}
                aria-label={`Eliminar ingrediente ${ingredient.name || ''}`}
              >
                <FiTrash2 aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" className={styles.addIngredientButton} onClick={handleAdd}>
        <FiPlus aria-hidden="true" />
        Agregar ingrediente
      </button>
    </div>
  );
}

export default IngredientEditor;
