import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLessonSummary } from '../functions/src/notion/parse';

/**
 * Rozbiór podsumowania lekcji z Notion.
 *
 * Parser jest jedynym miejscem, w którym tekst pisany przez model zamienia się
 * w pola rekordu kursanta. Nie da się go sprawdzić „na żywo” bez tokenu Notion,
 * a błąd nie rzuca wyjątkiem — po cichu wpisuje kursantowi puste słownictwo
 * albo wrzuca całą lekcję w jedno pole. Stąd testy na prawdziwym kształcie
 * podsumowania, dokładnie takim, jaki wymusza skill „Meeting Summary”.
 */

const PODSUMOWANIE = `## Podsumowanie lekcji

### 1. Lekcja w skrócie

Data i godzina spotkania: 26.08.2026, 18:00

- Omówiono przygotowania do podróży i problemy podczas wakacji.
- Przećwiczono proszenie o pomoc i zgłaszanie problemów.

### 2. Key Language & Corrections

Nowe:
- string someone along — zwodzić kogoś
- picturesque — malowniczy

Powtórka — nadal wymaga pracy:
- proposal — oświadczyny; mylone z purpose

Corrections:
- ❌ be with she → ✅ be with her — po przyimku użyj formy dopełnienia.

Pronunciation:
- proposal — /prəˈpəʊzəl/ — akcent na drugiej sylabie.

### 3. Homework — Cribro Habit

Przetłumacz na angielski:
1. Muszę dotrzymać terminu.

### 4. Next Lesson

- Sprawdzić użycie dwóch zwrotów z pracy domowej.
`;

test('cztery bloki trafiają do właściwych pól rekordu', () => {
  const parsed = parseLessonSummary(PODSUMOWANIE);

  assert.match(parsed.lessonSummary, /Data i godzina spotkania: 26\.08\.2026/);
  assert.match(parsed.lessonSummary, /przygotowania do podróży/);
  assert.match(parsed.suggestedFollowUp, /Sprawdzić użycie dwóch zwrotów/);
  assert.equal(parsed.needsReview, false);
});

test('słownictwo dostaje separator, który rozumie parser aplikacji', () => {
  const parsed = parseLessonSummary(PODSUMOWANIE);
  const lines = parsed.vocabularyText.split('\n');

  // Skill zapisuje myślnikiem em; services/lessonRecord.ts dzieli po " - ".
  assert.ok(lines.includes('string someone along - zwodzić kogoś'));
  assert.ok(lines.includes('picturesque - malowniczy'));
  assert.ok(lines.some((l) => l.startsWith('proposal - oświadczyny')));
});

test('korekty i wymowa nie mieszają się ze słownictwem do powtórek', () => {
  const parsed = parseLessonSummary(PODSUMOWANIE);

  // Do fiszek nie może trafić zdanie o błędzie ani zapis fonetyczny.
  assert.ok(!parsed.vocabularyText.includes('be with she'));
  assert.ok(!parsed.vocabularyText.includes('prəˈpəʊzəl'));
  assert.match(parsed.thingsToImprove, /be with she/);
  assert.match(parsed.thingsToImprove, /prəˈpəʊzəl/);
});

test('zadanie z bloku 3 zostaje przy rzeczach do poprawy', () => {
  const parsed = parseLessonSummary(PODSUMOWANIE);
  assert.match(parsed.thingsToImprove, /Zadanie z lekcji:/);
  assert.match(parsed.thingsToImprove, /Muszę dotrzymać terminu/);
});

test('podnagłówki sekcji nie wchodzą do treści', () => {
  const parsed = parseLessonSummary(PODSUMOWANIE);
  const lines = parsed.vocabularyText.split('\n').map((l) => l.toLowerCase());
  assert.ok(!lines.includes('nowe:'));
  assert.ok(!lines.some((l) => l.startsWith('powtórka —')));
});

test('nierozpoznany format nie przepada, tylko prosi o przejrzenie', () => {
  const parsed = parseLessonSummary('Luźna notatka bez żadnych nagłówków.');

  assert.equal(parsed.needsReview, true);
  assert.match(parsed.lessonSummary, /Luźna notatka/);
  assert.equal(parsed.vocabularyText, '');
});

test('puste wejście nie wywraca importu', () => {
  const parsed = parseLessonSummary('');
  assert.equal(parsed.lessonSummary, '');
  assert.equal(parsed.vocabularyText, '');
  assert.equal(parsed.needsReview, true);
});

test('numerowany nagłówek bez krat też jest rozpoznawany', () => {
  const parsed = parseLessonSummary(
    '1. Lekcja w skrócie\nKrótkie omówienie.\n2. Key Language & Corrections\nNowe:\n- deadline — termin'
  );

  assert.match(parsed.lessonSummary, /Krótkie omówienie/);
  assert.ok(parsed.vocabularyText.includes('deadline - termin'));
});
