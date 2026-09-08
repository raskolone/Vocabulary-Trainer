import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitLevel } from '../functions/src/notion/sync';

/**
 * Wyciąganie poziomu z pola „Poziom / profil".
 *
 * W Notion to jedno pole tekstowe, w którym lektor trzyma poziom, godziny zajęć
 * i notatki naraz. Aplikacja pokazuje poziom jako plakietkę obok nazwiska, więc
 * całe zdanie rozpychało wiersz listy i wypychało z niego imię kursanta.
 *
 * Przypadki poniżej to prawdziwe wartości z bazy „Kursanci i grupy", nie
 * wymyślone na potrzeby testu — one decydują, czy podział jest dobry.
 */

test('bierze sam poziom, resztę zostawia w opisie', () => {
  const raw = 'B1 Final — wtorki i czwartki 7:30–8:30; start 08.09.2026';
  const { level, profile } = splitLevel(raw);
  assert.equal(level, 'B1');
  assert.equal(profile, raw);
});

test('rozpoznaje zakres poziomów po ukośniku', () => {
  assert.equal(splitLevel('B1/B1+ — Business English B1+/B2').level, 'B1/B1+');
  assert.equal(splitLevel('A2+/B1 — GE, mówienie B1→B1+').level, 'A2+/B1');
  assert.equal(splitLevel('B1+/B2 — GE B2/B2+, mówienie i słownictwo').level, 'B1+/B2');
});

test('sam poziom zostaje samym poziomem', () => {
  assert.equal(splitLevel('B2').level, 'B2');
});

test('gubi spacje wokół ukośnika, żeby plakietka była krótka', () => {
  assert.equal(splitLevel('C1 / CAE candidate').level, 'C1');
  assert.equal(splitLevel('A2 Medium — wtorki i czwartki 8:35–9:35').level, 'A2');
  assert.equal(splitLevel('B2 (mocne) — Business English / soft skills').level, 'B2');
});

test('bez poziomu na początku plakietka zostaje pusta', () => {
  // Lepiej nie mieć plakietki niż wpisać w nią zdanie — dokładnie ten błąd
  // sprawił, że Adam Zawadzki pojawił się na liście bez nazwiska.
  const opis = 'Nowa kursantka 1:1; Fundacja Onkologiczna Rakiety; start 04.09.2026';
  const { level, profile } = splitLevel(opis);
  assert.equal(level, '');
  assert.equal(profile, opis);

  assert.equal(splitLevel('Grupa mieszana: A2+–B1+ (dominująco B1)').level, '');
});

test('puste pole nie wywraca importu', () => {
  assert.deepEqual(splitLevel(''), { level: '', profile: '' });
  assert.deepEqual(splitLevel(undefined as unknown as string), { level: '', profile: '' });
});
