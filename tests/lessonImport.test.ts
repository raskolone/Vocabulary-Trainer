import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImportedLessons, normalizeLessonDate } from '../utils/lessonImport';

/**
 * Import historii lekcji z transkrypcji.
 *
 * Wejściem jest to, co zwróci model — a on przy dłuższych dokumentach potrafi
 * oddać datę w zapisie z kropkami, pustą lekcję, liczbę zamiast tekstu albo samą
 * tablicę zamiast obiektu. Każdy z tych przypadków kiedyś zepsuł import, więc
 * każdy ma tu swój test.
 */

const TODAY = '2026-09-06';

test('data w formacie ISO przechodzi bez zmian', () => {
  assert.equal(normalizeLessonDate('2024-03-12', TODAY), '2024-03-12');
});

test('polski zapis daty czyta się jako dzień-miesiąc, nie miesiąc-dzień', () => {
  // 12.03 to 12 marca. Amerykańska kolejność dałaby tu 3 grudnia.
  assert.equal(normalizeLessonDate('12.03.2024', TODAY), '2024-03-12');
  assert.equal(normalizeLessonDate('12/03/2024', TODAY), '2024-03-12');
  assert.equal(normalizeLessonDate('12-03-2024', TODAY), '2024-03-12');
});

test('jednocyfrowy dzień i miesiąc dostają wiodące zero', () => {
  assert.equal(normalizeLessonDate('5.1.2024', TODAY), '2024-01-05');
});

test('brak daty albo śmieć w polu daje dzisiejszą datę', () => {
  assert.equal(normalizeLessonDate('', TODAY), TODAY);
  assert.equal(normalizeLessonDate(null, TODAY), TODAY);
  assert.equal(normalizeLessonDate(undefined, TODAY), TODAY);
  assert.equal(normalizeLessonDate('brak daty', TODAY), TODAY);
});

test('wynik zawsze ma kształt YYYY-MM-DD, bo historia sortuje się tekstem', () => {
  for (const input of ['2024-03-12', '12.03.2024', 'kompletny śmieć', '', 'March 12, 2024']) {
    assert.match(
      normalizeLessonDate(input, TODAY),
      /^\d{4}-\d{2}-\d{2}$/,
      `Zły format dla wejścia: ${input}`
    );
  }
});

test('lekcje wyciągają się z obiektu z polem lessons', () => {
  const lessons = normalizeImportedLessons(
    {
      lessons: [
        {
          date: '12.03.2024',
          studentId: 'abc',
          lessonTopic: 'Present Perfect',
          revisionNotes: 'Omówiliśmy czasy',
          vocabularyText: 'deadline - termin',
        },
      ],
    },
    { today: TODAY }
  );

  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].date, '2024-03-12');
  assert.equal(lessons[0].lessonTopic, 'Present Perfect');
});

test('sama tablica zamiast obiektu też jest przyjmowana', () => {
  const lessons = normalizeImportedLessons(
    [{ date: '2024-03-12', lessonTopic: 'Temat', studentId: 'x' }],
    { today: TODAY }
  );
  assert.equal(lessons.length, 1);
});

test('odpowiedź bez lekcji nie wywraca importu', () => {
  assert.deepEqual(normalizeImportedLessons(null, { today: TODAY }), []);
  assert.deepEqual(normalizeImportedLessons({}, { today: TODAY }), []);
  assert.deepEqual(normalizeImportedLessons({ lessons: null }, { today: TODAY }), []);
  assert.deepEqual(normalizeImportedLessons({ lessons: 'nie tablica' }, { today: TODAY }), []);
});

test('pusta lekcja nie trafia do historii kursanta', () => {
  const lessons = normalizeImportedLessons(
    {
      lessons: [
        { date: '2024-03-12', studentId: 'abc' },
        { date: '2024-03-13', studentId: 'abc', lessonTopic: '   ' },
        { date: '2024-03-14', studentId: 'abc', lessonTopic: 'Ma temat' },
      ],
    },
    { today: TODAY }
  );

  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].lessonTopic, 'Ma temat');
});

test('lekcja bez tematu, ale z notatkami albo słownictwem, zostaje', () => {
  const lessons = normalizeImportedLessons(
    {
      lessons: [
        { date: '2024-03-12', revisionNotes: 'Rozmowa o pracy' },
        { date: '2024-03-13', vocabularyText: 'deadline - termin' },
      ],
    },
    { today: TODAY }
  );
  assert.equal(lessons.length, 2);
});

test('brak studentId uzupełnia się kursantem z otwartej zakładki', () => {
  const lessons = normalizeImportedLessons(
    { lessons: [{ date: '2024-03-12', lessonTopic: 'Temat' }] },
    { today: TODAY, fallbackStudentId: 'student-7' }
  );
  assert.equal(lessons[0].studentId, 'student-7');
});

test('studentId z modelu ma pierwszeństwo nad kursantem z zakładki', () => {
  const lessons = normalizeImportedLessons(
    { lessons: [{ date: '2024-03-12', lessonTopic: 'Temat', studentId: 'z-pliku' }] },
    { today: TODAY, fallbackStudentId: 'z-zakladki' }
  );
  assert.equal(lessons[0].studentId, 'z-pliku');
});

test('liczby i null w polach tekstowych nie wywracają zapisu', () => {
  const lessons = normalizeImportedLessons(
    {
      lessons: [
        {
          date: '2024-03-12',
          lessonTopic: 42,
          revisionNotes: null,
          vocabularyText: undefined,
          studentSpeaking: 7,
          studentIds: 'nie tablica',
        },
      ],
    },
    { today: TODAY }
  );

  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].lessonTopic, '42');
  assert.equal(lessons[0].revisionNotes, '');
  assert.deepEqual(lessons[0].studentIds, []);
  assert.equal(typeof lessons[0].studentSpeaking, 'string');
});

test('wpisy, które nie są obiektami, są pomijane', () => {
  const lessons = normalizeImportedLessons(
    { lessons: [null, 'tekst', 42, { date: '2024-03-12', lessonTopic: 'Prawdziwa' }] },
    { today: TODAY }
  );
  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].lessonTopic, 'Prawdziwa');
});
