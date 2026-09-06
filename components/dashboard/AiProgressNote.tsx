import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Sparkles } from 'lucide-react';
import { db } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { PracticeLog, TranslationEvaluationResult } from '../../types';
import {
  AiProgressSummary,
  fetchAiProgressSummary,
  readCachedAiProgressSummary,
} from '../../services/aiProgressSummary';
import { buildMotivationLines } from '../../utils/motivationLines';

/**
 * Zdania podbudowujące pod paskiem postępu, pisane jak na maszynie.
 *
 * Model pisze jedną analizę pracy kursanta; tutaj rozkłada się ją na kilka
 * krótkich zdań i pokazuje po jednym naraz. Cały akapit nad panelem byłby
 * ścianą tekstu, której nikt nie czyta drugiego dnia — jedno zdanie, które
 * właśnie się pisze, czyta się mimowolnie i nie zabiera miejsca zadaniom.
 *
 * Zdania biorą się z konkretów o kursancie (mocne strony, komentarz, wskazówka),
 * a nie z puli ogólników w stylu „dasz radę" — pochwała bez pokrycia przestaje
 * cokolwiek znaczyć po trzecim wyświetleniu.
 */

interface AiProgressNoteProps {
  studentId: string;
}

/** Poniżej tylu sesji podsumowanie AI nie miałoby na czym się oprzeć. */
const MIN_LOGS_FOR_SUMMARY = 3;

const TYPING_MS = 26;
const DELETING_MS = 12;
const HOLD_MS = 3200;
/** Bez animacji zdanie stoi dłużej — nic nie sygnalizuje, że zaraz się zmieni. */
const STATIC_HOLD_MS = 7000;

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Maszyna do pisania po kolejnych zdaniach.
 *
 * Przy włączonym ograniczeniu ruchu zdania nadal się zmieniają, tylko pojawiają
 * się od razu w całości — animacja jest tu ozdobą, treść nie.
 */
const useTypewriter = (lines: string[]): { text: string; animated: boolean } => {
  const [text, setText] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const animated = useMemo(() => !prefersReducedMotion(), []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText('');
    setLineIndex(0);
    setIsDeleting(false);
  }, [lines.join('|')]);

  useEffect(() => {
    if (lines.length === 0) return;
    const current = lines[lineIndex % lines.length];

    if (!animated) {
      setText(current);
      if (lines.length === 1) return;
      timer.current = setTimeout(() => setLineIndex((i) => i + 1), STATIC_HOLD_MS);
      return () => {
        if (timer.current) clearTimeout(timer.current);
      };
    }

    let delay: number;
    let next: () => void;

    if (!isDeleting && text === current) {
      // Jedno zdanie nie ma dokąd rotować — zostaje na ekranie.
      if (lines.length === 1) return;
      delay = HOLD_MS;
      next = () => setIsDeleting(true);
    } else if (isDeleting && text === '') {
      delay = 220;
      next = () => {
        setIsDeleting(false);
        setLineIndex((i) => i + 1);
      };
    } else if (isDeleting) {
      delay = DELETING_MS;
      next = () => setText(current.slice(0, Math.max(0, text.length - 1)));
    } else {
      delay = TYPING_MS;
      next = () => setText(current.slice(0, text.length + 1));
    }

    timer.current = setTimeout(next, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, isDeleting, lineIndex, lines, animated]);

  return { text, animated };
};

const AiProgressNote: React.FC<AiProgressNoteProps> = ({ studentId }) => {
  const { language } = useLanguage();
  const [summary, setSummary] = useState<AiProgressSummary | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!studentId || studentId === 'demo-id') return;

      const cached = readCachedAiProgressSummary(studentId);
      if (cached) {
        if (active) setSummary(cached);
        return;
      }

      try {
        const snapshot = await getDocs(collection(db, `users/${studentId}/practiceLogs`));
        const logs = snapshot.docs
          .map((d) => d.data() as PracticeLog)
          .filter((l) => (l.exerciseType as string) !== 'Aktywność')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (logs.length < MIN_LOGS_FOR_SUMMARY) return;

        const logsSummary = logs
          .slice(0, 8)
          .map((log, i) => {
            let items: TranslationEvaluationResult[] = [];
            if (Array.isArray(log.exercisesData)) items = log.exercisesData;
            else if (typeof log.exercisesData === 'string') {
              try {
                items = JSON.parse(log.exercisesData);
              } catch {}
            } else if (Array.isArray(log.detailedFeedback)) {
              items = log.detailedFeedback;
            }
            const itemsSummary = items
              .map((item) => `- [${item.isCorrect ? 'OK' : 'BŁĄD'}] ${item.polishSentence}`)
              .join('\n');
            return `Sesja ${i + 1}: Wynik ${log.score || 0}%\n${itemsSummary}`;
          })
          .join('\n\n');

        const data = await fetchAiProgressSummary(
          studentId,
          { totalExercises: logs.length },
          logsSummary,
          language
        );
        if (active) setSummary(data);
      } catch (error) {
        console.error('Nie udało się przygotować podsumowania AI:', error);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [studentId, language]);

  const lines = useMemo(() => buildMotivationLines(summary), [summary]);
  const { text, animated } = useTypewriter(lines);

  if (lines.length === 0) return null;

  return (
    <div className="flex items-start gap-2 px-1 min-h-[2.5rem]">
      <Sparkles size={13} className="text-primary shrink-0 mt-1" />
      {/* Zmiana zdania w tle nie ma przerywać czytania tego, co użytkownik
          właśnie ma na ekranie — stąd `polite`, nie `assertive`. */}
      <p
        aria-live="polite"
        className="prose-justified text-[13px] text-content leading-relaxed"
      >
        {text}
        {animated && <span className="typewriter-caret text-primary">▍</span>}
      </p>
    </div>
  );
};

export default AiProgressNote;
