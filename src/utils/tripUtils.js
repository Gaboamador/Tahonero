const DATE_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const DAY_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const MEAL_ORDER = {
  lunch: 0,
  dinner: 1,
};

export function parseLocalDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ''))) {
    return null;
  }

  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatLocalDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidTripDateRange(startDate, endDate) {
  if (!startDate && !endDate) {
    return true;
  }

  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (!start || !end) {
    return false;
  }

  return start.getTime() <= end.getTime();
}

export function isValidTripMealRange(startDate, endDate, firstMeal = 'lunch', lastMeal = 'dinner') {
  if (!isValidTripDateRange(startDate, endDate)) {
    return false;
  }

  if (!startDate && !endDate) {
    return true;
  }

  if (!(firstMeal in MEAL_ORDER) || !(lastMeal in MEAL_ORDER)) {
    return false;
  }

  if (startDate === endDate && MEAL_ORDER[firstMeal] > MEAL_ORDER[lastMeal]) {
    return false;
  }

  return true;
}

export function getTripDaysCount(startDate, endDate) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (!start || !end || start.getTime() > end.getTime()) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

export function getTripDates(startDate, endDate) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (!start || !end || start.getTime() > end.getTime()) {
    return [];
  }

  const dates = [];
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(formatLocalDateForInput(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function getTripMealSlots({
  startDate,
  endDate,
  firstMeal = 'lunch',
  lastMeal = 'dinner',
}) {
  if (!isValidTripMealRange(startDate, endDate, firstMeal, lastMeal)) {
    return [];
  }

  const dates = getTripDates(startDate, endDate);
  const mealTypes = ['lunch', 'dinner'];
  const slots = [];

  dates.forEach((date, dateIndex) => {
    mealTypes.forEach((mealType) => {
      const isFirstDay = dateIndex === 0;
      const isLastDay = dateIndex === dates.length - 1;

      if (isFirstDay && MEAL_ORDER[mealType] < MEAL_ORDER[firstMeal]) {
        return;
      }

      if (isLastDay && MEAL_ORDER[mealType] > MEAL_ORDER[lastMeal]) {
        return;
      }

      slots.push({
        id: `${date}_${mealType}`,
        date,
        mealType,
      });
    });
  });

  return slots;
}

export function formatTripDateRange(startDate, endDate) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (!start || !end) {
    return 'Fechas pendientes';
  }

  if (start.getTime() === end.getTime()) {
    return DATE_FORMATTER.format(start);
  }

  return `${DATE_FORMATTER.format(start)} – ${DATE_FORMATTER.format(end)}`;
}

export function formatTripDay(dateString) {
  const date = parseLocalDate(dateString);
  return date ? DAY_FORMATTER.format(date) : dateString;
}
