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
