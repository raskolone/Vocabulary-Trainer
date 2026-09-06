import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AttemptRecord,
  CefrLevel,
  DECISION_WINDOW,
  LearningProfile,
  assessDifficulty,
  buildStudentBriefing,
  createProfile,
  evaluateLevelChange,
  ingestAttempts,
  normalizeLevel,
  recordAttempts,
  shiftLevel,
  weakestExerciseTypes,
  windowAccuracy,
} from '../utils/learningCurve';

/**
 * Testy krzywej uczenia.
 *
 * Uruchomienie: `npm test` (node:test przez tsx — bez dodatkowych zależności).
 *
 * Sprawdzamy decyzje, nie kształt danych: kiedy poziom idzie w górę, kiedy w
 * dół, kiedy stoi mimo dobrych wyników, i czy błędy trafiają do notatki dla
 * modelu. To jedyne miejsce, w którym te reguły są rozstrzygane, więc test
 * pilnuje ich zamiast bazy i modelu.
 */

const NOW = '2026-09-06T10:00:00.000Z';

const attempt = (overrides: Partial<AttemptRecord> = {}): AttemptRecord => ({
  prompt: 'Muszę dotrzymać terminu.',
  expected: 'I have to meet the deadline.',
  given: 'I must meet deadline.',
  isCorrect: true,
  score: 100,
  level: 'B1',
  exerciseType: 'translation',
  date: NOW,
  ...overrides,
});

const seriesOf = (count: number, isCorrect: boolean, overrides: Partial<AttemptRecord> = {}) =>
  Array.from({ length: count }, () =>
    attempt({ isCorrect, score: isCorrect ? 100 : 0, ...overrides })
  );

const profileWith = (baseLevel: CefrLevel = 'B1'): LearningProfile =>
  createProfile('student-1', baseLevel, NOW);

test('normalizeLevel bierze niższy koniec zakresu i znosi zapisy z bazy', () => {
  assert.equal(normalizeLevel('B1'), 'B1');
  assert.equal(normalizeLevel('B1-B2'), 'B1');
  assert.equal(normalizeLevel('Poziom A2/B1'), 'A2');
  assert.equal(normalizeLevel('c1'), 'C1');
  assert.equal(normalizeLevel(undefined), 'B1');
  assert.equal(normalizeLevel('kompletnie nie poziom'), 'B1');
  assert.equal(normalizeLevel('', 'A1'), 'A1');
});

test('shiftLevel nie wychodzi poza skalę', () => {
  assert.equal(shiftLevel('A1', -1), 'A1');
  assert.equal(shiftLevel('C2', 1), 'C2');
  assert.equal(shiftLevel('B1', 1), 'B2');
});

test('recordAttempts liczy skuteczność i zapisuje wyłącznie błędy', () => {
  const profile = recordAttempts(
    profileWith(),
    [
      attempt({ isCorrect: true }),
      attempt({ isCorrect: false, score: 0, prompt: 'Zdanie z błędem', given: 'wrong' }),
      attempt({ isCorrect: true, exerciseType: 'word_order' }),
    ],
    NOW
  );

  assert.equal(profile.totalAttempts, 3);
  assert.equal(profile.totalCorrect, 2);
  assert.equal(profile.recentMistakes.length, 1);
  assert.equal(profile.recentMistakes[0].prompt, 'Zdanie z błędem');
  assert.equal(profile.byLevel.B1?.attempts, 3);
  assert.equal(profile.byExerciseType.word_order.attempts, 1);
  assert.equal(profile.attemptsSinceLevelChange, 3);
});

test('poziom nie rusza się przed pełnym oknem, nawet przy komplecie poprawnych', () => {
  const profile = recordAttempts(profileWith(), seriesOf(DECISION_WINDOW - 1, true), NOW);
  const decision = evaluateLevelChange(profile, NOW);

  assert.equal(decision.changed, false);
  assert.equal(decision.level, 'B1');
  assert.match(decision.reason, /Za mało prób/);
});

test('wysoka skuteczność w pełnym oknie podnosi poziom o jeden stopień', () => {
  const profile = recordAttempts(profileWith(), seriesOf(DECISION_WINDOW, true), NOW);
  const decision = evaluateLevelChange(profile, NOW);

  assert.equal(decision.changed, true);
  assert.equal(decision.level, 'B2');
  assert.equal(windowAccuracy(profile), 1);
});

test('niska skuteczność w pełnym oknie obniża poziom', () => {
  const profile = recordAttempts(profileWith(), seriesOf(DECISION_WINDOW, false), NOW);
  const decision = evaluateLevelChange(profile, NOW);

  assert.equal(decision.changed, true);
  assert.equal(decision.level, 'A2');
});

