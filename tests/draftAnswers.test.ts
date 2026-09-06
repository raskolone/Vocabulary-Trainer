import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Szkic odpowiedzi w schowku przeglądarki.
 *
 * Testujemy same funkcje zapisu i odczytu, bez Reacta — cała nietrywialna
 * logika (wygasanie, odporność na uszkodzony wpis, brak schowka) siedzi właśnie
 * tam, a to są błędy, które psują cicho: szkic albo nie wygasa nigdy, albo
 * znika od razu, i w obu przypadkach aplikacja działa dalej bez skargi.
 *
 * `localStorage` nie istnieje w Node, więc podstawiamy minimalną atrapę zanim
 * moduł zostanie zaimportowany.
 */

const store = new Map<string, string>();

(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

const { readDraft, writeDraft, dropDraft, TTL_MS } = await import('../hooks/useDraftAnswers');

beforeEach(() => store.clear());

test('zapisany szkic wraca w całości', () => {
  writeDraft('hw-1', { 0: 'I have to meet the deadline.', 1: 'She works here.' });
  assert.deepEqual(readDraft('hw-1'), {
    0: 'I have to meet the deadline.',
    1: 'She works here.',
  });
});

test('brak szkicu to null, nie wyjątek', () => {
  assert.equal(readDraft('nie-ma-takiego'), null);
});

test('szkice różnych zadań nie mieszają się', () => {
  writeDraft('hw-1', { 0: 'pierwsze' });
  writeDraft('hw-2', { 0: 'drugie' });
  assert.deepEqual(readDraft('hw-1'), { 0: 'pierwsze' });
  assert.deepEqual(readDraft('hw-2'), { 0: 'drugie' });
});

test('szkic starszy niż termin ważności nie wraca i znika ze schowka', () => {
  const stale = { value: { 0: 'sprzed miesiąca' }, savedAt: Date.now() - TTL_MS - 1000 };
  store.set('hw-stary', JSON.stringify(stale));

  assert.equal(readDraft('hw-stary'), null);
  assert.equal(store.has('hw-stary'), false, 'przeterminowany szkic ma zostać skasowany');
});

test('szkic tuż przed terminem ważności nadal wraca', () => {
  const fresh = { value: { 0: 'wczorajsze' }, savedAt: Date.now() - TTL_MS + 60_000 };
  store.set('hw-swiezy', JSON.stringify(fresh));

  assert.deepEqual(readDraft('hw-swiezy'), { 0: 'wczorajsze' });
});

test('uszkodzony wpis nie wysypuje odczytu', () => {
  store.set('hw-zepsuty', '{to nie jest json');
  assert.equal(readDraft('hw-zepsuty'), null);
});

test('wpis bez znacznika czasu jest odrzucany', () => {
  // Tak wygląda wpis zapisany innym mechanizmem — nie wiemy, ile ma lat.
  store.set('hw-obcy', JSON.stringify({ value: { 0: 'coś' } }));
  assert.equal(readDraft('hw-obcy'), null);
});

test('skasowany szkic już nie wraca', () => {
  writeDraft('hw-1', { 0: 'do skasowania' });
  dropDraft('hw-1');
  assert.equal(readDraft('hw-1'), null);
});

test('zablokowany schowek nie przerywa pracy nad zadaniem', () => {
  const original = (globalThis as any).window.localStorage;
  (globalThis as any).window.localStorage = {
    getItem: () => {
      throw new Error('Schowek zablokowany');
    },
    setItem: () => {
      throw new Error('Schowek pełny');
    },
    removeItem: () => {
      throw new Error('Schowek zablokowany');
    },
  };

  // Żadne z tych wywołań nie ma prawa rzucić — utrata szkicu to niewygoda,
  // a wyjątek w trakcie wpisywania odpowiedzi to utrata całego zadania.
  assert.doesNotThrow(() => writeDraft('hw-1', { 0: 'x' }));
  assert.doesNotThrow(() => dropDraft('hw-1'));
  assert.equal(readDraft('hw-1'), null);

  (globalThis as any).window.localStorage = original;
});
