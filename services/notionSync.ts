import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/**
 * Wywołanie synchronizacji historii lekcji z Notion.
 *
 * Cała praca dzieje się po stronie serwera i to nie jest wybór wygody: token
 * Notion jest sekretem, a przeglądarka i tak nie odpytałaby tego API wprost
 * (Notion nie wystawia nagłówków CORS dla żądań z aplikacji webowych).
 */

export interface NotionSyncReport {
  studentsMatched: number;
  emailsUpdated: number;
  lessonsImported: number;
  lessonsSkipped: number;
  needsReview: number;
  warnings: string[];
}

export const syncNotionLessons = async (): Promise<NotionSyncReport> => {
  const call = httpsCallable<void, NotionSyncReport>(functions, 'syncNotionLessons');
  const result = await call();
  return result.data;
};
