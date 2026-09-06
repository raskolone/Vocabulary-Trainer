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
  ingestAttempts,
} from '../utils/learningCurve';

/**
 * Scenariusze przez wiele sesji — to, co realnie dzieje się z kursantem
 * przez kilka tygodni, a nie pojedyncze wywołanie funkcji.
 *
 * Testy jednostkowe obok pilnują reguł z osobna; tutaj sprawdzamy, że złożone
 * w całość dają zachowanie, którego oczekuje lektor: poziom idzie za wynikami,
 * ale nie skacze, a model zawsze dostaje aktualny obraz kursanta.
 */

const day = (n: number): string => `2026-09-${String(n).padStart(2, '0')}T10:00:00.000Z`;

const session = (
  count: number,
  correctCount: number,
  level: CefrLevel,
  date: string,
  exerciseType = 'translation'
): AttemptRecord[] =>
  Array.from({ length: count }, (_, i) => ({
    prompt: `Zdanie ${i + 1} z ${date}`,
    expected: 'I have to meet the deadline.',
    given: i < correctCount ? 'I have to meet the deadline.' : 'I must meet deadline.',
    isCorrect: i < correctCount,
    score: i < correctCount ? 100 : 0,
    level,
    exerciseType,
    date,
  }));

/** Przepuszcza kolejne sesje przez profil, tak jak robi to aplikacja. */
const runSessions = (
  start: LearningProfile,
  sessions: Array<{ attempts: AttemptRecord[]; date: string }>
): LearningProfile =>
  sessions.reduce(
    (profile, { attempts, date }) => ingestAttempts(profile, attempts, date).profile,
    start
  );

test('kursant, któremu idzie dobrze, dostaje trudniejsze zadania po pełnym oknie', () => {
  const profile = runSessions(createProfile('s1', 'B1', day(1)), [
    { attempts: session(6, 6, 'B1', day(1)), date: day(1) },
    { attempts: session(6, 5, 'B1', day(3)), date: day(3) },
  ]);

  assert.equal(profile.currentLevel, 'B2');
  assert.equal(profile.totalAttempts, 12);
  assert.equal(profile.totalCorrect, 11);
});

test('kursant, który tonie, dostaje łatwiejsze zadania i wraca w górę, gdy odbije', () => {
  const struggling = runSessions(createProfile('s2', 'B2', day(1)), [
    { attempts: session(6, 1, 'B2', day(1)), date: day(1) },
    { attempts: session(6, 2, 'B2', day(2)), date: day(2) },
  ]);
  assert.equal(struggling.currentLevel, 'B1');

  const recovered = runSessions(struggling, [
    { attempts: session(6, 6, 'B1', day(9)), date: day(9) },
    { attempts: session(6, 6, 'B1', day(11)), date: day(11) },
  ]);
  assert.equal(recovered.currentLevel, 'B2');
});

test('jedna słaba sesja nie cofa poziomu — decyduje okno, nie ostatni dzień', () => {
  const promoted = runSessions(createProfile('s3', 'B1', day(1)), [
    { attempts: session(12, 12, 'B1', day(1)), date: day(1) },
  ]);
  assert.equal(promoted.currentLevel, 'B2');

  const afterBadDay = runSessions(promoted, [
    { attempts: session(5, 0, 'B2', day(2)), date: day(2) },
  ]);
  assert.equal(afterBadDay.currentLevel, 'B2');
});

test('poziom nie ucieka od decyzji lektora nawet po serii świetnych sesji', () => {
  const profile = runSessions(createProfile('s4', 'A2', day(1)), [
    { attempts: session(12, 12, 'A2', day(1)), date: day(1) },
    { attempts: session(12, 12, 'B1', day(3)), date: day(3) },
    { attempts: session(12, 12, 'B1', day(5)), date: day(5) },
  ]);

  // Lektor wpisał A2; algorytm doszedł do B1 i tam się zatrzymał.
  assert.equal(profile.currentLevel, 'B1');
});

