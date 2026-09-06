import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_LINES,
  buildMotivationLines,
  toLines,
} from '../utils/motivationLines';

/**
 * Zdania motywacyjne w panelu.
 *
 * Wejściem jest swobodny tekst od modelu, więc testy sprawdzają zachowanie przy
 * kształtach, które model realnie zwraca: listy jednowyrazowe, akapity bez
 * kropki na końcu, powtórzenia i puste pola.
 */

test('toLines tnie akapit na zdania', () => {
  const lines = toLines(
    'Twoje tłumaczenia są coraz precyzyjniejsze. Widać postęp w czasach przeszłych. Krótkie.'
  );

  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'Twoje tłumaczenia są coraz precyzyjniejsze.');
  assert.ok(!lines.includes('Krótkie.'));
});

test('toLines odrzuca zdania za długie na linijkę panelu', () => {
  const long = `${'Bardzo rozwlekłe zdanie o postępach kursanta '.repeat(6)}.`;
  assert.deepEqual(toLines(long), []);
});

test('toLines znosi pusty i niepełny tekst', () => {
  assert.deepEqual(toLines(undefined), []);
  assert.deepEqual(toLines(''), []);
  assert.deepEqual(toLines('   '), []);
});

test('zdanie bez kropki na końcu też się liczy', () => {
  const lines = toLines('Świetnie radzisz sobie z szykiem zdania angielskiego');
  assert.equal(lines.length, 1);
});

test('mocne strony idą pierwsze i dostają kropkę', () => {
  const lines = buildMotivationLines({
    keyStrengths: ['Bardzo dobra znajomość czasów przeszłych'],
    overallTeacherCommentary: 'Ogólnie widać systematyczną pracę nad słownictwem.',
  });

  assert.equal(lines[0], 'Bardzo dobra znajomość czasów przeszłych.');
  assert.equal(lines[1], 'Ogólnie widać systematyczną pracę nad słownictwem.');
});

test('krótkie hasła z listy modelu nie trafiają do rotacji', () => {
  const lines = buildMotivationLines({ keyStrengths: ['Gramatyka', 'Słownictwo'] });
  assert.deepEqual(lines, []);
});

test('powtórzone zdanie pojawia się w rotacji raz', () => {
  const repeated = 'Twoje tłumaczenia są coraz precyzyjniejsze.';
  const lines = buildMotivationLines({
    keyStrengths: [repeated],
    overallTeacherCommentary: repeated,
    pedagogicalTip: repeated,
  });

  assert.deepEqual(lines, [repeated]);
});

test('rotacja nie przekracza limitu zdań', () => {
  const lines = buildMotivationLines({
    keyStrengths: [
      'Bardzo dobra znajomość czasów przeszłych',
      'Naturalny szyk zdania w wypowiedziach pisemnych',
      'Konsekwentna praca nad wymową trudnych głosek',
    ],
    overallTeacherCommentary:
      'Widać wyraźny postęp w ostatnich sesjach nauki. Systematyczność zaczyna przynosić efekty. Kolejny krok to praca nad przyimkami.',
    pedagogicalTip: 'Warto powtarzać nowe zwroty na głos tuż przed snem.',
  });

  assert.equal(lines.length, MAX_LINES);
});

test('brak analizy znaczy brak zdań, nie pusty dymek', () => {
  assert.deepEqual(buildMotivationLines(null), []);
  assert.deepEqual(buildMotivationLines({}), []);
});
