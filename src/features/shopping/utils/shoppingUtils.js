import { calculateDrinkTotal, calculateMealDemand, formatFoodQuantity } from '@/features/meals/utils/mealUtils';

const UNIT_FAMILIES = {
  g: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  ml: { family: 'volume', factor: 1 },
  l: { family: 'volume', factor: 1000 },
  unidad: { family: 'unidad', factor: 1 },
  paquete: { family: 'paquete', factor: 1 },
  lata: { family: 'lata', factor: 1 },
  botella: { family: 'botella', factor: 1 },
};

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getUnitInfo(unit) {
  return UNIT_FAMILIES[unit] || { family: unit || 'unknown', factor: 1 };
}

function toBaseQuantity(quantity, unit) {
  const info = getUnitInfo(unit);
  return (Number(quantity) || 0) * info.factor;
}

function formatCombinedQuantity(baseQuantity, family) {
  if (family === 'mass') {
    if (baseQuantity >= 1000) {
      return { quantity: baseQuantity / 1000, unit: 'kg' };
    }

    return { quantity: baseQuantity, unit: 'g' };
  }

  if (family === 'volume') {
    if (baseQuantity >= 1000) {
      return { quantity: baseQuantity / 1000, unit: 'l' };
    }

    return { quantity: baseQuantity, unit: 'ml' };
  }

  return { quantity: baseQuantity, unit: family };
}

function addShoppingCandidate(itemsMap, { name, quantity, unit, purchasePlace = '', source }) {
  const numericQuantity = Number(quantity) || 0;
  const cleanName = String(name || '').trim();

  if (!cleanName || numericQuantity <= 0 || !unit) {
    return;
  }

  const cleanPlace = String(purchasePlace || '').trim();
  const { family } = getUnitInfo(unit);
  const groupingKey = [normalizeText(cleanPlace), normalizeText(cleanName), family].join('|');
  const baseQuantity = toBaseQuantity(numericQuantity, unit);

  if (!itemsMap.has(groupingKey)) {
    itemsMap.set(groupingKey, {
      groupingKey,
      name: cleanName,
      purchasePlace: cleanPlace,
      family,
      baseQuantity: 0,
      sources: new Set(),
    });
  }

  const item = itemsMap.get(groupingKey);
  item.baseQuantity += baseQuantity;

  if (source) {
    item.sources.add(source);
  }
}

export function buildShoppingList({
  meals = [],
  mealPlan = [],
  foodExtras = [],
  drinkPlans = [],
  participantCount = 0,
  tripDaysCount = 0,
} = {}) {
  const itemsMap = new Map();

  meals.forEach((meal) => {
    const demand = calculateMealDemand({
      mealId: meal.id,
      mealPlans: mealPlan,
      participantCount,
      servings: meal.servings,
    });

    if (demand.recipeFactor <= 0) {
      return;
    }

    (meal.ingredients || []).forEach((ingredient) => {
      addShoppingCandidate(itemsMap, {
        name: ingredient.name,
        quantity: (Number(ingredient.quantity) || 0) * demand.recipeFactor,
        unit: ingredient.unit,
        purchasePlace: ingredient.purchasePlace,
        source: meal.name,
      });
    });
  });

  foodExtras.forEach((extra) => {
    if (extra.mode === 'direct') {
      addShoppingCandidate(itemsMap, {
        name: extra.name,
        quantity: extra.quantity,
        unit: extra.unit,
        purchasePlace: extra.purchasePlace,
        source: 'Extra',
      });
      return;
    }

    (extra.ingredients || []).forEach((ingredient) => {
      addShoppingCandidate(itemsMap, {
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        purchasePlace: ingredient.purchasePlace,
        source: extra.name,
      });
    });
  });

  drinkPlans.forEach((drinkPlan) => {
    addShoppingCandidate(itemsMap, {
      name: drinkPlan.name,
      quantity: calculateDrinkTotal({ drinkPlan, tripDaysCount }),
      unit: drinkPlan.unit,
      purchasePlace: drinkPlan.purchasePlace,
      source: 'Bebida',
    });
  });

  return Array.from(itemsMap.values())
    .map((item) => {
      const display = formatCombinedQuantity(item.baseQuantity, item.family);
      const itemKey = `item_${hashString(item.groupingKey)}`;
      const signature = `${itemKey}:${item.baseQuantity.toFixed(6)}`;

      return {
        itemKey,
        signature,
        name: item.name,
        purchasePlace: item.purchasePlace,
        quantity: display.quantity,
        unit: display.unit,
        quantityLabel: `${formatFoodQuantity(display.quantity)} ${display.unit}`,
        sources: Array.from(item.sources).sort((a, b) => a.localeCompare(b, 'es')),
      };
    })
    .sort((a, b) => {
      const placeA = a.purchasePlace || '~~~~';
      const placeB = b.purchasePlace || '~~~~';
      const placeDiff = placeA.localeCompare(placeB, 'es', { sensitivity: 'base' });

      if (placeDiff !== 0) {
        return placeDiff;
      }

      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
}

export function groupShoppingItemsByPlace(items = []) {
  const groups = new Map();

  items.forEach((item) => {
    const key = normalizeText(item.purchasePlace) || '__unassigned__';

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: item.purchasePlace || 'Sin lugar asignado',
        isUnassigned: !item.purchasePlace,
        items: [],
      });
    }

    groups.get(key).items.push(item);
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (a.isUnassigned !== b.isUnassigned) {
      return a.isUnassigned ? 1 : -1;
    }

    return a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
  });
}

export function isShoppingItemChecked(item, shoppingState = {}) {
  const state = shoppingState[item.itemKey];
  return Boolean(state?.checked && state?.signature === item.signature);
}
