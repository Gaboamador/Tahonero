import { isShoppingItemChecked } from '@/features/shopping/utils/shoppingUtils';

const ALL_FOOD_UNITS = ['g', 'kg', 'ml', 'l', 'unidad', 'paquete', 'lata', 'botella'];

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

function buildConsolidatedLeftovers(leftoverRecords = []) {
  const groups = new Map();

  leftoverRecords.forEach((record) => {
    const name = String(record.name || '').trim();
    const quantity = Number(record.leftoverQuantity) || 0;
    const unit = record.leftoverUnit;

    if (!name || quantity <= 0 || !unit) {
      return;
    }

    const { family } = getUnitInfo(unit);
    const key = `${normalizeText(name)}|${family}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name,
        family,
        baseQuantity: 0,
        recordCount: 0,
      });
    }

    const group = groups.get(key);
    group.baseQuantity += toBaseQuantity(quantity, unit);
    group.recordCount += 1;
  });

  return Array.from(groups.values())
    .map((group) => {
      const display = formatCombinedQuantity(group.baseQuantity, group.family);

      return {
        key: group.key,
        name: group.name,
        quantity: display.quantity,
        unit: display.unit,
        recordCount: group.recordCount,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

export function getCompatibleLeftoverUnits(unit) {
  if (unit === 'g' || unit === 'kg') return ['g', 'kg'];
  if (unit === 'ml' || unit === 'l') return ['ml', 'l'];
  return ALL_FOOD_UNITS.includes(unit) ? [unit] : ALL_FOOD_UNITS;
}

export function getAllLeftoverUnits() {
  return ALL_FOOD_UNITS;
}

export function getCurrentShoppingReview(item, records = []) {
  return (
    records.find(
      (record) =>
        record.sourceType === 'shopping' &&
        record.sourceItemKey === item.itemKey &&
        record.sourceSignature === item.signature,
    ) || null
  );
}

export function getStaleShoppingReview(item, records = []) {
  return (
    records.find(
      (record) =>
        record.sourceType === 'shopping' &&
        record.sourceItemKey === item.itemKey &&
        record.sourceSignature !== item.signature,
    ) || null
  );
}

export function buildLeftoverSummary({ shoppingItems = [], shoppingState = {}, records = [] } = {}) {
  const purchasedItems = shoppingItems.filter((item) => isShoppingItemChecked(item, shoppingState));
  const reviewedItems = purchasedItems.filter((item) => getCurrentShoppingReview(item, records));
  const shoppingLeftoverRecords = purchasedItems
    .map((item) => getCurrentShoppingReview(item, records))
    .filter((record) => record?.status === 'leftover');
  const manualLeftovers = records.filter(
    (record) => record.sourceType === 'manual' && record.status === 'leftover',
  );
  const consolidatedLeftovers = buildConsolidatedLeftovers([
    ...shoppingLeftoverRecords,
    ...manualLeftovers,
  ]);

  return {
    purchasedItems,
    purchasedCount: purchasedItems.length,
    reviewedCount: reviewedItems.length,
    pendingCount: purchasedItems.length - reviewedItems.length,
    leftoverCount: consolidatedLeftovers.length,
    consolidatedLeftovers,
    manualLeftovers,
  };
}
