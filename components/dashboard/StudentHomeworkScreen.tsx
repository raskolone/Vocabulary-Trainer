import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Send,
  X as XIcon,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { HomeworkType, SpecialTask } from '../../types';
import { homeworkBlocks, homeworkItemType, studentTasksQuery } from '../../utils/homework';
import { evaluateTranslations } from '../../services/geminiService';
import { HOMEWORK_TYPE_LABELS } from '../../services/homeworkGenerator';
import { recordExerciseResults } from '../../services/learningProfile';
import { useDraftAnswers } from '../../hooks/useDraftAnswers';
import { normalizeLevel } from '../../utils/learningCurve';
import HomeworkExercise from './HomeworkExercise';

/**
 * Praca domowa kursanta.
 *
 * Lista pokazuje wyłącznie to, co jest do zrobienia, a oddane zadania schodzą
 * niżej — po wysłaniu pracy kursant nie ma już przy niej nic do roboty poza
 * przeczytaniem oceny.
 *
 * Rozwiązywanie idzie zadanie po zadaniu na pełnym ekranie. Lista wszystkich
 * zdań naraz działała na monitorze lektora, ale na telefonie znaczyła długie
 * przewijanie i gubienie miejsca po każdym podniesieniu klawiatury.
 *
 * Trzy z czterech typów sprawdzamy u siebie, bez modelu: kolejność fragmentów,
 * wybór opcji i uzupełnione luki mają jedną poprawną odpowiedź. Model ocenia
 * tylko tłumaczenia, gdzie poprawnych wersji jest wiele.
 */

interface StudentHomeworkScreenProps {
  /** Zadanie do otwarcia od razu — np. z banera w panelu. */
  initialTaskId?: string | null;
  /** Podgląd prac konkretnego kursanta (lektor). Domyślnie własne konto. */
  studentId?: string;
  onBack?: () => void;
}

interface EvaluationRow {
  polishSentence: string;
  correctTranslation: string;
  studentAnswer: string;
  isCorrect: boolean;
  score: number;
  explanation?: string;
}

