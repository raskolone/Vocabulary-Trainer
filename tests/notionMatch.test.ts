import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountFingerprint, matchAccount } from '../functions/src/notion/sync';

/**
 * Rozpoznawanie konta kursanta przy imporcie z Notion.
 *
 * To najdroższa pomyłka w całym imporcie: źle dopasowane konto przenosi lekcje
 * jednego kursanta do drugiego, a zauważy to dopiero człowiek, przeglądając
 * cudzą historię. Testy pilnują kolejności kryteriów — od najpewniejszego do
 * najsłabszego — i tych sytuacji, w których dopasowanie ma się NIE wydarzyć.
 */

const KONTA: AccountFingerprint[] = [
  { id: 'u1', email: 'bartek556633@wp.pl', firstName: 'Bartłomiej', lastName: 'Ciura' },
  { id: 'u2', email: 'kasia.skrzypiec27@gmail.com', username: 'Kasia Skrzypiec' },
  { id: 'u3', email: 'stary@adres.pl', notionPageId: 'notion-3', firstName: 'Zbigniew', lastName: 'Kowalski' },
  { id: 'u4', email: 'anna@student.vocabboost.com', firstName: 'Anna', lastName: 'Nowak' },
];

test('zapisane powiązanie wygrywa z każdym innym kryterium', () => {
  // Adres wskazuje na u1, ale powiązanie na u3 — powiązanie jest pewniejsze.
  const hit = matchAccount(KONTA, 'notion-3', ['bartek556633@wp.pl'], 'Bartłomiej Ciura');
  assert.deepEqual(hit, { id: 'u3', reason: 'notion' });
});

test('adres e-mail wyprzedza imię i nazwisko', () => {
  const hit = matchAccount(KONTA, 'brak', ['kasia.skrzypiec27@gmail.com'], 'Bartłomiej Ciura');
  assert.deepEqual(hit, { id: 'u2', reason: 'email' });
});

test('imię i nazwisko działa, gdy nie ma nic pewniejszego', () => {
  const hit = matchAccount(KONTA, 'brak', [], 'Bartłomiej Ciura');
  assert.deepEqual(hit, { id: 'u1', reason: 'name' });
});

test('nazwa użytkownika jest ostatnią deską ratunku', () => {
  const hit = matchAccount(KONTA, 'brak', [], 'Kasia Skrzypiec');
  assert.deepEqual(hit, { id: 'u2', reason: 'username' });
});

test('ogonki i wielkość liter nie rozbijają dopasowania', () => {
  const hit = matchAccount(KONTA, 'brak', [], '  bartlomiej   CIURA ');
  assert.equal(hit?.id, 'u1');
});

test('adres porównuje się bez względu na wielkość liter', () => {
  const hit = matchAccount(KONTA, 'brak', ['Bartek556633@WP.PL'], 'ktoś zupełnie inny');
  assert.deepEqual(hit, { id: 'u1', reason: 'email' });
});

test('nieznany kursant nie zostaje do nikogo przypisany', () => {
  assert.equal(matchAccount(KONTA, 'brak', ['nowy@firma.pl'], 'Milena Miksa-Matyjasik'), null);
});

test('pusta nazwa nie łapie pierwszego lepszego konta', () => {
  // Bez tej ochrony pusty ciąg zrównałby się z kontem bez imienia i nazwiska.
  assert.equal(matchAccount(KONTA, 'brak', [], '   '), null);
});

test('konto bez imienia i nazwiska nie pasuje do pustej nazwy karty', () => {
  const konta: AccountFingerprint[] = [{ id: 'x', email: 'x@x.pl' }];
  assert.equal(matchAccount(konta, 'brak', [], ''), null);
});

test('pusta lista kont zwraca brak dopasowania', () => {
  assert.equal(matchAccount([], 'notion-3', ['a@b.pl'], 'Ktokolwiek'), null);
});

test('adres zastępczy nadal pozwala rozpoznać konto po nazwisku', () => {
  // Konto z zaślepką @student.vocabboost.com to typowy przypadek przed importem:
  // adres jest bezużyteczny, ale kursanta trzeba rozpoznać, żeby go poprawić.
  const hit = matchAccount(KONTA, 'brak', ['anna.nowak@firma.pl'], 'Anna Nowak');
  assert.deepEqual(hit, { id: 'u4', reason: 'name' });
});
