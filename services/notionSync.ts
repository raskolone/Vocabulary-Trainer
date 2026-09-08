import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/**
 * Synchronizacja z Notion — podgląd i import.
 *
 * Praca dzieje się po stronie serwera i to nie jest wybór wygody: token Notion
 * jest sekretem, a przeglądarka i tak nie odpytałaby tego API wprost (Notion
 * nie wystawia nagłówków CORS dla żądań z aplikacji webowych).
 *
 * Limity czasu są podniesione ponad domyślne 70 sekund `httpsCallable`. Import
 * czyta treść każdej lekcji osobnym zapytaniem do Notion i przy większym
 * zaznaczeniu trwa dłużej — na domyślnym limicie przeglądarka rozłączała się
 * w połowie pracy, zostawiając połowicznie zaimportowany materiał.
 */

export type MatchReason = 'notion' | 'email' | 'name' | 'username';

export interface StudentPreview {
  notionId: string;
  name: string;
  emails: string[];
  level: string;
  company: string;
  isGroup: boolean;
  inactive: boolean;
  lessonCount: number;
  uid?: string;
  matchedBy?: MatchReason;
  emailNeedsFix?: boolean;
  /** Ile lekcji z Notion leży już w aplikacji. */
  importedCount?: number;
}

export interface PreviewResult {
  students: StudentPreview[];
  lessonsTotal: number;
  orphanLessons: number;
}

export interface ImportSelection {
  notionId: string;
  createAccount?: boolean;
}

export interface ImportReport {
  accountsCreated: Array<{ name: string; email: string; tempPassword: string }>;
  emailsUpdated: number;
  lessonsImported: number;
  lessonsSkipped: number;
  needsReview: number;
  warnings: string[];
}

export const previewNotionSync = async (): Promise<PreviewResult> => {
  const call = httpsCallable<void, PreviewResult>(functions, 'previewNotionSync', {
    timeout: 120_000,
  });
  return (await call()).data;
};

export const importNotionSelection = async (
  selections: ImportSelection[]
): Promise<ImportReport> => {
  const call = httpsCallable<{ selections: ImportSelection[] }, ImportReport>(
    functions,
    'importNotionSelection',
    { timeout: 540_000 }
  );
  return (await call({ selections })).data;
};