const normalize = (text: string): string =>
  String(text || '')
    .toLowerCase()
    .replace(/[.,!?;:"„”]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Tekst odpowiedzi do zapisania — czytelny dla lektora, nie surowy stan UI. */
const answerToText = (type: HomeworkType, item: any, answer: any): string => {
  if (type === 'word_order') {
    const chosen: number[] = Array.isArray(answer) ? answer : [];
    return chosen.map((i) => item.chunks?.[i]).filter(Boolean).join(' ');
  }
  if (type === 'multiple_choice') {
    return typeof answer === 'number' ? item.options?.[answer] || '' : '';
  }
  if (type === 'fill_in_the_blank') {
    const blanks = answer && typeof answer === 'object' ? answer : {};
    return Object.keys(blanks)
      .sort()
      .map((key) => `${key}=${blanks[key]}`)
      .join(', ');
  }
  return String(answer || '');
};

const StudentHomeworkScreen: React.FC<StudentHomeworkScreenProps> = ({
  initialTaskId = null,
  studentId,
  onBack,
}) => {
  const { user, updateUserStreak } = useAuth();
  const { language } = useLanguage();
  const targetId = studentId || user?.id || '';
  // Lektor przegląda cudzą pracę domową wyłącznie po to, żeby zobaczyć, co
  // dostał kursant — rozwiązanie za niego nadpisałoby jego prawdziwą próbę,
  // a zapis i tak poszedłby na konto lektora (patrz handleSubmit).
  const isPreview = Boolean(studentId && studentId !== user?.id);

  const [tasks, setTasks] = useState<SpecialTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<SpecialTask | null>(null);
  const [index, setIndex] = useState(0);
  // Odpowiedzi przeżywają zamknięcie karty: zadanie robi się między innymi
  // sprawami, a przerwanie nie może kasować dziesięciu rozwiązanych zdań.
  const [answers, setAnswers, clearAnswers] = useDraftAnswers<Record<number, any>>(
    activeTask?.id ? `homework-draft-${activeTask.id}` : null,
    {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Komunikat pod przyciskiem wysyłki — zamiast okna, które trzeba odklikać. */
  const [notice, setNotice] = useState('');
  /** Kursant zobaczył ostrzeżenie o pustych zadaniach i może wysłać mimo to. */
  const [confirmedIncomplete, setConfirmedIncomplete] = useState(false);
  const [result, setResult] = useState<{ score: number; rows: EvaluationRow[] } | null>(null);
  const [openResultId, setOpenResultId] = useState<string | null>(null);
  // Rozwinięcie spisu bloków na liście. Praca domowa zostaje jedną pozycją,
  // a kursant może zajrzeć, z czego się składa, zanim ją otworzy.
  const [openBlocksId, setOpenBlocksId] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      studentTasksQuery(targetId),
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as SpecialTask))
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setTasks(list);
        setIsLoading(false);
      },
      (error) => {
        console.error('Nie udało się wczytać prac domowych:', error);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [targetId]);

  useEffect(() => {
    if (user?.hasNewHomework && user?.id) {
      updateDoc(doc(db, 'users', user.id), { hasNewHomework: false }).catch(console.error);
    }
  }, [user?.id, user?.hasNewHomework]);

  useEffect(() => {
    if (!initialTaskId || activeTask || isPreview) return;
    const found = tasks.find((t) => t.id === initialTaskId);
    if (found && (found.status === 'pending' || !found.status)) startTask(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTaskId, tasks, isPreview]);

  const L =
    language === 'pl'
      ? {
          title: 'Praca domowa',
          todo: 'Do zrobienia',
          done: 'Oddane',
          empty: 'Nic nie czeka. Lektor przypisze zadanie po następnej lekcji.',
          back: 'Wróć',
          due: (d: string) => `do ${d}`,
          items: (n: number) => `${n} zadań`,
          submit: 'Wyślij do lektora',
          next: 'Dalej',
          prev: 'Wstecz',
          submitting: 'Wysyłam…',
          resultTitle: 'Praca wysłana',
          resultBody: (s: number) => `Wynik wstępny: ${s}%`,
          backToList: 'Wróć do listy',
          correct: 'Dobrze',
          wrong: 'Do poprawy',
          yourAnswer: 'Twoja odpowiedź',
          expected: 'Poprawnie',
          statusSubmitted: 'Czeka na ocenę',
          statusGraded: 'Ocenione',
          teacherFeedback: 'Komentarz lektora',
          unanswered: (n: number) =>
            `Nie odpowiedziałeś na ${n} zadań. Dotknij jeszcze raz, żeby wysłać mimo to.`,
          sendFailed: 'Nie udało się wysłać pracy. Twoje odpowiedzi są zapisane — spróbuj ponownie.',
          sendAnyway: 'Wyślij mimo to',
          blockCount: (n: number) => `${n} rodzaje zadań`,
          showBlocks: 'Z czego się składa',
          hideBlocks: 'Zwiń',
          blockLabel: (label: string, at: number, of: number) => `${label} · ${at}/${of}`,
        }
      : {
          title: 'Homework',
          todo: 'To do',
          done: 'Submitted',
          empty: 'Nothing waiting. Your teacher will assign work after the next lesson.',
          back: 'Back',
          due: (d: string) => `by ${d}`,
          items: (n: number) => `${n} tasks`,
          submit: 'Send to teacher',
          next: 'Next',
          prev: 'Back',
          submitting: 'Sending…',
          resultTitle: 'Homework sent',
          resultBody: (s: number) => `Provisional score: ${s}%`,
          backToList: 'Back to list',
          correct: 'Correct',
          wrong: 'To fix',
          yourAnswer: 'Your answer',
          expected: 'Correct answer',
          statusSubmitted: 'Awaiting review',
          statusGraded: 'Graded',
          teacherFeedback: 'Teacher feedback',
          unanswered: (n: number) => `${n} tasks are unanswered. Tap again to send anyway.`,
          sendFailed: 'Could not send your work. Your answers are saved — try again.',
          sendAnyway: 'Send anyway',
          blockCount: (n: number) => `${n} exercise types`,
          showBlocks: "What's inside",
          hideBlocks: 'Collapse',
          blockLabel: (label: string, at: number, of: number) => `${label} · ${at}/${of}`,
        };

  /** Nazwa rodzaju zadania w języku interfejsu. */
  const typeLabel = (type: HomeworkType): string =>
    HOMEWORK_TYPE_LABELS[type]?.[language === 'pl' ? 'pl' : 'en'] || type;

  /** Podział pracy domowej na bloki — liczony raz na zadanie. */
  const blocksCache = useMemo(() => new Map<string, ReturnType<typeof homeworkBlocks>>(), [tasks]);
  const blocksOf = (task: SpecialTask) => {
    const key = task.id || '';
    const cached = blocksCache.get(key);
    if (cached) return cached;
    const blocks = homeworkBlocks(task);
    blocksCache.set(key, blocks);
    return blocks;
  };

  const pending = useMemo(
    () => tasks.filter((t) => t.status === 'pending' || !t.status),
    [tasks]
  );
  const finished = useMemo(
    () => tasks.filter((t) => t.status && t.status !== 'pending'),
    [tasks]
  );

  const startTask = (task: SpecialTask) => {
    setActiveTask(task);
    setIndex(0);
    // Odpowiedzi wczyta hook szkicu, gdy zmieni się klucz zadania — czyszczenie
    // ich tutaj kasowałoby właśnie odzyskaną, niedokończoną pracę.
    setResult(null);
    setNotice('');
    setConfirmedIncomplete(false);
  };

  const closeTask = () => {
    setActiveTask(null);
    setResult(null);
  };

  /** Ocena bez modelu — dla typów o jednej poprawnej odpowiedzi. */
  const gradeDeterministic = (type: HomeworkType, item: any, answer: any): EvaluationRow => {
    const studentAnswer = answerToText(type, item, answer);

    if (type === 'word_order') {
      const isCorrect = normalize(studentAnswer) === normalize(item.correctSentence);
      return {
        polishSentence: item.polishHint || item.correctSentence,
        correctTranslation: item.correctSentence,
        studentAnswer,
        isCorrect,
        score: isCorrect ? 100 : 0,
      };
    }

    if (type === 'multiple_choice') {
      const isCorrect = answer === item.correctIndex;
      return {
        polishSentence: item.question,
        correctTranslation: item.options?.[item.correctIndex] || '',
        studentAnswer,
        isCorrect,
        score: isCorrect ? 100 : 0,
        explanation: item.explanation,
      };
    }

    // Luki: liczy się udział trafionych, bo jedno zadanie to kilka odpowiedzi.
    const expected: Record<string, string> = item.blanks || {};
    const given = answer && typeof answer === 'object' ? answer : {};
    const keys = Object.keys(expected);
    const hits = keys.filter((key) => normalize(given[key]) === normalize(expected[key])).length;
    const score = keys.length > 0 ? Math.round((hits / keys.length) * 100) : 0;
    return {
      polishSentence: item.textWithBlanks || '',
      correctTranslation: keys.map((k) => `${k}=${expected[k]}`).join(', '),
      studentAnswer,
      isCorrect: score === 100,
      score,
    };
  };

  const handleSubmit = async () => {
    if (!activeTask?.id || !user?.id) return;
    const items = activeTask.sentences || [];
    const typeOf = (item: any): HomeworkType => homeworkItemType(item, activeTask);
    // Rodzaj do zapisu w dzienniku ćwiczeń: przy pracy mieszanej jedna etykieta
    // musi objąć całość, bo wpis dotyczy całej pracy domowej.
    const typesUsed = Array.from(new Set(items.map(typeOf)));
    const logFormat = typesUsed.length === 1 ? typesUsed[0] : 'mixed';

    const answered = items.filter((_, i) => {
      const a = answers[i];
      if (Array.isArray(a)) return a.length > 0;
      if (a && typeof a === 'object') return Object.keys(a).length > 0;
      if (typeof a === 'number') return true;
      return String(a || '').trim().length > 0;
    }).length;

    // Zamiast okna systemowego: ostrzeżenie pod przyciskiem, a przycisk zmienia
    // się w „wyślij mimo to". Kursant zostaje w zadaniu i widzi, czego brakuje,
    // zamiast odklikiwać dialog, który zasłania treść.
    if (answered < items.length && !confirmedIncomplete) {
      setNotice(L.unanswered(items.length - answered));
      setConfirmedIncomplete(true);
      return;
    }

    setNotice('');
    setIsSubmitting(true);
    try {
      // Tłumaczenia ocenia model, pozostałe rodzaje liczą się lokalnie. Przy
      // pracy mieszanej wszystkie tłumaczenia idą jednym zapytaniem — pytanie
      // po jednym zdaniu kosztowałoby tyle, co ułożenie pracy od nowa.
      const translationAt = items
        .map((item: any, i: number) => (typeOf(item) === 'translation' ? i : -1))
        .filter((i: number) => i >= 0);

      let evaluated: any[] = [];
      if (translationAt.length > 0) {
        const exercises = translationAt.map((i: number) => ({
          polishSentence: items[i].polishSentence,
          englishTranslation: items[i].englishTranslation,
          hint: items[i].hint,
        }));
        const given = translationAt.map((i: number) => String(answers[i] || ''));
        try {
          evaluated = await evaluateTranslations(exercises, given, user.level || 'B1', '');
        } catch (error) {
          console.error('Ocena tłumaczeń nie powiodła się:', error);
        }
      }

      const rows: EvaluationRow[] = items.map((item: any, i: number) => {
        const itemType = typeOf(item);
        if (itemType !== 'translation') {
          return gradeDeterministic(itemType, item, answers[i]);
        }
        // Odpowiedzi modelu wracają w kolejności wysłanych tłumaczeń, a nie
        // w kolejności ćwiczeń — stąd przeliczenie pozycji.
        const ev = evaluated?.[translationAt.indexOf(i)];
        const answer = String(answers[i] || '');
        const score = Number(ev?.score);
        return {
          polishSentence: item.polishSentence,
          correctTranslation: item.englishTranslation,
          studentAnswer: answer,
          isCorrect: ev?.isCorrect ?? false,
          // Brak oceny modelu nie może zerować pracy kursanta — wtedy liczy
          // się samo oddanie odpowiedzi, a lektor ocenia ręcznie.
          score: isNaN(score) ? (answer.trim() ? 70 : 0) : score,
          explanation: ev?.explanation,
        };
      });

      const average =
        rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length) : 0;

      const storedAnswers: Record<number, any> = {};
      items.forEach((item: any, i: number) => {
        const itemType = typeOf(item);
        storedAnswers[i] =
          itemType === 'fill_in_the_blank'
            ? answers[i] || {}
            : answerToText(itemType, item, answers[i]);
      });

      await updateDoc(doc(db, 'specialTasks', activeTask.id), {
        status: 'submitted',
        studentAnswers: storedAnswers,
        evaluationResults: rows,
        submittedAt: new Date().toISOString(),
      });

      try {
        await addDoc(collection(db, `users/${user.id}/practiceLogs`), {
          exerciseType: 'homework',
          exerciseFormat: logFormat,
          date: new Date().toISOString(),
          isRevisionMode: false,
          score: average,
          totalWords: items.length,
          setDisplayName: activeTask.title || 'Praca domowa',
          exercisesData: rows,
        });
      } catch (error) {
        console.warn('Nie udało się zapisać sesji z pracy domowej:', error);
      }

      // Każda odpowiedź — trafiona i chybiona — wchodzi do krzywej uczenia.
      // To z niej bierze się poziom kolejnych zadań i lista braków w promptcie.
      recordExerciseResults(
        user.id,
        rows.map((row, i) => ({
          prompt: row.polishSentence,
          expected: row.correctTranslation,
          given: row.studentAnswer,
          isCorrect: row.isCorrect,
          score: row.score,
          level: normalizeLevel(user.level),
          exerciseType: typeOf(items[i]),
          date: new Date().toISOString(),
        })),
        user.level
      ).catch(console.error);

      if (updateUserStreak) updateUserStreak().catch(console.error);

      // Praca jest u lektora — szkic nie ma już czego chronić. Czyścimy dopiero
      // tutaj, po udanym zapisie: przy błędzie odpowiedzi mają zostać.
      clearAnswers();

      setResult({ score: average, rows });
    } catch (error: any) {
      console.error('Nie udało się wysłać pracy domowej:', error);
      // Odpowiedzi zostają w szkicu, więc ponowna próba nie kosztuje pracy.
      setNotice(L.sendFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ————— Wynik po wysłaniu —————
  if (activeTask && result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <header className="text-center py-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-extrabold text-white">{L.resultTitle}</h1>
          <p className="text-sm text-content-muted mt-1">{L.resultBody(result.score)}</p>
        </header>

        <ul className="space-y-2">
          {result.rows.map((row, i) => (
            <li
              key={i}
              className={`rounded-xl border p-3 space-y-1.5 ${
                row.isCorrect ? 'border-primary/25 bg-primary/[0.06]' : 'border-warn/25 bg-warn/[0.06]'
              }`}
            >
              <div className="flex items-center gap-2">
                {row.isCorrect ? (
                  <Check size={14} className="text-primary shrink-0" />
                ) : (
                  <XIcon size={14} className="text-warn shrink-0" />
                )}
                <span className="prose-justified text-[14px] font-semibold text-white leading-snug">
                  {row.polishSentence}
                </span>
              </div>
              <p className="text-[13px] text-content">
                <span className="text-content-muted">{L.yourAnswer}: </span>
                {row.studentAnswer || '—'}
              </p>
              {!row.isCorrect && (
                <p className="text-[13px] text-primary/90 font-mono">
                  <span className="text-content-muted font-sans">{L.expected}: </span>
                  {row.correctTranslation}
                </p>
              )}
              {row.explanation && (
                <p className="prose-justified text-[13px] text-warn leading-relaxed">
                  {row.explanation}
                </p>
              )}
            </li>
          ))}
        </ul>

        <button
          onClick={closeTask}
          className="w-full min-h-[3.25rem] rounded-xl bg-primary text-accent-ink font-bold"
        >
          {L.backToList}
        </button>
      </div>
    );
  }

  // ————— Rozwiązywanie —————
  if (activeTask) {
    const items = activeTask.sentences || [];
    // Jedna praca domowa miesza rodzaje ćwiczeń, więc rodzaj rozstrzyga
    // element, a nie dokument (patrz utils/homework.ts).
    const type = homeworkItemType(items[index], activeTask);
    const isLast = index >= items.length - 1;
    const blocks = blocksOf(activeTask);
    const block = blocks.find((b) => index >= b.from && index < b.from + b.count);

    return (
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={closeTask}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-white/12 text-content-muted"
            aria-label={L.back}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((index + 1) / Math.max(items.length, 1)) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs text-content-muted shrink-0">
            {index + 1}/{items.length}
          </span>
        </div>

        {/* Etykieta bloku: przy pracy z kilku rodzajów kursant widzi, w którym
            jest i ile w nim zostało — bez tego mieszane zadania czytają się
            jak jeden nieprzewidywalny ciąg. */}
        {block && blocks.length > 1 && (
          <p className="px-1 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
            {L.blockLabel(typeLabel(block.type), index - block.from + 1, block.count)}
          </p>
        )}

        <div className="rounded-2xl border border-white/10 bg-base-200/50 p-4 sm:p-6">
          <HomeworkExercise
            type={type}
            item={items[index]}
            answer={answers[index]}
            onChange={(value) => setAnswers((prev) => ({ ...prev, [index]: value }))}
          />
        </div>

        {/* Ostrzeżenia i błędy stoją przy przycisku, którego dotyczą — kursant
            czyta je bez zasłaniania zadania i bez odklikiwania okna. */}
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-warn/30 bg-warn/[0.08] p-3 text-[13px] text-warn leading-relaxed"
          >
            {notice}
          </p>
        )}

        <div className="flex gap-2">
          {index > 0 && (
            <button
              onClick={() => setIndex((i) => i - 1)}
              className="min-h-[3.25rem] px-5 rounded-xl border border-white/15 text-content font-bold text-sm"
            >
              {L.prev}
            </button>
          )}
          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`flex-1 min-h-[3.25rem] flex items-center justify-center gap-2 rounded-xl font-bold disabled:opacity-50 ${
                confirmedIncomplete
                  ? 'bg-warn text-accent-ink'
                  : 'bg-primary text-accent-ink'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {L.submitting}
                </>
              ) : (
                <>
                  <Send size={16} /> {confirmedIncomplete ? L.sendAnyway : L.submit}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setIndex((i) => i + 1)}
              className="flex-1 min-h-[3.25rem] flex items-center justify-center gap-2 rounded-xl bg-primary text-accent-ink font-bold"
            >
              {L.next} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ————— Lista —————
  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
      <header className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-white/12 text-content-muted"
            aria-label={L.back}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="text-xl font-extrabold text-white">{L.title}</h1>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10 text-content-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-base-200/40 p-6 text-center text-sm text-content-muted">
          {L.empty}
        </p>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
                {L.todo}
              </h2>
              <ul className="space-y-2">
                {pending.map((task) => (
                  <li key={task.id}>
                    <button
                      onClick={() => !isPreview && startTask(task)}
                      disabled={isPreview}
                      className={`neon-still w-full min-h-[4rem] flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] to-base-200/50 text-left transition-transform ${isPreview ? 'opacity-70 cursor-default' : 'active:scale-[0.99]'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block font-bold text-white text-[15px] leading-snug truncate">
                          {task.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-content-muted mt-0.5">
                          <span>
                            {blocksOf(task).length > 1
                              ? L.blockCount(blocksOf(task).length)
                              : typeLabel(blocksOf(task)[0]?.type || 'translation')}
                          </span>
                          <span>· {L.items(task.sentences?.length || 0)}</span>
                          {task.dueDate && (
                            <span className="inline-flex items-center gap-1 text-warn">
                              <Clock size={11} />
                              {L.due(task.dueDate)}
                            </span>
                          )}
                        </span>
                      </div>
                      {!isPreview && <ChevronRight className="w-5 h-5 text-primary shrink-0" />}
                    </button>

                    {/* Spis bloków pod pozycją — jedno dotknięcie, żeby zobaczyć
                        skład pracy domowej bez jej otwierania. */}
                    {blocksOf(task).length > 1 && (
                      <>
                        <button
                          onClick={() => setOpenBlocksId((id) => (id === task.id ? null : task.id || null))}
                          aria-expanded={openBlocksId === task.id}
                          className="mt-1 ml-1 inline-flex items-center gap-1.5 min-h-[2.25rem] px-2 text-[12px] font-bold text-content-muted"
                        >
                          <ChevronDown
                            size={13}
                            className={`transition-transform ${openBlocksId === task.id ? 'rotate-180' : ''}`}
                          />
                          {openBlocksId === task.id ? L.hideBlocks : L.showBlocks}
                        </button>
                        {openBlocksId === task.id && (
                          <ul className="mt-1 ml-1 space-y-1">
                            {blocksOf(task).map((block, i) => (
                              <li
                                key={`${block.type}-${block.from}`}
                                className="flex items-center gap-2 text-[12px] text-content-muted"
                              >
                                <span className="w-5 h-5 shrink-0 rounded-md bg-primary/10 border border-primary/25 text-primary font-mono text-[10px] flex items-center justify-center">
                                  {i + 1}
                                </span>
                                <span className="text-content">{typeLabel(block.type)}</span>
                                <span>· {L.items(block.count)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {finished.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-content-muted">
                {L.done}
              </h2>
              <ul className="rounded-2xl border border-white/10 bg-base-200/40 divide-y divide-white/[0.06] overflow-hidden">
                {finished.map((task) => {
                  const isOpen = openResultId === task.id;
                  const graded = task.status === 'graded';
                  return (
                    <li key={task.id}>
                      <button
                        onClick={() => setOpenResultId(isOpen ? null : task.id || null)}
                        className="w-full min-h-[3.5rem] flex items-center gap-3 px-4 py-3 text-left active:bg-white/[0.04]"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold text-content leading-snug truncate">
                            {task.title}
                          </span>
                          <span className="text-[12px] text-content-muted">
                            {graded ? L.statusGraded : L.statusSubmitted}
                          </span>
                        </div>
                        {graded && task.grade !== undefined && (
                          <span className="flex items-center gap-1 font-mono text-[13px] font-bold text-primary shrink-0">
                            <Award size={13} />
                            {task.grade}%
                          </span>
                        )}
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 space-y-2">
                          {task.teacherFeedback && (
                            <p className="prose-justified rounded-xl bg-primary/[0.07] border border-primary/20 p-3 text-[13px] text-content leading-relaxed">
                              <span className="block text-[11px] font-mono uppercase tracking-wider text-primary mb-1">
                                {L.teacherFeedback}
                              </span>
                              {task.teacherFeedback}
                            </p>
                          )}
                          {(task.evaluationResults || []).map((row: any, i: number) => (
                            <div
                              key={i}
                              className="rounded-xl bg-base-100/50 border border-white/[0.07] p-3 space-y-1"
                            >
                              <p className="prose-justified text-[13px] text-white font-semibold leading-snug">
                                {row.polishSentence}
                              </p>
                              <p className="text-[13px] text-content">
                                <span className="text-content-muted">{L.yourAnswer}: </span>
                                {row.studentAnswer || '—'}
                              </p>
                              {!row.isCorrect && row.correctTranslation && (
                                <p className="text-[13px] text-primary/90 font-mono">
                                  {row.correctTranslation}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default StudentHomeworkScreen;
