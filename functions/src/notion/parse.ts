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
  /** Nierozpoznany format — rekord powstanie, ale wymaga przejrzenia. */
  needsReview: boolean;
}

/** Nagłówki czterech bloków, po fragmentach odpornych na numerację i emoji. */
const SECTION_MARKERS: Array<{ key: 'lessonSummary' | 'vocabularyText' | 'homework' | 'suggestedFollowUp'; needles: string[] }> = [
  { key: 'lessonSummary', needles: ['lekcja w skrócie', 'lekcja w skrocie'] },
  { key: 'vocabularyText', needles: ['key language', 'corrections'] },
  { key: 'homework', needles: ['homework', 'cribro habit', 'zadanie domowe'] },
  { key: 'suggestedFollowUp', needles: ['next lesson', 'kolejna lekcja'] },
];

const EMPTY = {
  lessonSummary: '',
  vocabularyText: '',
  thingsToImprove: '',
  corrections: '',
  homeworkText: '',
  homeworkAnswerKey: '',
  suggestedFollowUp: '',
};

const isHeading = (line: string): boolean => /^#{1,4}\s/.test(line.trim());

const matchSection = (line: string): keyof typeof EMPTY | null => {
  const lowered = line.toLowerCase();
  for (const marker of SECTION_MARKERS) {
    if (marker.needles.some((needle) => lowered.includes(needle))) return marker.key;
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
  let current: 'lessonSummary' | 'vocabularyText' | 'homework' | 'suggestedFollowUp' | null = null;

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
  if (!found) {
    return {
      ...EMPTY,
      lessonSummary: (text || '').trim().slice(0, 4000),
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

  return {
    lessonSummary: (sections.lessonSummary || []).join('\n').trim().slice(0, 4000),
    vocabularyText: keyLanguage.vocabulary.slice(0, 8000),
    corrections: keyLanguage.fixes.slice(0, 4000),
    homeworkText: hwText.slice(0, 4000),
    homeworkAnswerKey: hwAnswerKey.slice(0, 4000),
    // thingsToImprove zachowane dla wstecznej kompatybilności
    thingsToImprove: [keyLanguage.fixes, hwText && `Zadanie z lekcji:\n${hwText}`]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 4000),
    suggestedFollowUp: (sections.suggestedFollowUp || []).join('\n').trim().slice(0, 2000),
    needsReview: !keyLanguage.vocabulary && !(sections.lessonSummary || []).length,
  };
};
