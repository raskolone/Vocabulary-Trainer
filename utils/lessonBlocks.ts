import { LessonBlocks, LessonRecord } from '../types';

/**
 * Czyści surowe bloki znaczników markdown (np. ~~~markdown ... ~~~ lub ```markdown ... ```)
 * pozostawiając samą treść w czytelnym formacie.
 */
export function cleanMarkdownArtifacts(text: string): string {
  if (!text) return '';
  return text
    .replace(/^~~~[a-zA-Z]*\s*/gm, '')
    .replace(/^```[a-zA-Z]*\s*/gm, '')
    .replace(/~~~$/gm, '')
    .replace(/```$/gm, '')
    .trim();
}

/**
 * Rozbija tekst z odpowiedziami / zdaniami na czyste punkty.
 */
export function parseNumberedItems(text: string): string[] {
  if (!text) return [];
  const cleaned = cleanMarkdownArtifacts(text);
  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: string[] = [];

  for (const line of lines) {
    // Rozpoznawanie punktorów lub numeracji: '1.', '1)', '-', '*'
    const stripped = line.replace(/^(\d+[.)]|\*|-|•)\s+/, '').trim();
    if (stripped) {
      items.push(stripped);
    }
  }

  return items.length > 0 ? items : lines;
}

/**
 * Inteligentnie rozbija blok zadania domowego na:
 * 1. Treść zadania / zdania do przetłumaczenia (Blok 1 / Treść)
 * 2. Klucz odpowiedzi (Answer Key / Blok 2)
 */
