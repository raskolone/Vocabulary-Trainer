import { User } from '../types';

export interface BulkEditOptions {
  level: string;
  role: string;
  emailNotifications: string;
}

/**
 * Buduje obiekt aktualizacji dla masowej edycji kursantów.
 * Pomija pola ze statusem 'no_change'.
 */
export function buildBulkUpdatePayload(options: BulkEditOptions): Partial<User> {
  const updates: Partial<User> = {};

  if (options.level && options.level !== 'no_change') {
    updates.level = options.level;
  }

  if (options.role && options.role !== 'no_change') {
    updates.role = options.role as 'admin' | 'user' | 'teacher';
  }

  if (options.emailNotifications && options.emailNotifications !== 'no_change') {
    updates.emailNotificationsDisabled = options.emailNotifications === 'disabled';
  }

  return updates;
}

/**
 * Oblicza czy wszyscy przefiltrowani użytkownicy są zaznaczeni.
 */
export function calculateIsAllSelected(filteredIds: string[], selectedIds: Set<string>): boolean {
  if (filteredIds.length === 0) return false;
  return filteredIds.every((id) => selectedIds.has(id));
}

/**
 * Oblicza stan pośredni (częściowe zaznaczenie).
 */
export function calculateIsIndeterminate(filteredIds: string[], selectedIds: Set<string>): boolean {
  if (filteredIds.length === 0) return false;
  const count = filteredIds.filter((id) => selectedIds.has(id)).length;
  return count > 0 && count < filteredIds.length;
}

/**
 * Przełącza zaznaczenie wszystkich przefiltrowanych rekordów.
 */
export function toggleSelectAllFilteredIds(
  filteredIds: string[],
  currentSelected: Set<string>
): Set<string> {
  const next = new Set(currentSelected);
  const allSelected = calculateIsAllSelected(filteredIds, currentSelected);

  if (allSelected) {
    filteredIds.forEach((id) => next.delete(id));
  } else {
    filteredIds.forEach((id) => next.add(id));
  }

  return next;
}
