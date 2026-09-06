import {
  HomeworkType,
  LessonRecord,
  MultipleChoiceExercise,
  TranslationExercise,
  WordOrderExercise,
} from '../types';
import {
  PREFERRED_AI_MODELS,
  extractJSON,
  generateFillInTheBlankExercises,
  generateTextWithUnifiedFallback,
  generateTranslationExercises,
} from './geminiService';
import { getApprovedVocabularyText, splitVocabularyLines } from '../utils/vocabulary';
import { PRIMARY_MODEL } from './aiModels';
import { getStudentAiContext } from './learningProfile';

/**
 * Układanie pracy domowej z materiału lektora.
 *
 * Wejściem jest zawsze tekst: albo złożony z wybranych lekcji kursanta, albo
 * wklejony ręcznie. Model dostaje ten sam materiał niezależnie od typu zadania,
 * więc jedno zadanie domowe trzyma się jednego słownictwa, nawet gdy składa się
 * z kilku rodzajów ćwiczeń.
 *
 * Każdy typ leci osobnym zapytaniem. Jedno zapytanie o wszystko byłoby tańsze,
 * ale wtedy błąd parsowania jednego rodzaju kasuje całą pracę domową — tak
 * odpada tylko ta jedna sekcja, a lektor widzi, czego zabrakło.
 */

/**
 * Model, który układa zadania — pierwszy z ogólnej kaskady aplikacji.
 *
 * Praca domowa nie ma powodu chodzić po innych modelach niż reszta aplikacji:
 * kolejność i schodzenie niżej definiuje `services/aiModels.ts`.
 */
export const HOMEWORK_MODEL = PRIMARY_MODEL;

const MODELS_FOR_HOMEWORK = PREFERRED_AI_MODELS;

export interface HomeworkSource {
  /** Lekcje wybrane przez lektora. */
  lessons?: LessonRecord[];
  /** Materiał wklejony ręcznie. */
  pastedText?: string;
}

export interface HomeworkGenerationRequest {
  source: HomeworkSource;
  types: HomeworkType[];
  /** Ile zadań na każdy wybrany typ. */
  perType: number;
  level: string;
  /** Wskazówka lektora, np. „skup się na czasach przeszłych". */
  instruction?: string;
  /**
   * Kursant, dla którego układamy zadania. Podany — model dostaje jego profil
   * z krzywej uczenia (poziom wyliczony z wyników, ostatnie błędy) zamiast
   * samego poziomu z pola `level`.
   */
  studentId?: string;
}

export interface GeneratedSection {
  type: HomeworkType;
  items: any[];
  /** Wypełnione, gdy ten typ się nie wygenerował. */
  error?: string;
}

export interface HomeworkGenerationResult {
  sections: GeneratedSection[];
  modelUsed?: string;
  /** Materiał, na którym pracował model — do pokazania lektorowi. */
  sourceText: string;
}

/** Etykiety typów — jedno miejsce dla obu paneli. */
export const HOMEWORK_TYPE_LABELS: Record<
  HomeworkType,
  { pl: string; en: string; hint: { pl: string; en: string } }
> = {
  translation: {
    pl: 'Tłumaczenie zdań',
    en: 'Sentence translation',
    hint: { pl: 'Kursant tłumaczy z polskiego na angielski.', en: 'Student translates PL to EN.' },
  },
  word_order: {
    pl: 'Ułóż zdanie',
    en: 'Word order',
    hint: {
      pl: 'Rozsypane fragmenty do ułożenia. Bez klawiatury, samym dotykiem.',
      en: 'Scrambled chunks to arrange. Tap only, no keyboard.',
    },
  },
  multiple_choice: {
    pl: 'Wybierz formę',
    en: 'Multiple choice',
    hint: {
      pl: 'Jedna poprawna odpowiedź z kilku. Sprawdza się od razu.',
      en: 'One correct answer out of several. Checked instantly.',
    },
  },
  fill_in_the_blank: {
    pl: 'Uzupełnij luki',
    en: 'Fill in the blanks',
    hint: { pl: 'Spójny tekst z lukami do uzupełnienia.', en: 'A short text with gaps to fill.' },
  },
  find_errors: {
    pl: 'Znajdź błędy',
    en: 'Spot the mistakes',
    hint: { pl: 'Zdania z błędami do poprawienia.', en: 'Sentences with mistakes to correct.' },
  },
};

/** Typy oferowane w kreatorze — `find_errors` zostaje w danych, ale nie w UI. */
export const OFFERED_HOMEWORK_TYPES: HomeworkType[] = [
  'translation',
  'word_order',
  'multiple_choice',
  'fill_in_the_blank',
];

