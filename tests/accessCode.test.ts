import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  buildPublicTestUrl,
  formatAccessCode,
  generateAccessCode,
  isValidAccessCode,
  normalizeAccessCode,
  readAccessCodeFromPath,
} from '../utils/accessCode';

/**
 * Kody dostępu do testów otwartych.
 *
 * Kod jest jedynym zabezpieczeniem testu, a jednocześnie czymś, co człowiek
 * przepisuje ręcznie z SMS-a. Testy pilnują obu stron tego kompromisu: że kodu
 * nie da się przewidzieć i że drobna pomyłka przy przepisywaniu (mała litera,
 * myślnik, O zamiast zera) nadal trafia w ten sam test.
 */

test('kod ma ustaloną długość i tylko znaki z alfabetu', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateAccessCode();
    assert.equal(code.length, CODE_LENGTH);
    for (const char of code) {
      assert.ok(CODE_ALPHABET.includes(char), `Znak ${char} spoza alfabetu`);
    }
  }
});

test('alfabet nie zawiera znaków mylących się przy przepisywaniu', () => {
  for (const confusing of ['0', 'O', '1', 'I', 'L', '5', 'S', '8', 'B']) {
    assert.ok(!CODE_ALPHABET.includes(confusing), `Alfabet zawiera mylący znak ${confusing}`);
  }
});

test('kody się nie powtarzają w rozsądnej próbie', () => {
  const codes = new Set(Array.from({ length: 300 }, () => generateAccessCode()));
  assert.equal(codes.size, 300);
});

test('normalizacja znosi wielkość liter, spacje i myślniki', () => {
  assert.equal(normalizeAccessCode('acd-efg'), 'ACDEFG');
  assert.equal(normalizeAccessCode('  acd efg  '), 'ACDEFG');
  assert.equal(normalizeAccessCode('ACD_EFG'), 'ACDEFG');
  assert.equal(normalizeAccessCode('acd.efg'), 'ACDEFG');
});

test('znaki mylące trafiają na swoje odpowiedniki, więc pomyłka nadal otwiera test', () => {
  // Kandydat widzi „D" i wpisuje „0" albo „O" — wszystkie trzy mają trafić tak samo.
  assert.equal(normalizeAccessCode('0CDEFG'), normalizeAccessCode('DCDEFG'));
  assert.equal(normalizeAccessCode('OCDEFG'), normalizeAccessCode('DCDEFG'));
  // J ← 1, I, L
  assert.equal(normalizeAccessCode('1CDEFG'), normalizeAccessCode('JCDEFG'));
  assert.equal(normalizeAccessCode('ICDEFG'), normalizeAccessCode('JCDEFG'));
  assert.equal(normalizeAccessCode('LCDEFG'), normalizeAccessCode('JCDEFG'));
  // X ← 5, S oraz W ← 8, B
  assert.equal(normalizeAccessCode('5CDEFG'), normalizeAccessCode('XCDEFG'));
  assert.equal(normalizeAccessCode('8CDEFG'), normalizeAccessCode('WCDEFG'));
});

test('normalizacja jest idempotentna — drugie przejście nic nie zmienia', () => {
  for (let i = 0; i < 30; i++) {
    const once = normalizeAccessCode(generateAccessCode());
    assert.equal(normalizeAccessCode(once), once);
  }
});

test('wygenerowany kod przechodzi własną walidację', () => {
  for (let i = 0; i < 30; i++) {
    assert.ok(isValidAccessCode(generateAccessCode()));
  }
});

test('walidacja odrzuca kody niepełne i śmieci', () => {
  assert.equal(isValidAccessCode(''), false);
  assert.equal(isValidAccessCode('ACD'), false);
  assert.equal(isValidAccessCode('ACDEFGH'), false);
  assert.equal(isValidAccessCode('!!!!!!'), false);
});

test('formatowanie rozbija kod na dwie trójki, a nietypowy zostawia w spokoju', () => {
  assert.equal(formatAccessCode('ACDEFG'), 'ACD-EFG');
  assert.equal(formatAccessCode('ACD'), 'ACD');
});

test('link zawiera kod i podane źródło', () => {
  assert.equal(buildPublicTestUrl('acdefg', 'https://recall.app'), 'https://recall.app/test/ACDEFG');
});

test('kod czyta się ze ścieżki linku w każdej postaci', () => {
  assert.equal(readAccessCodeFromPath('/test/ACDEFG'), 'ACDEFG');
  assert.equal(readAccessCodeFromPath('/test/acd-efg'), 'ACDEFG');
  assert.equal(readAccessCodeFromPath('/test/'), '');
  assert.equal(readAccessCodeFromPath('/test'), '');
});

test('ścieżka spoza testów nie zwraca kodu', () => {
  assert.equal(readAccessCodeFromPath('/dashboard'), '');
  assert.equal(readAccessCodeFromPath('/starter'), '');
  assert.equal(readAccessCodeFromPath(''), '');
});

test('każdy znak alfabetu przechodzi normalizację bez zmiany', () => {
  // Gdyby generator produkował znak, który normalizacja na coś zamienia,
  // zapisany kod i kod wpisany przez kandydata wskazywałyby różne dokumenty.
  for (const char of CODE_ALPHABET) {
    assert.equal(
      normalizeAccessCode(char.repeat(CODE_LENGTH)),
      char.repeat(CODE_LENGTH),
      `Znak ${char} jest zamieniany przez normalizację, a mimo to wychodzi z generatora`
    );
  }
});
