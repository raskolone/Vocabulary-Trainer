/**
 * Rozbiór podsumowania lekcji na pola rekordu w aplikacji.
 *
 * Parser jest deterministyczny, bo format nie jest przypadkowy: skill
 * „Meeting Summary" w Notion wymusza dokładnie cztery sekcje o stałych
 * nagłówkach. Dopóki podsumowania powstają tą drogą, dopasowanie po nagłówku
 * jest pewniejsze i tańsze niż pytanie o to modelu.
 *
 * Gdy sekcji nie da się rozpoznać, całość ląduje w streszczeniu zamiast
 * przepaść — lektor zobaczy wtedy w panelu surowy tekst i będzie wiedział,
 * że akurat ta lekcja wymaga ręki.
 */

export interface ParsedSummary {
  lessonSummary: string;
  vocabularyText: string;
  thingsToImprove: string;
  corrections: string;
  homeworkText: string;
  homeworkAnswerKey?: string;
  suggestedFollowUp: string;
  learningCurve: string;
  extractedDate?: string;
  /** Nierozpoznany format — rekord powstanie, ale wymaga przejrzenia. */
  needsReview: boolean;
}

type SectionKey = 'lessonSummary' | 'vocabularyText' | 'homework' | 'suggestedFollowUp' | 'learningCurve';

/** Nagłówki czterech bloków oraz learning curve, po fragmentach odpornych na numerację i emoji. */
const SECTION_MARKERS: Array<{ key: SectionKey; needles: string[] }> = [
  { 
    key: 'lessonSummary', 
    needles: ['lekcja w skrócie', 'lekcja w skrocie', 'blok 1', 'podsumowanie lekcji', 'streszczenie lekcji', 'omówienie lekcji', 'omowienie lekcji', 'lesson summary'] 
  },
  { 
    key: 'vocabularyText', 
    needles: ['key language', 'corrections', 'blok 2', 'kluczowe słownictwo', 'kluczowe slownictwo', 'słownictwo', 'slownictwo', 'nowe słownictwo'] 
  },
  { 
    key: 'homework', 
    needles: ['homework', 'cribro habit', 'zadanie domowe', 'zadanie z lekcji', 'blok 3', 'zdania do przetłumaczenia', 'zdania do przetlumaczenia'] 
  },
  { 
    key: 'suggestedFollowUp', 
    needles: ['next lesson', 'kolejna lekcja', 'następna lekcja', 'nastepna lekcja', 'blok 4', 'plany na kolejną lekcję'] 
  },
  {
    key: 'learningCurve',
    needles: ['learning curve', 'student speaking', 'wypowiedzi kursanta', 'o czym mówił kursant', 'o czym mowil kursant', 'dynamika kursanta']
  }
];

const EMPTY = {
  lessonSummary: '',
  vocabularyText: '',
  thingsToImprove: '',
  corrections: '',
  homeworkText: '',
  homeworkAnswerKey: '',
  suggestedFollowUp: '',
  learningCurve: '',
};

const isHeading = (line: string): boolean => /^#{1,4}\s/.test(line.trim());

const matchSection = (line: string): SectionKey | null => {
  const lowered = line.toLowerCase();
  for (const marker of SECTION_MARKERS) {
    if (marker.needles.some((needle) => lowered.includes(needle))) return marker.key;
  }
  return null;
};

/**
 * Szuka daty spotkania w treści tekstu (np. "Data i godzina spotkania: 26.08.2026, 18:00"
 * lub "Data: 2026-08-26" lub "07.09.2026").
 */
export const extractDateFromText = (text: string): string | null => {
  if (!text) return null;

  // 1. Wyraźne oznaczenie "Data ...: DD.MM.YYYY" lub YYYY-MM-DD
  const explicitMatch = text.match(
    /(?:data(?:\s+i\s+godzina)?(?:\s+spotkania|\s+lekcji)?\s*[:—–-]\s*)(\d{4}[-/.]\d{2}[-/.]\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})/i
  );
  const candidate = explicitMatch ? explicitMatch[1] : null;

  if (candidate) {
    if (/^\d{4}[-/.]\d{2}[-/.]\d{2}$/.test(candidate)) {
      return candidate.replace(/[./]/g, '-');
    }
    const parts = candidate.split(/[./-]/);
    if (parts.length === 3 && parts[2].length === 4) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }

  return null;
};

/** Zdejmuje punktor listy — treść liczy się bez niego. */
const stripBullet = (line: string): string =>
  line.replace(/^\s*[-*•]\s+/, '').replace(/^\s*\d+[.)]\s+/, '').trim();

