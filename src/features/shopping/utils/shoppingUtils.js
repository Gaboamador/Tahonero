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

function addShoppingCandidate(
  itemsMap,
  {
    name,
    quantity,
    unit,
    purchasePlace = '',
    source,
    sourceGroup,
  },
) {
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
      sourceGroups: new Map(),
    });
  }

  const item = itemsMap.get(groupingKey);
  item.baseQuantity += baseQuantity;

  if (source) {
    item.sources.add(source);
  }

  if (sourceGroup?.key) {
    if (!item.sourceGroups.has(sourceGroup.key)) {
      item.sourceGroups.set(sourceGroup.key, {
        key: sourceGroup.key,
        type: sourceGroup.type || 'other',
        label: sourceGroup.label || 'Otros',
        baseQuantity: 0,
        details: new Set(),
      });
    }

    const group = item.sourceGroups.get(sourceGroup.key);
    group.baseQuantity += baseQuantity;

    if (sourceGroup.detailLabel) {
      group.details.add(sourceGroup.detailLabel);
    }
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
        sourceGroup: {
          key: `meal:${meal.id || normalizeText(meal.name)}`,
          type: 'meal',
          label: meal.name,
        },
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
        sourceGroup: {
          key: 'extras',
          type: 'extras',
          label: 'Extras',
          detailLabel: extra.name,
        },
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
        sourceGroup: {
          key: 'extras',
          type: 'extras',
          label: 'Extras',
          detailLabel: extra.name,
        },
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
      sourceGroup: {
        key: 'drinks',
        type: 'drinks',
        label: 'Bebidas',
        detailLabel: drinkPlan.name,
      },
    });
  });

  return Array.from(itemsMap.values())
    .map((item) => {
      const display = formatCombinedQuantity(item.baseQuantity, item.family);
      const itemKey = `item_${hashString(item.groupingKey)}`;
      const signature = `${itemKey}:${item.baseQuantity.toFixed(6)}`;
      const sourceGroups = Array.from(item.sourceGroups.values()).map((group) => {
        const groupDisplay = formatCombinedQuantity(group.baseQuantity, item.family);

        return {
          key: group.key,
          type: group.type,
          label: group.label,
          quantity: groupDisplay.quantity,
          unit: groupDisplay.unit,
          quantityLabel: `${formatFoodQuantity(groupDisplay.quantity)} ${groupDisplay.unit}`,
          details: Array.from(group.details).sort((a, b) => a.localeCompare(b, 'es')),
        };
      });

      return {
        itemKey,
        signature,
        name: item.name,
        purchasePlace: item.purchasePlace,
        quantity: display.quantity,
        unit: display.unit,
        quantityLabel: `${formatFoodQuantity(display.quantity)} ${display.unit}`,
        sources: Array.from(item.sources).sort((a, b) => a.localeCompare(b, 'es')),
        sourceGroups,
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

export function groupShoppingItemsByRecipe(items = []) {
  const groups = new Map();

  items.forEach((item) => {
    (item.sourceGroups || []).forEach((sourceGroup) => {
      if (!groups.has(sourceGroup.key)) {
        groups.set(sourceGroup.key, {
          key: sourceGroup.key,
          label: sourceGroup.label,
          type: sourceGroup.type,
          items: [],
        });
      }

      groups.get(sourceGroup.key).items.push({
        item,
        quantity: sourceGroup.quantity,
        unit: sourceGroup.unit,
        quantityLabel: sourceGroup.quantityLabel,
        details: sourceGroup.details,
      });
    });
  });

  const typeOrder = {
    meal: 0,
    extras: 1,
    drinks: 2,
    other: 3,
  };

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => {
        const nameDiff = a.item.name.localeCompare(b.item.name, 'es', { sensitivity: 'base' });

        if (nameDiff !== 0) {
          return nameDiff;
        }

        return (a.item.purchasePlace || '').localeCompare(b.item.purchasePlace || '', 'es', {
          sensitivity: 'base',
        });
      }),
    }))
    .sort((a, b) => {
      const typeDiff = (typeOrder[a.type] ?? typeOrder.other) - (typeOrder[b.type] ?? typeOrder.other);

      if (typeDiff !== 0) {
        return typeDiff;
      }

      return a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
    });
}

export function isShoppingItemChecked(item, shoppingState = {}) {
  const state = shoppingState[item.itemKey];
  return Boolean(state?.checked && state?.signature === item.signature);
}
