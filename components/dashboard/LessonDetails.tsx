import React, { useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, Loader2, Tag } from 'lucide-react';
import Markdown from 'react-markdown';
import { LessonRecord } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { getApprovedItemsForLesson } from '../../services/studentContext';
import { splitVocabularyLines } from '../../utils/vocabulary';
import { firstSentences } from '../../utils/summary';
import TTSButtons from '../flashcards/TTSButtons';

/**
 * Treść jednej lekcji widziana przez kursanta — jedno miejsce dla wszystkich
 * ekranów, żeby „ostatnia lekcja" i wpis w historii nie rozjechały się z czasem.
 *
 * Trzy rzeczy i ani jednej więcej: co przerabialiśmy, słownictwo, do poprawy.
 * „Twojego następnego kroku" tu nie ma świadomie — po lekcji następnym krokiem
 * kursanta jest praca domowa albo powtórki, a te mają własne miejsce na górze
 * panelu. Powtarzanie tego pod każdą lekcją robiło z panelu listę zaleceń.
 */

interface LessonDetailsProps {
  lesson: LessonRecord;
  /** Czyje słownictwo czytamy — konto kursanta, także w podglądzie lektora. */
  studentId: string;
  /** Zwarty wariant do wnętrza rozwijanej historii. */
  compact?: boolean;
  /** Fiszki ze słownictwa tej lekcji. */
  onStudySet?: (setId: string) => void;
  /** Zdania AI na słownictwie tej lekcji. */
  onPracticeAI?: (setId: string) => void;
}

/** Rozbicie linii słownictwa na hasło i tłumaczenie. */
const parseVocabLine = (line: string): { word: string; translation: string | null } => {
  const clean = line.replace(/^[\s*\-•\d.]+\s*/, '').trim();
  const sep = clean.match(/\s+[-–—:=]\s+/);
  if (sep && sep.index !== undefined) {
    return {
      word: clean.slice(0, sep.index).trim(),
      translation: clean.slice(sep.index + sep[0].length).trim(),
    };
  }
  return { word: clean, translation: null };
};

const LessonDetails: React.FC<LessonDetailsProps> = ({
  lesson,
  studentId,
  compact = false,
  onStudySet,
  onPracticeAI,
}) => {
  const { language } = useLanguage();
  const [vocabulary, setVocabulary] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFullSummary, setShowFullSummary] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const load = async () => {
      if (!studentId || studentId === 'demo-id') {
        if (active) {
          setVocabulary(splitVocabularyLines(lesson.vocabularyText));
          setIsLoading(false);
        }
        return;
      }
      try {
        // Pozycje zatwierdzone po lekcji, a gdy zestaw ich nie ma (wpisy sprzed
        // wprowadzenia zatwierdzania) — całe słownictwo z lekcji.
        const approved = await getApprovedItemsForLesson(studentId, lesson.vocabularySetId);
        if (!active) return;
        setVocabulary(approved ?? splitVocabularyLines(lesson.vocabularyText));
      } catch (error) {
        console.error('Nie udało się wczytać słownictwa lekcji:', error);
        if (active) setVocabulary(splitVocabularyLines(lesson.vocabularyText));
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [studentId, lesson.id, lesson.vocabularySetId, lesson.vocabularyText]);

  const L =
    language === 'pl'
      ? {
          summary: 'Co przerabialiśmy',
          vocabulary: 'Słownictwo',
          improve: 'Do poprawy',
          more: 'Pokaż całość',
          less: 'Zwiń',
          empty: 'Lektor nie dodał jeszcze notatek do tej lekcji.',
          count: (n: number) => `${n}`,
          flashcards: 'Fiszki',
          aiSentences: 'Zdania AI',
        }
      : {
          summary: 'What we covered',
          vocabulary: 'Vocabulary',
          improve: 'To work on',
          more: 'Show all',
          less: 'Collapse',
          empty: 'Your teacher has not added notes to this lesson yet.',
          count: (n: number) => `${n}`,
          flashcards: 'Flashcards',
          aiSentences: 'AI sentences',
        };

  const summary = firstSentences(lesson.lessonSummary, 3);
  const items = vocabulary.map(parseVocabLine).filter((item) => item.word.length > 0);
  const hasAnything =
    Boolean(lesson.lessonSummary) || items.length > 0 || Boolean(lesson.thingsToImprove);

  const headingClass =
    'text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-content-muted';

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {!hasAnything && !isLoading && <p className="text-sm text-content-muted">{L.empty}</p>}

      {lesson.lessonSummary && (
        <section className="space-y-2">
          <h4 className={headingClass}>{L.summary}</h4>
          <div className="prose-justified text-[15px] sm:text-sm text-content leading-relaxed">
            <Markdown>{showFullSummary ? lesson.lessonSummary : summary.short}</Markdown>
          </div>
          {summary.truncated && (
            <button
              onClick={() => setShowFullSummary((v) => !v)}
              className="inline-flex items-center gap-1 min-h-[2.75rem] -my-2 text-xs font-bold text-primary"
            >
              {showFullSummary ? L.less : L.more}
              <ChevronDown
                size={13}
                className={`transition-transform ${showFullSummary ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </section>
      )}

      {lesson.thingsToImprove && (
        <section className="rounded-xl bg-warn/[0.06] border border-warn/20 p-4 space-y-2">
          <h4 className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-warn">
            <AlertCircle size={12} />
            {L.improve}
          </h4>
          <div className="prose-justified text-[15px] sm:text-sm text-content leading-relaxed">
            <Markdown>{lesson.thingsToImprove}</Markdown>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h4 className={`${headingClass} flex items-center gap-1.5`}>
          <Tag size={12} className="text-primary" />
          {L.vocabulary}
          {items.length > 0 && (
            <span className="text-primary/80">· {L.count(items.length)}</span>
          )}
        </h4>

        {isLoading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-content-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </div>
        ) : (
          items.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {items.map((item, index) => (
                <li
                  key={`${index}-${item.word}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-base-100/50 border border-white/[0.07]"
                >
                  <div className="min-w-0">
                    <span className="block font-semibold text-white text-[15px] sm:text-sm leading-snug">
                      {item.word}
                    </span>
                    {item.translation && (
                      <span className="block text-xs text-content-muted leading-snug mt-0.5">
                        {item.translation}
                      </span>
                    )}
                  </div>
                  <TTSButtons text={item.word} />
                </li>
              ))}
            </ul>
          )
        )}
      </section>

      {/* Ćwiczenie tego samego materiału — jedyne wyjście z lekcji do pracy
          własnej, dlatego zostaje przy słownictwie, a nie w osobnej zakładce. */}
      {items.length > 0 && (onStudySet || onPracticeAI) && (
        <div className="flex flex-wrap gap-2">
          {onStudySet && (
            <button
              onClick={() => onStudySet(`lesson_${lesson.id}`)}
              className="flex-1 min-w-[8rem] min-h-[2.75rem] flex items-center justify-center gap-1.5 px-4 rounded-xl bg-primary/12 border border-primary/30 text-primary font-bold text-[13px] active:scale-[0.99] transition-transform"
            >
              🎴 {L.flashcards}
            </button>
          )}
          {onPracticeAI && (
            <button
              onClick={() => onPracticeAI(`lesson_${lesson.id}`)}
              className="flex-1 min-w-[8rem] min-h-[2.75rem] flex items-center justify-center gap-1.5 px-4 rounded-xl border border-white/15 text-content font-bold text-[13px] active:scale-[0.99] transition-transform"
            >
              ✨ {L.aiSentences}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonDetails;