test('mieszane typy zadań: krzywa widzi każdy z osobna i całość razem', () => {
  const profile = runSessions(createProfile('s5', 'B1', day(1)), [
    { attempts: session(4, 4, 'B1', day(1), 'translation'), date: day(1) },
    { attempts: session(4, 1, 'B1', day(2), 'word_order'), date: day(2) },
    { attempts: session(4, 4, 'B1', day(3), 'recall'), date: day(3) },
  ]);

  assert.equal(profile.byExerciseType.translation.correct, 4);
  assert.equal(profile.byExerciseType.word_order.correct, 1);
  assert.equal(profile.byExerciseType.recall.attempts, 4);
  assert.equal(profile.totalAttempts, 12);

  // 9/12 to przedział roboczy — poziom stoi mimo pełnego okna.
  assert.equal(profile.currentLevel, 'B1');
});

test('briefing dla modelu nadąża za poziomem po jego zmianie', () => {
  const profile = runSessions(createProfile('s6', 'B1', day(1)), [
    { attempts: session(12, 12, 'B1', day(1)), date: day(1) },
  ]);

  const briefing = buildStudentBriefing(profile);
  assert.match(briefing, /układamy zadania: B2/);
  assert.match(briefing, /najwyżej jedno na C1/);
  assert.match(briefing, /Nie schodź poniżej B1/);
});

test('błędy z ostatnich sesji trafiają do promptu, starsze wypadają', () => {
  const profile = runSessions(createProfile('s7', 'B1', day(1)), [
    { attempts: session(20, 0, 'B1', day(1)), date: day(1) },
    {
      attempts: [
        {
          prompt: 'Najnowszy błąd kursanta',
          expected: 'I have been working here for two years.',
          given: 'I work here since two years.',
          isCorrect: false,
          score: 0,
          level: 'B1',
          exerciseType: 'translation',
          date: day(4),
        },
      ],
      date: day(4),
    },
  ]);

  const briefing = buildStudentBriefing(profile);
  assert.match(briefing, /Najnowszy błąd kursanta/);
  assert.ok(profile.recentMistakes.length <= 15);
  assert.equal(profile.recentMistakes[profile.recentMistakes.length - 1].prompt, 'Najnowszy błąd kursanta');
});

test('po awansie zadania ze starego poziomu przestają być „w punkt"', () => {
  const before = createProfile('s8', 'B1', day(1));
  assert.equal(assessDifficulty(before, 'B1'), 'right');

  const after = runSessions(before, [
    { attempts: session(12, 12, 'B1', day(1)), date: day(1) },
  ]);

  assert.equal(assessDifficulty(after, 'B2'), 'right');
  assert.equal(assessDifficulty(after, 'B1'), 'too_easy');
  assert.equal(assessDifficulty(after, 'C1'), 'stretch');
  assert.equal(assessDifficulty(after, 'C2'), 'too_hard');
});

test('dziennik zmian poziomu zachowuje kolejność decyzji', () => {
  const up = runSessions(createProfile('s9', 'B1', day(1)), [
    { attempts: session(12, 12, 'B1', day(1)), date: day(1) },
  ]);
  const down = runSessions(up, [
    { attempts: session(12, 2, 'B2', day(5)), date: day(5) },
  ]);

  assert.equal(down.levelHistory.length, 2);
  assert.deepEqual(
    down.levelHistory.map((entry) => `${entry.from}->${entry.to}`),
    ['B1->B2', 'B2->B1']
  );
});

test('sesje krótsze niż okno sumują się do decyzji zamiast ją blokować', () => {
  // Kursant robi po 3 zadania dziennie — po czterech dniach zbiera się okno.
  const profile = runSessions(createProfile('s10', 'B1', day(1)), [
    { attempts: session(3, 3, 'B1', day(1)), date: day(1) },
    { attempts: session(3, 3, 'B1', day(2)), date: day(2) },
    { attempts: session(3, 3, 'B1', day(3)), date: day(3) },
    { attempts: session(3, 3, 'B1', day(4)), date: day(4) },
  ]);

  assert.equal(profile.totalAttempts, DECISION_WINDOW);
  assert.equal(profile.currentLevel, 'B2');
});
