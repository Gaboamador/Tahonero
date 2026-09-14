import { FOOD_UNIT_VALUES } from '@/features/meals/constants/mealConstants';
import { createLocalId, parseFoodQuantity } from '@/features/meals/utils/mealUtils';

export function isBlankIngredient(ingredient) {
  return (
    !String(ingredient?.name || '').trim() &&
    !String(ingredient?.quantity ?? '').trim() &&
    !String(ingredient?.purchasePlace || '').trim()
  );
}

export function normalizeIngredient(ingredient) {
  const name = String(ingredient?.name || '').trim();
  const quantity = parseFoodQuantity(ingredient?.quantity);
  const unit = String(ingredient?.unit || '').trim();
  const purchasePlace = String(ingredient?.purchasePlace || '').trim();

  if (!name || quantity <= 0 || !FOOD_UNIT_VALUES.includes(unit)) {
    return null;
  }

  return {
    id: ingredient?.id || createLocalId('ingredient'),
    name,
    quantity,
    unit,
    purchasePlace,
  };
}

export function normalizeIngredients(ingredients = []) {
  return ingredients.filter((ingredient) => !isBlankIngredient(ingredient)).map(normalizeIngredient).filter(Boolean);
}

export function validateMealPayload({ name, servings, ingredients }) {
  const cleanName = String(name || '').trim();
  const parsedServings = Number(servings);
  const meaningfulIngredients = (ingredients || []).filter(
    (ingredient) => !isBlankIngredient(ingredient),
  );
  const cleanIngredients = normalizeIngredients(ingredients);

  if (!cleanName) {
    throw new Error('El nombre de la comida es obligatorio.');
  }

  if (!Number.isInteger(parsedServings) || parsedServings <= 0) {
    throw new Error('Indicá para cuántas personas rinde la comida.');
  }

  if (meaningfulIngredients.length !== cleanIngredients.length) {
    throw new Error('Revisá los ingredientes: todos necesitan nombre, cantidad y unidad.');
  }

  return {
    name: cleanName,
    servings: parsedServings,
    ingredients: cleanIngredients,
  };
}
