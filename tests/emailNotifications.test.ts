import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHomeworkEmail,
  buildUnsubscribeUrl,
  generateUnsubscribeToken,
} from '../functions/src/emailTemplate';

test('generateUnsubscribeToken tworzy powtarzalny 16-znakowy token HMAC', () => {
  const uid = 'student-test-uid-123';
  const token1 = generateUnsubscribeToken(uid);
  const token2 = generateUnsubscribeToken(uid);

  assert.equal(token1.length, 16);
  assert.equal(token1, token2);
  assert.notEqual(token1, generateUnsubscribeToken('other-student-uid'));
});

test('buildUnsubscribeUrl generuje poprawny URL z parametrami uid i token', () => {
  const uid = 'student-xyz';
  const url = buildUnsubscribeUrl(uid);

  assert.ok(url.startsWith('https://app.maciej.pro/unsubscribe?'));
  assert.ok(url.includes(`uid=${uid}`));
  assert.ok(url.includes(`token=${generateUnsubscribeToken(uid)}`));
});

test('buildHomeworkEmail zawiera link wypisania w wersji HTML i tekstowej', () => {
  const uid = 'student-abc';
  const unsubUrl = buildUnsubscribeUrl(uid);

  const email = buildHomeworkEmail({
    studentName: 'Jan Kowalski',
    title: 'Czasowniki modalne',
    dueDate: '2026-09-20',
    itemCount: 5,
    assignedBy: 'Lektor Testowy',
    unsubscribeUrl: unsubUrl,
  });

  // HTML (z poprawnie zakodowanym & w href jako &amp;)
  assert.ok(email.html.includes(unsubUrl.replace('&', '&amp;')));
  assert.ok(email.html.includes('Wypisz się z powiadomień e-mail'));

  // Text
  assert.ok(email.text.includes(unsubUrl));
  assert.ok(email.text.includes('Wypisz się z powiadomień:'));
});

test('buildHomeworkEmail działa poprawnie bez podanego unsubscribeUrl', () => {
  const email = buildHomeworkEmail({
    studentName: 'Jan',
    title: 'Test bez linku',
    itemCount: 3,
  });

  assert.ok(!email.html.includes('Wypisz się z powiadomień e-mail'));
  assert.ok(email.html.includes('Nowa praca domowa'));
  assert.ok(email.text.includes('czeka na Ciebie nowa praca domowa'));
});

test('buildHomeworkConfirmationEmail generuje powitanie z wołaczem i listę zadań', async () => {
  const { buildHomeworkConfirmationEmail } = await import('../services/homeworkEmail');

  const email = buildHomeworkConfirmationEmail({
    studentName: 'Aleksander Ziółkowski',
    title: 'Cybersecurity & Privacy in the AI Era',
    dueDate: '2026-09-16',
    instructions: 'Przetłumacz zdania zwracając uwagę na czasowniki modalne.',
    assignedBy: 'Maciej Wyrozumski',
    sentences: [
      { polishSentence: 'W dzisiejszych czasach prywatność w sieci jest kluczowa.', hint: 'crucial' },
      { polishSentence: 'Musimy uważać na podejrzane wiadomości e-mail.', hint: 'phishing' }
    ],
    customNote: 'Dobra robota na dzisiejszych zajęciach!',
  });

  assert.equal(email.greeting, 'Cześć, Aleksandrze!');
  assert.ok(email.html.includes('Cześć, Aleksandrze!'));
  assert.ok(email.html.includes('Cybersecurity &amp; Privacy in the AI Era'));
  assert.ok(email.html.includes('W dzisiejszych czasach prywatność w sieci jest kluczowa.'));
  assert.ok(email.html.includes('wskazówka: crucial'));
  assert.ok(email.html.includes('Dobra robota na dzisiejszych zajęciach!'));
  assert.ok(email.html.includes('CRIBRO ENGLISH • Nauka Języka Angielskiego'));
  assert.ok(email.text.includes('1. W dzisiejszych czasach prywatność w sieci jest kluczowa. (wskazówka: crucial)'));
});