export function splitHomeworkAndAnswerKey(rawHomework: string): {
  homework: string;
  answerKey?: string;
} {
  if (!rawHomework) return { homework: '' };

  const cleaned = rawHomework.trim();
  
  // Szukamy sekcji Answer Key / Klucz odpowiedzi / Blok 2 — odpowiedzi
  const splitRegex = /(?:\n\s*|\n{2,})(?:#{1,4}\s*)?(?:answer\s*key|klucz\s*odpowiedzi|blok\s*2\s*[-—–]\s*odpowiedzi|odpowiedzi\s*:)/i;
  const match = cleaned.search(splitRegex);

  if (match !== -1) {
    const hwPart = cleaned.slice(0, match).trim();
    const akPart = cleaned.slice(match).trim();

    // Oczyszczamy nagłówek z answer key
    const akCleaned = akPart
      .replace(/^(?:#{1,4}\s*)?(?:answer\s*key|klucz\s*odpowiedzi|blok\s*2\s*[-—–]\s*odpowiedzi|odpowiedzi\s*:)\s*/i, '')
      .trim();

    return {
      homework: cleanMarkdownArtifacts(hwPart),
      answerKey: cleanMarkdownArtifacts(akCleaned),
    };
  }

  return {
    homework: cleanMarkdownArtifacts(cleaned),
  };
}

/**
 * Ekstrahuje i normalizuje wszystkie bloki lekcji Notion-style z rekordu lekcji.
 * Działa bezbłędnie zarówno dla nowych rekordów z dedykowanymi polami,
 * jak i dla starych wpisów z Notion ze zlanym polem `thingsToImprove`.
 */
export function extractLessonBlocks(record: Partial<LessonRecord>): LessonBlocks {
  if (!record) {
    return {
      summary: '',
      vocabulary: '',
      corrections: '',
      homework: '',
      answerKey: undefined,
      nextLesson: '',
      learningCurve: '',
    };
  }

  // 1. Jeśli rekord ma już jawnie przypisane structuredBlocks, bierzemy je jako bazę
  if (record.structuredBlocks) {
    return {
      summary: record.structuredBlocks.summary || record.lessonSummary || '',
      vocabulary: record.structuredBlocks.vocabulary || record.vocabularyText || '',
      corrections: record.structuredBlocks.corrections || record.corrections || '',
      homework: record.structuredBlocks.homework || record.homeworkText || '',
      answerKey: record.structuredBlocks.answerKey || record.homeworkAnswerKey,
      nextLesson: record.structuredBlocks.nextLesson || record.nextLessonPlan || record.suggestedFollowUp || '',
      learningCurve: record.structuredBlocks.learningCurve || record.studentSpeaking || '',
    };
  }

  let summary = record.lessonSummary?.trim() || '';
  let vocabulary = record.vocabularyText?.trim() || '';
  let learningCurve = record.studentSpeaking?.trim() || '';
  let nextLesson = record.nextLessonPlan?.trim() || record.suggestedFollowUp?.trim() || '';

  // 2. Obsługa pracy domowej & korekt
  let homework = record.homeworkText?.trim() || '';
  let answerKey = record.homeworkAnswerKey?.trim();
  let corrections = record.corrections?.trim() || '';

  // Sprawdzamy, czy w thingsToImprove znajduje się zlane zadanie domowe
  const thingsToImproveRaw = record.thingsToImprove?.trim() || '';

  if (thingsToImproveRaw) {
    const hwMarkerRegex = /(?:zadanie\s+z\s+lekcji|zadanie\s+domowe|homework|blok\s*3\s*[-—–]\s*homework)/i;
    const hwMatchIndex = thingsToImproveRaw.search(hwMarkerRegex);

    if (hwMatchIndex !== -1) {
      // Część przed znacznikiem to właściwe błędy / korekty
      const fixesPart = thingsToImproveRaw.slice(0, hwMatchIndex).trim();
      // Część od znacznika to zadanie domowe
      const hwPartRaw = thingsToImproveRaw.slice(hwMatchIndex).trim();

      if (!corrections && fixesPart) {
        corrections = fixesPart;
      }

      if (!homework && hwPartRaw) {
        // Usuwamy ewentualny wstęp "Zadanie z lekcji:"
        const cleanHw = hwPartRaw.replace(/^(?:zadanie\s+z\s+lekcji\s*:?\s*)/i, '').trim();
        const split = splitHomeworkAndAnswerKey(cleanHw);
        homework = split.homework;
        if (split.answerKey && !answerKey) {
          answerKey = split.answerKey;
        }
      }
    } else {
      // Nie znaleziono zadania domowego w thingsToImprove - całość to korekty/uwagi
      if (!corrections) {
        corrections = thingsToImproveRaw;
      }
    }
  }

  // Jeśli zadanie domowe było w suggestedFollowUp
  if (!homework && nextLesson) {
    const hwMarkerRegex = /(?:zadanie\s+domowe|homework|blok\s*3)/i;
    const hwMatchIndex = nextLesson.search(hwMarkerRegex);
    if (hwMatchIndex !== -1) {
      const planPart = nextLesson.slice(0, hwMatchIndex).trim();
      const hwPart = nextLesson.slice(hwMatchIndex).trim();
      nextLesson = planPart;
      const split = splitHomeworkAndAnswerKey(hwPart);
      homework = split.homework;
      if (split.answerKey && !answerKey) {
        answerKey = split.answerKey;
      }
    }
  }

  // Jeśli mamy homework, a nie mamy answerKey, sprawdźmy czy nie ma go w treści homework
  if (homework && !answerKey) {
    const split = splitHomeworkAndAnswerKey(homework);
    homework = split.homework;
    answerKey = split.answerKey;
  }

  return {
    summary: cleanMarkdownArtifacts(summary),
    vocabulary: vocabulary,
    corrections: cleanMarkdownArtifacts(corrections),
    homework: cleanMarkdownArtifacts(homework),
    answerKey: answerKey ? cleanMarkdownArtifacts(answerKey) : undefined,
    nextLesson: cleanMarkdownArtifacts(nextLesson),
    learningCurve: cleanMarkdownArtifacts(learningCurve),
  };
}

/**
 * Sprawdza, czy dany rekord lekcji jest w starym, zanieczyszczonym formacie
 * (np. zadanie domowe sklejone w `thingsToImprove`).
 */
export function isRecordNeedsCleanup(record: LessonRecord): boolean {
  if (record.structuredBlocks) return false;
  if (record.homeworkText) return false;

  const raw = record.thingsToImprove || '';
  return (
    /(?:zadanie\s+z\s+lekcji|zadanie\s+domowe|~~~markdown|answer\s*key)/i.test(raw) ||
    /blok\s*[1-4]/i.test(raw)
  );
}

/**
 * Przygotowuje obiekt aktualizacji rekordu lekcji do czystego formatu blokowego.
 */
export function migrateRecordToBlocks(record: LessonRecord): Partial<LessonRecord> {
  const blocks = extractLessonBlocks(record);
  return {
    lessonSummary: blocks.summary,
    vocabularyText: blocks.vocabulary,
    corrections: blocks.corrections,
    homeworkText: blocks.homework,
    homeworkAnswerKey: blocks.answerKey || '',
    nextLessonPlan: blocks.nextLesson,
    studentSpeaking: blocks.learningCurve,
    // Zostawiamy czyste thingsToImprove (tylko korekty) dla wstecznej zgodności
    thingsToImprove: blocks.corrections,
    suggestedFollowUp: blocks.nextLesson,
    structuredBlocks: blocks,
    updatedAt: new Date().toISOString(),
  };
}
