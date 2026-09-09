import test from 'node:test';
import assert from 'node:assert/strict';
import { formatHomeworkAnswerText, homeworkItemType } from '../utils/homework';

test('formatHomeworkAnswerText bezpiecznie formatuje odpowiedź typu string', () => {
  assert.equal(formatHomeworkAnswerText('I went to the store'), 'I went to the store');
  assert.equal(formatHomeworkAnswerText('   Hello world   '), 'Hello world');
  assert.equal(formatHomeworkAnswerText(''), '(Brak odpowiedzi)');
  assert.equal(formatHomeworkAnswerText(null), '(Brak odpowiedzi)');
  assert.equal(formatHomeworkAnswerText(undefined), '(Brak odpowiedzi)');
});

test('formatHomeworkAnswerText bezpiecznie formatuje odpowiedź z lukami (obiekt {BLANK_1, BLANK_2, ...})', () => {
  const blankAnswer = {
    BLANK_1: 'has been',
    BLANK_2: 'since',
    BLANK_3: 'morning',
  };
  const formatted = formatHomeworkAnswerText(blankAnswer);
  assert.match(formatted, /#1:\s*has been/);
  assert.match(formatted, /#2:\s*since/);
  assert.match(formatted, /#3:\s*morning/);
});

test('formatHomeworkAnswerText obsługuje pusty obiekt jako brak odpowiedzi', () => {
  assert.equal(formatHomeworkAnswerText({}), '(Brak odpowiedzi)');
  assert.equal(formatHomeworkAnswerText({ BLANK_1: '' }), '(Brak odpowiedzi)');
});

test('formatHomeworkAnswerText bezpiecznie formatuje tablice i liczby', () => {
  assert.equal(formatHomeworkAnswerText(['The', 'quick', 'brown', 'fox']), 'The quick brown fox');
  assert.equal(formatHomeworkAnswerText(2), '2');
  assert.equal(formatHomeworkAnswerText(0), '0');
});

test('homeworkItemType poprawnie rozpoznaje typ ćwiczenia z elementu lub zadania', () => {
  assert.equal(homeworkItemType({ type: 'fill_in_the_blank' }), 'fill_in_the_blank');
  assert.equal(homeworkItemType({ type: 'multiple_choice' }), 'multiple_choice');
  assert.equal(homeworkItemType({ type: 'find_errors' }), 'find_errors');
  assert.equal(homeworkItemType({ incorrectSentence: 'She don\'t know.' }), 'find_errors');
  assert.equal(homeworkItemType({ chunks: ['She', 'doesn\'t', 'know'] }), 'word_order');
  assert.equal(homeworkItemType({}, { type: 'find_errors' }), 'find_errors');
  assert.equal(homeworkItemType({}, { type: 'word_order' }), 'word_order');
  assert.equal(homeworkItemType({}, null), 'translation');
});