/**
 * Składa materiał źródłowy w jeden tekst.
 *
 * Z lekcji bierzemy zatwierdzone słownictwo, a nie cały wklej — to ten sam
 * materiał, który kursant widzi w panelu i który wchodzi do powtórek. Temat
 * i streszczenie idą jako kontekst, żeby zdania nie były oderwane od zajęć.
 */
export const buildSourceText = (source: HomeworkSource): string => {
  const parts: string[] = [];

  (source.lessons || []).forEach((lesson) => {
    const vocabulary = getApprovedVocabularyText({
      vocabularyText: lesson.vocabularyText,
      approvedItems: (lesson as any).approvedItems,
    });
    const lines = splitVocabularyLines(vocabulary);
    parts.push(
      [
        `LEKCJA (${lesson.date}): ${lesson.topic || ''}`.trim(),
        lesson.lessonSummary ? `Przerabialiśmy: ${lesson.lessonSummary}` : '',
        lesson.thingsToImprove ? `Do poprawy u kursanta: ${lesson.thingsToImprove}` : '',
        lines.length > 0 ? `Słownictwo:\n${lines.join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
  });

  if (source.pastedText && source.pastedText.trim()) {
    parts.push(`MATERIAŁ OD LEKTORA:\n${source.pastedText.trim()}`);
  }

  return parts.join('\n\n---\n\n').slice(0, 8000);
};

const SYSTEM_INSTRUCTION =
  'Jesteś doświadczonym lektorem języka angielskiego układającym pracę domową dla konkretnego kursanta. ' +
  'Pracujesz WYŁĄCZNIE na materiale podanym przez lektora — nie wprowadzasz słownictwa spoza niego. ' +
  'Odpowiadasz zawsze poprawnym JSON-em, bez komentarzy i bez bloków markdown.';

const askForJson = async (prompt: string): Promise<{ parsed: any; modelUsed: string }> => {
  const { text, modelUsed } = await generateTextWithUnifiedFallback(
    prompt,
    SYSTEM_INSTRUCTION,
    MODELS_FOR_HOMEWORK,
    { responseMimeType: 'application/json' },
    undefined,
    { taskName: 'Układanie pracy domowej', category: 'homework' }
  );
  return { parsed: JSON.parse(extractJSON(text)), modelUsed };
};

/**
 * Kontekst wspólny dla każdego typu zadania.
 *
 * Briefing z krzywej uczenia idzie przed materiałem, bo rozstrzyga o trudności
 * każdego układanego zdania — a materiał mówi tylko, z czego je zbudować.
 */
const baseContext = (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string
): string => `
${briefing || `[POZIOM KURSANTA]: ${req.level || 'B1'}`}
${req.instruction ? `[WYTYCZNE LEKTORA]: ${req.instruction}` : ''}

[MATERIAŁ Z LEKCJI — TYLKO NA NIM PRACUJESZ]:
${sourceText}
`;

/** Ułóż zdanie: fragmenty tasujemy u nas, żeby model nie „pomagał" kolejnością. */
const generateWordOrder = async (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string
): Promise<{ items: WordOrderExercise[]; modelUsed: string }> => {
  const prompt = `${baseContext(req, sourceText, briefing)}

ZADANIE:
Ułóż ${req.perType} angielskich zdań opartych na powyższym materiale. Każde zdanie
podziel na 4–8 sensownych fragmentów (pojedyncze słowa albo krótkie frazy, np. "have to",
"in the morning"). Fragmenty podaj W POPRAWNEJ KOLEJNOŚCI — przetasujemy je sami.
Do każdego zdania dołącz jego polskie znaczenie.

Zwróć JSON:
{"items":[{"chunks":["I","have to","meet the deadline"],"correctSentence":"I have to meet the deadline.","polishHint":"Muszę dotrzymać terminu."}]}`;

  const { parsed, modelUsed } = await askForJson(prompt);
  const raw = Array.isArray(parsed?.items) ? parsed.items : [];

  const items: WordOrderExercise[] = raw
    .filter((item: any) => Array.isArray(item?.chunks) && item.chunks.length >= 2)
    .map((item: any) => {
      const chunks: string[] = item.chunks.map((c: any) => String(c).trim()).filter(Boolean);
      const correct =
        String(item.correctSentence || chunks.join(' ')).trim() || chunks.join(' ');
      // Tasowanie po naszej stronie: model potrafi zwrócić „przetasowaną"
      // kolejność, która wciąż czyta się poprawnie, i zadanie robi się puste.
      const shuffled = [...chunks];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return {
        chunks: shuffled,
        correctSentence: correct,
        polishHint: item.polishHint ? String(item.polishHint) : undefined,
      };
    });

  return { items, modelUsed };
};

/** Wybór formy: pilnujemy, żeby poprawna odpowiedź naprawdę była wśród opcji. */
const generateMultipleChoice = async (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string
): Promise<{ items: MultipleChoiceExercise[]; modelUsed: string }> => {
  const prompt = `${baseContext(req, sourceText, briefing)}

ZADANIE:
Ułóż ${req.perType} pytań wielokrotnego wyboru sprawdzających słownictwo i gramatykę
z powyższego materiału. Każde pytanie to zdanie z luką oznaczoną "___".
Podaj 4 opcje: jedną poprawną i trzy błędne, ale prawdopodobne (typowe błędy Polaka).
Dodaj krótkie wyjaśnienie po polsku, dlaczego poprawna jest właśnie ta forma.

Zwróć JSON:
{"items":[{"question":"I ___ for the sales team.","options":["am responsible","responsible","am responsable","responsible for"],"correctIndex":0,"explanation":"..."}]}`;

  const { parsed, modelUsed } = await askForJson(prompt);
  const raw = Array.isArray(parsed?.items) ? parsed.items : [];

  const items: MultipleChoiceExercise[] = raw
    .filter(
      (item: any) =>
        item?.question &&
        Array.isArray(item.options) &&
        item.options.length >= 2 &&
        Number.isInteger(item.correctIndex) &&
        item.correctIndex >= 0 &&
        item.correctIndex < item.options.length
    )
    .map((item: any) => ({
      question: String(item.question).trim(),
      options: item.options.map((o: any) => String(o).trim()),
      correctIndex: item.correctIndex,
      explanation: item.explanation ? String(item.explanation) : undefined,
    }));

  return { items, modelUsed };
};

/** Tłumaczenia — istniejący generator, tylko z materiałem z tego kreatora. */
const generateTranslations = async (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string,
  level?: string
): Promise<{ items: TranslationExercise[]; modelUsed: string }> => {
  const words = splitVocabularyLines(sourceText).slice(0, 40);
  const result = await generateTranslationExercises(
    level || req.level || 'B1',
    words,
    req.instruction,
    sourceText,
    // Slot na profil kursanta istniał tu od początku i szedł pusty — teraz
    // wchodzi w niego briefing z krzywej uczenia.
    briefing,
    req.perType
  );
  const items = Array.isArray(result) ? result : [];
  return { items, modelUsed: items[0]?.modelUsed || HOMEWORK_MODEL };
};

/** Tekst z lukami — istniejący generator. */
const generateGaps = async (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string,
  level?: string
): Promise<{ items: any[]; modelUsed: string }> => {
  const result = await generateFillInTheBlankExercises(
    level || req.level || 'B1',
    sourceText.slice(0, 2000),
    req.perType,
    [req.instruction, briefing].filter(Boolean).join('\n\n')
  );
  return { items: result ? [result] : [], modelUsed: HOMEWORK_MODEL };
};

/**
 * Generuje wszystkie wybrane typy równolegle.
 *
 * `allSettled`, bo odrzucenie jednego typu nie może zabrać lektorowi reszty —
 * dostaje to, co się udało, i informację o tym, co nie.
 */
export const generateHomeworkSet = async (
  req: HomeworkGenerationRequest
): Promise<HomeworkGenerationResult> => {
  const sourceText = buildSourceText(req.source);
  if (!sourceText.trim()) {
    throw new Error('Brak materiału: wybierz lekcje albo wklej własny tekst.');
  }

  // Profil kursanta rozstrzyga o trudności. Bez `studentId` (np. przy pracy na
  // wklejonym tekście bez wybranego kursanta) zostaje sam poziom od lektora.
  const context = req.studentId
    ? await getStudentAiContext(req.studentId, req.level)
    : null;
  const briefing = context?.briefing;
  const level = context?.level || req.level;

  const runners: Record<string, () => Promise<{ items: any[]; modelUsed: string }>> = {
    translation: () => generateTranslations(req, sourceText, briefing, level),
    word_order: () => generateWordOrder(req, sourceText, briefing),
    multiple_choice: () => generateMultipleChoice(req, sourceText, briefing),
    fill_in_the_blank: () => generateGaps(req, sourceText, briefing, level),
  };

  const selected = req.types.filter((type) => runners[type]);
  const settled = await Promise.allSettled(selected.map((type) => runners[type]()));

  let modelUsed: string | undefined;
  const sections: GeneratedSection[] = selected.map((type, index) => {
    const outcome = settled[index];
    if (outcome.status === 'fulfilled') {
      modelUsed = modelUsed || outcome.value.modelUsed;
      return { type, items: outcome.value.items };
    }
    console.error(`Nie udało się ułożyć zadań typu ${type}:`, outcome.reason);
    return {
      type,
      items: [],
      error: outcome.reason?.message || 'Model nie zwrócił poprawnych zadań.',
    };
  });

  return { sections, modelUsed, sourceText };
};
