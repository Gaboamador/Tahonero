import { formatTripDay } from '@/utils/tripUtils';

export function createEmpanadaLocalId(prefix = 'item') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function normalizeEmpanadaFlavor(flavor) {
  const code = String(flavor?.code || '').trim().toUpperCase();
  const name = String(flavor?.name || '').trim();

  if (!code || !name) {
    return null;
  }

  return {
    id: String(flavor?.id || createEmpanadaLocalId('flavor')),
    code,
    name,
  };
}

export function normalizeFlavorList(flavors = []) {
  const normalized = flavors.map(normalizeEmpanadaFlavor).filter(Boolean);
  const codes = new Set();

  normalized.forEach((flavor) => {
    const key = flavor.code.toLocaleLowerCase('es-AR');
    if (codes.has(key)) {
      throw new Error(`La sigla ${flavor.code} está repetida.`);
    }
    codes.add(key);
  });

  return normalized;
}

export function parseEmpanadaCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

export function getOrderTotal(order) {
  return Object.values(order?.items || {}).reduce(
    (total, value) => total + parseEmpanadaCount(value),
    0,
  );
}

export function getAllocatedCount(order, flavorId) {
  return Object.values(order?.allocations || {}).reduce(
    (total, slotMap) => total + parseEmpanadaCount(slotMap?.[flavorId]),
    0,
  );
}

export function getConsumedCount(order, flavorId) {
  return Object.values(order?.consumed || {}).reduce(
    (total, slotMap) => total + parseEmpanadaCount(slotMap?.[flavorId]),
    0,
  );
}

export function getRemainingCount(order, flavorId) {
  return Math.max(
    0,
    parseEmpanadaCount(order?.items?.[flavorId]) - getConsumedCount(order, flavorId),
  );
}

export function buildEmpanadaTotals({ config, orders = [], members = [] }) {
  const membersMap = Object.fromEntries(members.map((member) => [member.memberId, member]));

  return (config?.flavors || [])
    .map((flavor) => {
      const byMember = {};
      const remainingByMember = {};
      let total = 0;
      let consumed = 0;

      orders.forEach((order) => {
        const quantity = parseEmpanadaCount(order.items?.[flavor.id]);
        const consumedQuantity = Math.min(quantity, getConsumedCount(order, flavor.id));

        if (quantity > 0) {
          byMember[order.memberId] = quantity;
          remainingByMember[order.memberId] = Math.max(0, quantity - consumedQuantity);
        }

        total += quantity;
        consumed += consumedQuantity;
      });

      return {
        ...flavor,
        total,
        consumed,
        remaining: Math.max(0, total - consumed),
        byMember,
        remainingByMember,
        membersMap,
      };
    })
    .filter((flavor) => flavor.total > 0);
}

export function validateOrderDraft({ items = {}, allocations = {}, consumed = {}, flavorIds = [] }) {
  const allowedFlavorIds = new Set(flavorIds);
  const cleanItems = {};

  Object.entries(items).forEach(([flavorId, value]) => {
    if (!allowedFlavorIds.has(flavorId)) return;
    const count = parseEmpanadaCount(value);
    if (count > 0) cleanItems[flavorId] = count;
  });

  const cleanAllocations = {};
  Object.entries(allocations || {}).forEach(([slotId, slotMap]) => {
    const cleanSlotMap = {};
    Object.entries(slotMap || {}).forEach(([flavorId, value]) => {
      if (!allowedFlavorIds.has(flavorId) || !(flavorId in cleanItems)) return;
      const count = parseEmpanadaCount(value);
      if (count > 0) cleanSlotMap[flavorId] = count;
    });
    if (Object.keys(cleanSlotMap).length > 0) cleanAllocations[slotId] = cleanSlotMap;
  });

  Object.entries(cleanItems).forEach(([flavorId, ordered]) => {
    const allocated = Object.values(cleanAllocations).reduce(
      (total, slotMap) => total + parseEmpanadaCount(slotMap?.[flavorId]),
      0,
    );
    if (allocated > ordered) {
      throw new Error('No podés repartir más empanadas de las que pediste.');
    }
  });

  const cleanConsumed = {};
  Object.entries(consumed || {}).forEach(([slotId, slotMap]) => {
    const allocationMap = cleanAllocations[slotId] || {};
    const cleanSlotMap = {};
    Object.entries(slotMap || {}).forEach(([flavorId, value]) => {
      const maxCount = parseEmpanadaCount(allocationMap[flavorId]);
      const count = Math.min(parseEmpanadaCount(value), maxCount);
      if (count > 0) cleanSlotMap[flavorId] = count;
    });
    if (Object.keys(cleanSlotMap).length > 0) cleanConsumed[slotId] = cleanSlotMap;
  });

  return { items: cleanItems, allocations: cleanAllocations, consumed: cleanConsumed };
}

export function getMealSlotLabel(slot) {
  if (!slot) return '';
  const mealLabel = slot.mealType === 'lunch' ? 'Almuerzo' : 'Cena';
  return `${formatTripDay(slot.date)} · ${mealLabel}`;
}
