/**
 * Rozkładanie analizy AI na krótkie zdania do rotacji w panelu kursanta.
 *
 * Wydzielone z komponentu, bo to parsowanie swobodnego tekstu od modelu —
 * najbardziej kruchy fragment całej ścieżki i jedyny, który warto sprawdzać
 * testami (tests/motivationLines.test.ts). Model bywa rozwlekły, zwraca listy
 * jednowyrazowe albo urwane zdania; panel ma z tego wziąć tylko to, co da się
 * przeczytać w jednej linijce.
 */

export interface MotivationSource {
  overallTeacherCommentary?: string;
  keyStrengths?: string[];
  pedagogicalTip?: string;
}

/** Ile zdań trzyma rotacja — więcej i kursant nigdy nie zobaczy ostatniego. */
export const MAX_LINES = 4;

/** Dłuższe zdanie rozlewa się na kilka linijek i psuje rytm paska. */
export const MAX_LINE_LENGTH = 130;

/** Krótsze to zwykle urwany fragment albo nagłówek, nie zdanie. */
export const MIN_LINE_LENGTH = 21;

/** Tnie tekst na zdania i odrzuca te, które nie zmieszczą się w linijce. */
export function toLines(text?: string): string[] {
  const sentences = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?…]+[.!?…]+|\S[^.!?…]*$/g);
  if (!sentences) return [];
  return sentences
    .map((sentence) => sentence.trim())
    .filter(
      (sentence) => sentence.length >= MIN_LINE_LENGTH && sentence.length <= MAX_LINE_LENGTH
    );
}

/**
 * Układa zdania do rotacji.
 *
 * Mocne strony idą pierwsze — to one podbudowują, i to one są konkretne.
 * Komentarz i wskazówka dokładają treść, żeby rotacja nie była samą pochwałą.
 */
export function buildMotivationLines(summary: MotivationSource | null): string[] {
  if (!summary) return [];

  const strengths = (summary.keyStrengths || [])
    .map((item) => String(item).replace(/\s+/g, ' ').trim())
    .filter((item) => item.length >= MIN_LINE_LENGTH && item.length <= MAX_LINE_LENGTH)
    .map((item) => (/[.!?…]$/.test(item) ? item : `${item}.`));

  const candidates = [
    ...strengths,
    ...toLines(summary.overallTeacherCommentary),
    ...toLines(summary.pedagogicalTip),
  ];

  return Array.from(new Set(candidates)).slice(0, MAX_LINES);
}
