export const FOOD_UNITS = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'unidad', label: 'unidad' },
  { value: 'paquete', label: 'paquete' },
  { value: 'lata', label: 'lata' },
  { value: 'botella', label: 'botella' },
];

export const FOOD_UNIT_VALUES = FOOD_UNITS.map((unit) => unit.value);

export const MEAL_TYPES = {
  lunch: 'lunch',
  dinner: 'dinner',
};

export const MEAL_TYPE_LABELS = {
  lunch: 'Almuerzo',
  dinner: 'Cena',
};

export const MEAL_ASSIGNMENT_TYPES = {
  meal: 'meal',
  leftovers: 'leftovers',
  custom: 'custom',
};

export const EXTRA_MODES = {
  direct: 'direct',
  recipe: 'recipe',
};

export const DRINK_CALCULATION_MODES = {
  fixed: 'fixed',
  perPersonPerDay: 'perPersonPerDay',
};

export const DRINK_COVERAGE_MODES = {
  trip: 'trip',
  custom: 'custom',
};
