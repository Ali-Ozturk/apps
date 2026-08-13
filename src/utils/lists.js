import { today } from './date';

export function ensureToday(data) {
  const now = today();
  return data.activeDate === now ? data : { activeDate: now, lists: { ...data.lists, [now]: [] } };
}

export function groceryNames(data) {
  return [...new Set(Object.values(data.lists).flat().map((item) => item.name))];
}
