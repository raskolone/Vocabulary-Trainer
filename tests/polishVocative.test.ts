import test from 'node:test';
import assert from 'node:assert/strict';
import { toPolishVocative, formatPolishGreeting } from '../utils/polishVocative';

test('toPolishVocative poprawnie odmienia imiona w wołaczu', () => {
  assert.equal(toPolishVocative('Anna'), 'Anno');
  assert.equal(toPolishVocative('Anna Nowak'), 'Anno');
  assert.equal(toPolishVocative('Marta'), 'Marto');
  assert.equal(toPolishVocative('Kasia'), 'Kasiu');
  assert.equal(toPolishVocative('Zuzia'), 'Zuziu');
  assert.equal(toPolishVocative('Maciej'), 'Macieju');
  assert.equal(toPolishVocative('Piotr'), 'Piotrze');
  assert.equal(toPolishVocative('Paweł'), 'Pawle');
  assert.equal(toPolishVocative('Michał'), 'Michale');
  assert.equal(toPolishVocative('Jan'), 'Janie');
  assert.equal(toPolishVocative('Tomasz'), 'Tomaszu');
  assert.equal(toPolishVocative('Łukasz'), 'Łukaszu');
  assert.equal(toPolishVocative('Krzysztof'), 'Krzysztofie');
  assert.equal(toPolishVocative('Jakub'), 'Jakubie');
  assert.equal(toPolishVocative('Adam'), 'Adamie');
  assert.equal(toPolishVocative('Karolina'), 'Karolino');
});

test('formatPolishGreeting tworzy eleganckie powitanie z przecinkiem', () => {
  assert.equal(formatPolishGreeting('Anna'), 'Cześć, Anno!');
  assert.equal(formatPolishGreeting('Marta'), 'Cześć, Marto!');
  assert.equal(formatPolishGreeting('Maciej'), 'Cześć, Macieju!');
  assert.equal(formatPolishGreeting(''), 'Cześć!');
});
