export function createLocalId(prefix = 'item') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createEmptyIngredient() {
  return {
    id: createLocalId('ingredient'),
    name: '',
    quantity: '',
    unit: 'g',
    purchasePlace: '',
  };
}

export function parseFoodQuantity(value) {
  const parsed = Number(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function formatFoodQuantity(value) {
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 3,
  }).format(Number(value) || 0);
}

export function getMealPlanSlotId(date, mealType) {
  return `${date}_${mealType}`;
}

export function calculateMealDemand({ mealId, mealPlans = [], participantCount = 0, servings = 1 }) {
  const occurrences = mealPlans.filter(
    (plan) => plan.assignmentType === 'meal' && plan.mealId === mealId,
  ).length;

  const requiredServings = occurrences * participantCount;
  const safeServings = Number(servings) > 0 ? Number(servings) : 1;
  const recipeFactor = requiredServings > 0 ? requiredServings / safeServings : 0;

  return {
    occurrences,
    requiredServings,
    recipeFactor,
  };
}

export function calculateDrinkTotal({ drinkPlan, tripDaysCount = 0 }) {
  if (!drinkPlan) {
    return 0;
  }

  const quantity = Number(drinkPlan.quantity) || 0;

  if (drinkPlan.calculationMode === 'fixed') {
    return quantity;
  }

  const participantsCount = Array.isArray(drinkPlan.participantIds)
    ? drinkPlan.participantIds.length
    : 0;

  const days =
    drinkPlan.coverageMode === 'custom'
      ? Number(drinkPlan.coverageDays) || 0
      : tripDaysCount;

  return quantity * participantsCount * days;
}

export function collectPurchasePlaces({ meals = [], foodExtras = [], drinkPlans = [], libraryRecipes = [] } = {}) {
  const places = new Map();

  const addPlace = (value) => {
    const clean = String(value || '').trim();
    const key = clean.toLocaleLowerCase('es');

    if (clean && !places.has(key)) {
      places.set(key, clean);
    }
  };

  [...meals, ...libraryRecipes].forEach((meal) => {
    (meal.ingredients || []).forEach((ingredient) => addPlace(ingredient.purchasePlace));
  });

  foodExtras.forEach((extra) => {
    addPlace(extra.purchasePlace);
    (extra.ingredients || []).forEach((ingredient) => addPlace(ingredient.purchasePlace));
  });

  drinkPlans.forEach((drink) => addPlace(drink.purchasePlace));

  return Array.from(places.values()).sort((a, b) => a.localeCompare(b, 'es'));
}