/**
 * Ujednolica separator terminu i tłumaczenia.
 *
 * Skill zapisuje słownictwo z myślnikiem em (`—`), a parser słownictwa
 * w aplikacji (services/lessonRecord.ts) rozpoznaje ` - `, ` – `, `:` i `=`.
 * Bez tej zamiany każda pozycja wjechałaby jako termin bez tłumaczenia.
 */
const normalizeSeparator = (line: string): string => line.replace(/\s+—\s+/, ' - ');

/** Czy linia to podnagłówek wewnątrz bloku 2 („Nowe:", „Corrections:"). */
const subHeading = (line: string): string | null => {
  const trimmed = line.trim().toLowerCase();
  if (/^nowe\b/.test(trimmed)) return 'vocab';
  if (/^powt[óo]rka\b/.test(trimmed)) return 'vocab';
  if (/^corrections\b/.test(trimmed)) return 'fix';
  if (/^pronunciation\b/.test(trimmed)) return 'fix';
  return null;
};

/**
 * Blok 2 rozpada się na dwa pola aplikacji: słownictwo do powtórek i listę
 * rzeczy do poprawy. Podnagłówki skilla rozstrzygają, co gdzie trafia.
 */
const splitKeyLanguage = (body: string): { vocabulary: string; fixes: string } => {
  const vocabulary: string[] = [];
  const fixes: string[] = [];
  let target: 'vocab' | 'fix' = 'vocab';

  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const heading = subHeading(line);
    if (heading) {
      target = heading === 'fix' ? 'fix' : 'vocab';
      // Sam podnagłówek nie jest treścią — pomijamy go.
      if (/^(nowe|powtórka|powtorka|corrections|pronunciation)\b.*:?$/i.test(line)) continue;
    }

    const content = normalizeSeparator(stripBullet(line));
    if (!content) continue;
    (target === 'fix' ? fixes : vocabulary).push(content);
  }

  return { vocabulary: vocabulary.join('\n'), fixes: fixes.join('\n') };
};

export const parseLessonSummary = (text: string): ParsedSummary => {
  const sections: Record<string, string[]> = {};
  let current: SectionKey | null = null;

  for (const raw of (text || '').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (isHeading(line) || /^\s*\d\.\s+(Lekcja|Key|Homework|Next)/i.test(line)) {
      const matched = matchSection(line);
      if (matched) {
        current = matched;
        sections[current] = sections[current] || [];
        continue;
      }
    }
    if (current) (sections[current] = sections[current] || []).push(line);
  }

  const found = Object.keys(sections).length > 0;
  const extractedDate = extractDateFromText(text || '') || undefined;

  if (!found) {
    return {
      ...EMPTY,
      lessonSummary: (text || '').trim().slice(0, 4000),
      extractedDate,
      needsReview: true,
    };
  }

  const keyLanguage = splitKeyLanguage((sections.vocabularyText || []).join('\n'));
  const rawHw = (sections.homework || []).join('\n').trim();

  // Rozpoznanie ewentualnego Answer Key w zadaniu domowym
  let hwText = rawHw;
  let hwAnswerKey = '';
  const akRegex = /(?:\n\s*|\n{2,})(?:#{1,4}\s*)?(?:answer\s*key|klucz\s*odpowiedzi|blok\s*2\s*[-—–]\s*odpowiedzi|odpowiedzi\s*:)/i;
  const akMatch = rawHw.search(akRegex);
  if (akMatch !== -1) {
    hwText = rawHw.slice(0, akMatch).trim();
    hwAnswerKey = rawHw.slice(akMatch).replace(/^(?:#{1,4}\s*)?(?:answer\s*key|klucz\s*odpowiedzi|blok\s*2\s*[-—–]\s*odpowiedzi|odpowiedzi\s*:)\s*/i, '').trim();
  }

  const hasSubstance = Boolean(
    keyLanguage.vocabulary || 
    (sections.lessonSummary || []).length || 
    keyLanguage.fixes || 
    hwText
  );

  return {
    lessonSummary: (sections.lessonSummary || []).join('\n').trim().slice(0, 4000),
    vocabularyText: keyLanguage.vocabulary.slice(0, 8000),
    corrections: keyLanguage.fixes.slice(0, 4000),
    homeworkText: hwText.slice(0, 4000),
    homeworkAnswerKey: hwAnswerKey.slice(0, 4000),
    learningCurve: (sections.learningCurve || []).join('\n').trim().slice(0, 4000),
    extractedDate,
    // thingsToImprove zachowane dla wstecznej kompatybilności
    thingsToImprove: [keyLanguage.fixes, hwText && `Zadanie z lekcji:\n${hwText}`]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 4000),
    suggestedFollowUp: (sections.suggestedFollowUp || []).join('\n').trim().slice(0, 2000),
    needsReview: !hasSubstance || (!keyLanguage.vocabulary && !(sections.lessonSummary || []).length),
  };
};
