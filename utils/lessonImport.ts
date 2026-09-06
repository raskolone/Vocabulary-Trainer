/**
 * Porządkowanie lekcji wyciągniętych przez model z transkrypcji.
 *
 * Model dostaje instrukcję, jak ma zwrócić dane, ale przy dłuższych dokumentach
 * i tak przepuszcza: daty w zapisie „12.03.2024", puste wpisy bez tematu, liczby
 * zamiast tekstu, czasem samą tablicę zamiast obiektu z polem `lessons`.
 * `responseSchema` nie ratuje — działa tylko dla Gemini, a kaskada zaczyna od
 * modelu OpenAI, któremu przekazujemy wyłącznie `response_format: json_object`.
 *
 * Dlatego kształt pilnujemy u siebie, a nie w promptcie — i dlatego ta logika
 * jest tutaj, poza serwerem, żeby dało się ją przetestować bez wołania modelu.
 */

export interface ImportedLesson {
  date: string;
  studentId: string;
  studentIds: string[];
  lessonTopic: string;
  revisionNotes: string;
  vocabularyText: string;
  studentSpeaking: string;
  thingsToImprove: string;
  suggestedFollowUp: string;
}

const asText = (value: unknown): string =>
  typeof value === 'string' ? value : value == null ? '' : String(value);

/**
 * Sprowadza datę do YYYY-MM-DD.
 *
 * Cała aplikacja porównuje i sortuje daty lekcji jako zwykły tekst, więc
 * „12.03.2024" obok „2024-03-12" znaczy historię ułożoną w złej kolejności —
 * i to jest ten rodzaj usterki, którą widać dopiero po miesiącu.
 *
 * `today` jest parametrem, a nie odczytem zegara w środku, żeby test nie zależał
 * od dnia, w którym się go uruchamia.
 */
export function normalizeLessonDate(value: unknown, today: string): string {
  const text = asText(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  // Zapis dzienny: 12.03.2024, 12/03/2024, 12-03-2024. W polskich notatkach
  // pierwszy jest dzień, nie miesiąc — amerykańska kolejność dałaby tu 3 grudnia.
  const dmy = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  if (text && !isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];

  return today;
}

/**
 * Wyciąga listę lekcji z tego, co zwrócił model.
 *
 * Odrzuca wpisy bez treści: lekcja z samą datą, bez tematu i bez notatek, to
 * dla lektora pusty wiersz w historii kursanta, który musi potem znaleźć
 * i skasować ręcznie.
 */
export function normalizeImportedLessons(
  payload: any,
  options: { today: string; fallbackStudentId?: string }
): ImportedLesson[] {
  const { today, fallbackStudentId = '' } = options;

  const raw = Array.isArray(payload?.lessons)
    ? payload.lessons
    : Array.isArray(payload)
      ? payload
      : [];

  return raw
    .filter((lesson: any) => lesson && typeof lesson === 'object')
    .map((lesson: any) => ({
      date: normalizeLessonDate(lesson.date, today),
      studentId: asText(lesson.studentId) || fallbackStudentId,
      studentIds: Array.isArray(lesson.studentIds)
        ? lesson.studentIds.map(asText).filter(Boolean)
        : [],
      lessonTopic: asText(lesson.lessonTopic).trim(),
      revisionNotes: asText(lesson.revisionNotes),
      vocabularyText: asText(lesson.vocabularyText),
      studentSpeaking: asText(lesson.studentSpeaking),
      thingsToImprove: asText(lesson.thingsToImprove),
      suggestedFollowUp: asText(lesson.suggestedFollowUp),
    }))
    .filter(
      (lesson: ImportedLesson) =>
        lesson.lessonTopic || lesson.revisionNotes.trim() || lesson.vocabularyText.trim()
    );
}