test('wynik w przedziale roboczym zostawia poziom w spokoju', () => {
  const mixed = [...seriesOf(8, true), ...seriesOf(4, false)];
  const profile = recordAttempts(profileWith(), mixed, NOW);
  const decision = evaluateLevelChange(profile, NOW);

  assert.equal(decision.changed, false);
  assert.match(decision.reason, /przedziale roboczym/);
});

test('dryf od poziomu lektora zatrzymuje się na jednym stopniu', () => {
  // Pierwsze okno: awans B1 -> B2.
  const first = ingestAttempts(profileWith('B1'), seriesOf(DECISION_WINDOW, true), NOW);
  assert.equal(first.profile.currentLevel, 'B2');

  // Drugie okno równie dobre — ale C1 to już dwa stopnie ponad poziom lektora.
  const second = ingestAttempts(first.profile, seriesOf(DECISION_WINDOW, true), NOW);
  assert.equal(second.profile.currentLevel, 'B2');
  assert.equal(second.decision.changed, false);
  assert.match(second.decision.reason, /nie schodzimy bez jego decyzji/);
});

test('histereza: po zmianie poziomu potrzeba kolejnego pełnego okna', () => {
  const promoted = ingestAttempts(profileWith('B1'), seriesOf(DECISION_WINDOW, true), NOW);
  assert.equal(promoted.profile.currentLevel, 'B2');
  assert.equal(promoted.profile.attemptsSinceLevelChange, 0);

  // Kilka porażek zaraz po awansie nie może cofnąć poziomu od ręki.
  const wobble = ingestAttempts(promoted.profile, seriesOf(3, false), NOW);
  assert.equal(wobble.profile.currentLevel, 'B2');
  assert.equal(wobble.decision.changed, false);
});

test('zmiana poziomu trafia do dziennika z uzasadnieniem', () => {
  const { profile } = ingestAttempts(profileWith('B1'), seriesOf(DECISION_WINDOW, true), NOW);

  assert.equal(profile.levelHistory.length, 1);
  assert.deepEqual(
    { from: profile.levelHistory[0].from, to: profile.levelHistory[0].to },
    { from: 'B1', to: 'B2' }
  );
  assert.match(profile.levelHistory[0].reason, /Skuteczność 100%/);
});

test('assessDifficulty mówi, co jest w zasięgu, a co za trudne', () => {
  const profile = profileWith('B1');

  assert.equal(assessDifficulty(profile, 'B1'), 'right');
  assert.equal(assessDifficulty(profile, 'B2'), 'stretch');
  assert.equal(assessDifficulty(profile, 'C1'), 'too_hard');
  assert.equal(assessDifficulty(profile, 'A2'), 'too_easy');
  assert.equal(assessDifficulty(profile, 'A1'), 'too_easy');
});

test('kursant, któremu bieżący poziom nie idzie, dostaje poziom niżej jako właściwy', () => {
  const struggling = recordAttempts(profileWith('B1'), seriesOf(DECISION_WINDOW, false), NOW);
  assert.equal(assessDifficulty(struggling, 'A2'), 'right');
});

test('weakestExerciseTypes pomija typy bez dorobku i sortuje od najsłabszego', () => {
  const profile = recordAttempts(
    profileWith(),
    [
      ...seriesOf(4, false, { exerciseType: 'word_order' }),
      ...seriesOf(4, true, { exerciseType: 'translation' }),
      ...seriesOf(1, false, { exerciseType: 'flashcards' }),
    ],
    NOW
  );

  assert.deepEqual(weakestExerciseTypes(profile), ['word_order', 'translation']);
});

test('briefing dla modelu niesie poziom, liczby i konkretne błędy', () => {
  const profile = recordAttempts(
    profileWith('B1'),
    [
      ...seriesOf(6, true),
      attempt({
        isCorrect: false,
        score: 0,
        prompt: 'Zajmuję się sprzedażą.',
        expected: 'I am responsible for sales.',
        given: 'I am responsable for sales.',
      }),
    ],
    NOW
  );

  const briefing = buildStudentBriefing(profile);

  assert.match(briefing, /Poziom, na którym układamy zadania: B1/);
  assert.match(briefing, /Skuteczność ogółem: 86% z 7 zadań/);
  assert.match(briefing, /I am responsable for sales/);
  assert.match(briefing, /nie wychodź powyżej B2/);
});

test('briefing bez historii mówi wprost, że danych jeszcze nie ma', () => {
  const briefing = buildStudentBriefing(profileWith('A2'));

  assert.match(briefing, /brak jeszcze historii ćwiczeń/);
  assert.match(briefing, /Poziom docelowy: A2/);
});
