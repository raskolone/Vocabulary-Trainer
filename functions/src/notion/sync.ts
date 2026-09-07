import { getFirestore, Firestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

import { DATABASE_ID, NOTION_LESSONS_DB, NOTION_STUDENTS_DB } from '../config';
import { NotionPage, pageToText, queryDatabase } from './client';
import { parseLessonSummary } from './parse';

/**
 * Synchronizacja Notion → aplikacja.
 *
 * Ruch idzie wyłącznie w jedną stronę i to jest decyzja, nie uproszczenie:
 * Notion pozostaje źródłem prawdy i kopią zapasową lektora, a aplikacja tylko
 * czyta. Zapis zwrotny wymagałby rozstrzygania konfliktów i groziłby pętlą,
 * w której jedna strona nadpisuje drugą.
 *
 * Ponowne uruchomienie jest bezpieczne: dokument lekcji ma identyfikator strony
 * Notion jako własny klucz, więc druga synchronizacja aktualizuje ten sam
 * rekord, zamiast tworzyć duplikat.
 */

export interface SyncReport {
  studentsMatched: number;
  emailsUpdated: number;
  lessonsImported: number;
  lessonsSkipped: number;
  needsReview: number;
  warnings: string[];
}

/** Adresy, pod które nic nie dojdzie — te same, co w powiadomieniach. */
const isRealEmail = (email: string): boolean =>
  !!email && email.includes('@') && !email.endsWith('@student.vocabboost.com');

const normalize = (value: string): string =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Wartość właściwości Notion jako tekst, niezależnie od jej typu. */
const propText = (page: NotionPage, name: string): string => {
  const prop = page.properties?.[name];
  if (!prop) return '';
  switch (prop.type) {
    case 'title':
    case 'rich_text':
      return (prop[prop.type] || []).map((p: any) => p.plain_text || '').join('').trim();
    case 'select':
      return prop.select?.name || '';
    case 'multi_select':
      return (prop.multi_select || []).map((o: any) => o.name).join(', ');
    case 'date':
      return prop.date?.start || '';
    case 'email':
      return prop.email || '';
    default:
      return '';
  }
};

const propRelationIds = (page: NotionPage, name: string): string[] => {
  const prop = page.properties?.[name];
  if (prop?.type !== 'relation') return [];
  return (prop.relation || []).map((r: any) => r.id).filter(Boolean);
};

const propEmails = (page: NotionPage, name: string): string[] => {
  const prop = page.properties?.[name];
  if (prop?.type === 'multi_select') {
    return (prop.multi_select || []).map((o: any) => (o.name || '').trim()).filter(Boolean);
  }
  const single = propText(page, name).trim();
  return single ? [single] : [];
};

interface StudentLink {
  notionId: string;
  name: string;
  emails: string[];
  level: string;
  /** UID konta w aplikacji — puste, gdy kursant nie ma jeszcze konta. */
  uid?: string;
}

/**
 * Wiąże karty kursantów z Notion z kontami w aplikacji.
 *
 * Dopasowanie idzie po adresie e-mail, a dopiero potem po imieniu i nazwisku:
 * adres jest jednoznaczny, nazwisko bywa zapisane na kilka sposobów. Znalezione
 * powiązanie zapisujemy w profilu (`notionPageId`), więc kolejne synchronizacje
 * nie muszą już niczego zgadywać.
 */
export const linkStudents = async (
  db: Firestore,
  token: string,
  report: SyncReport
): Promise<Map<string, StudentLink>> => {
  const pages = await queryDatabase(token, NOTION_STUDENTS_DB);
  const usersSnap = await db.collection('users').get();
  const links = new Map<string, StudentLink>();

  for (const page of pages) {
    const name = propText(page, 'Nazwa');
    if (!name) continue;

    // Nieaktywni zostają w Notion dla historii, ale nie wchodzą do aplikacji.
    if (propText(page, 'Status współpracy') === 'Nieaktywny') continue;

    const emails = propEmails(page, 'Adresy e-mail');
    const link: StudentLink = {
      notionId: page.id,
      name,
      emails,
      level: propText(page, 'Poziom / profil'),
    };

    const emailSet = new Set(emails.map(normalize));
    const nameNorm = normalize(name);

    const match = usersSnap.docs.find((doc) => {
      const data = doc.data() || {};
      if (data.notionPageId === page.id) return true;
      if (emailSet.has(normalize(data.email || ''))) return true;
      const fullName = normalize(`${data.firstName || ''} ${data.lastName || ''}`);
      if (fullName && fullName === nameNorm) return true;
      return normalize(data.username || '') === nameNorm;
    });

    if (match) {
      link.uid = match.id;
      report.studentsMatched += 1;

      const data = match.data() || {};
      const updates: Record<string, unknown> = {};
      if (data.notionPageId !== page.id) updates.notionPageId = page.id;

      // Prawdziwy adres z Notion zastępuje zastępczy `@student.vocabboost.com`,
      // pod który powiadomienia i tak nie dochodziły. Adresu, który kursant ma
      // już poprawny, nie ruszamy — mógł go zmienić u siebie.
      const firstReal = emails.find(isRealEmail);
      if (firstReal && !isRealEmail(data.email || '')) {
        updates.email = firstReal;
        report.emailsUpdated += 1;
      }

      if (Object.keys(updates).length > 0) {
        await match.ref.update(updates);
      }
    } else {
      report.warnings.push(`Kursant „${name}" z Notion nie ma konta w aplikacji.`);
    }

    links.set(page.id, link);
  }

  return links;
};

/** Data lekcji w formacie, którego oczekuje rekord aplikacji (RRRR-MM-DD). */
const lessonDate = (page: NotionPage): string => {
  const raw = propText(page, 'Data lekcji');
  if (raw) return raw.slice(0, 10);
  return (page.last_edited_time || new Date().toISOString()).slice(0, 10);
};

export const syncLessons = async (token: string): Promise<SyncReport> => {
  const db = getFirestore(DATABASE_ID);
  const report: SyncReport = {
    studentsMatched: 0,
    emailsUpdated: 0,
    lessonsImported: 0,
    lessonsSkipped: 0,
    needsReview: 0,
    warnings: [],
  };

  const links = await linkStudents(db, token, report);

  // Po nazwie też, bo w starszych lekcjach kursant bywa wskazany wyłącznie
  // polem wyboru — relacja powstała później.
  const byName = new Map<string, StudentLink>();
  links.forEach((link) => byName.set(normalize(link.name), link));

  const lessons = await queryDatabase(token, NOTION_LESSONS_DB, {
    or: [
      { property: 'Status', select: { equals: 'Odbyta' } },
      { property: 'Status', select: { equals: 'Podsumowanie' } },
    ],
  });

  for (const lesson of lessons) {
    const topic = propText(lesson, 'Temat lekcji') || 'Lekcja';
    const relationIds = propRelationIds(lesson, 'Kursant (relacja)');
    const link =
      relationIds.map((id) => links.get(id)).find(Boolean) ||
      byName.get(normalize(propText(lesson, 'Kursant')));

    if (!link?.uid) {
      report.lessonsSkipped += 1;
      continue;
    }

    let parsed;
    try {
      parsed = parseLessonSummary(await pageToText(token, lesson.id));
    } catch (error) {
      report.warnings.push(`Nie udało się odczytać lekcji „${topic}".`);
      logger.error('Notion: odczyt lekcji', {
        lessonId: lesson.id,
        error: error instanceof Error ? error.message : String(error),
      });
      report.lessonsSkipped += 1;
      continue;
    }

    const now = new Date().toISOString();
    const ref = db.collection('users').doc(link.uid).collection('lessonRecords').doc(lesson.id);
    const existing = await ref.get();

    await ref.set(
      {
        studentId: link.uid,
        date: lessonDate(lesson),
        topic,
        vocabularyText: parsed.vocabularyText,
        lessonSummary: parsed.lessonSummary,
        thingsToImprove: parsed.thingsToImprove,
        suggestedFollowUp: parsed.suggestedFollowUp,
        // Ślad pochodzenia: po nim widać, czego nie edytować ręcznie w panelu,
        // bo kolejna synchronizacja i tak nadpisze to treścią z Notion.
        source: 'notion',
        notionPageId: lesson.id,
        notionUrl: lesson.url || '',
        needsReview: parsed.needsReview,
        createdAt: existing.exists ? existing.data()?.createdAt || now : now,
        updatedAt: now,
      },
      { merge: true }
    );

    report.lessonsImported += 1;
    if (parsed.needsReview) report.needsReview += 1;
  }

  return report;
};
