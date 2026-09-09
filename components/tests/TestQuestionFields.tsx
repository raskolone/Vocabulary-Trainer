import React, { useMemo, useState } from 'react';
import { TestQuestion } from '../../types';
import { MatchingTask } from './MatchingTask';
import { WordBankFillInBlankTask } from './WordBankFillInBlankTask';
import {
  formatSubAnswers,
  normalizePromptLines,
  parseNumberedItems,
  parseSubAnswers,
} from '../../utils/testFormatters';

/**
 * Jedno pytanie testu wraz z polem odpowiedzi — wspólne dla obu ekranów.
 *
 * Test rozwiązuje się w dwóch miejscach: kursant z bazy w `TakeTestScreen`,
 * kandydat z linku w `PublicTestScreen`. Obsługa siedmiu typów zadań (rozsypka,
 * łączenie w pary, luki, writing…) żyła wewnątrz pierwszego z nich, więc drugi
 * musiałby ją przepisać — a wtedy każda poprawka w zachowaniu pola trafiałaby
 * do jednego ekranu i omijała drugi.
 *
 * Komponent nie ocenia i nie zapisuje: trzyma odpowiedź i oddaje ją wyżej.
 */

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Wielokrotny wybór',
  find_mistake: 'Korekta błędów w zdaniach',
  fill_in_blank_bank: 'Luki z banku słów (rozsypka)',
  fill_in_blank: 'Luki',
  matching: 'Łączenie w pary',
  writing: 'Writing',
  translation: 'Tłumaczenie',
};

export const extractSentenceHint = (
  rawText: string,
  fallbackHint?: string
): { cleanSentence: string; hint?: string } => {
  if (!rawText) return { cleanSentence: '' };

  // Match (wskazówka: ...), (hint: ...), (uwaga: ...), or (błąd: ...) at the end of the text
  const explicitMatch = rawText.match(
    /\s*[\(\[]\s*(?:wskazówka|wskazowka|hint|uwaga|błąd|blad)\s*:?\s*([^\)\]]+)[\)\]]\s*$/i
  );
  if (explicitMatch) {
    const cleanSentence = rawText.slice(0, explicitMatch.index).trim();
    if (cleanSentence) {
      return { cleanSentence, hint: explicitMatch[1].trim() };
    }
  }

  // Match parenthesized text at the very end e.g. (past simple), (3rd person singular)
  const generalMatch = rawText.match(/\s*[\(\[]([^\)\]]+)[\)\]]\s*$/);
  if (generalMatch) {
    const inside = generalMatch[1].trim();
    if (
      /hint|wskazówk|wskazowk|past|present|future|perfect|continuous|czas|verb|tense|preposition|przyimek|osob|singular|plural|błąd|blad|szyk|inversion|passive|modal/i.test(
        inside
      )
    ) {
      const cleanSentence = rawText.slice(0, generalMatch.index).trim();
      if (cleanSentence) {
        return {
          cleanSentence,
          hint: inside
            .replace(/^(?:wskazówka|wskazowka|hint|uwaga|błąd|blad)\s*:?\s*/i, '')
            .trim(),
        };
      }
    }
  }

  return { cleanSentence: rawText.trim(), hint: fallbackHint };
};

/**
 * Lista ponumerowanych zdań z osobnym polem na każde.
 *
 * Wklejanie jest zablokowane celowo — to zadanie sprawdza, co kursant umie
 * napisać sam, a nie co potrafi skopiować z translatora w drugiej karcie.
 */
export const SentenceListTask: React.FC<{
  type: 'translation' | 'fill_in_blank' | 'find_mistake';
  prompt: string;
  questionHint?: string;
  initialAnswer?: string;
  onChange: (ans: string) => void;
}> = ({ type, prompt, questionHint, initialAnswer, onChange }) => {
  const sentences = useMemo(() => parseNumberedItems(prompt), [prompt]);
  const [subAnswers, setSubAnswers] = useState<Record<number, string>>(() =>
    parseSubAnswers(initialAnswer || '', sentences.length)
  );

  React.useEffect(() => {
    if (initialAnswer !== undefined) {
      setSubAnswers(parseSubAnswers(initialAnswer, sentences.length));
    }
  }, [initialAnswer, sentences.length]);

  const handleTextChange = (index: number, val: string) => {
    const updated = { ...subAnswers, [index]: val };
    setSubAnswers(updated);
    onChange(formatSubAnswers(updated, sentences.length));
  };

  const isFindMistake = type === 'find_mistake';

  return (
    <div className="space-y-5">
      {sentences.map((s, idx) => {
        const { cleanSentence, hint } = extractSentenceHint(s.text, questionHint);

        return (
          <div
            key={idx}
            className={`p-5 md:p-6 rounded-2xl border space-y-3.5 shadow-md transition-all ${
              isFindMistake
                ? 'bg-amber-950/15 border-amber-500/25'
                : 'bg-base-200/60 border-white/10'
            }`}
          >
            {isFindMistake && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span>⚠️</span> Zdanie z błędem {s.num}:
                </span>
                <button
                  type="button"
                  onClick={() => handleTextChange(idx, cleanSentence)}
                  className="text-[11px] text-primary hover:underline font-bold cursor-pointer"
                  title="Wstaw czyste zdanie do pola edycji, aby szybko poprawić felerny fragment"
                >
                  Kopiuj do edycji
                </button>
              </div>
            )}

            <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-2.5">
              <div className="flex items-start gap-3.5">
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-extrabold text-sm shrink-0 mt-0.5 ${
                    isFindMistake
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-primary/20 text-primary'
                  }`}
                >
                  {s.num}
                </span>
                <p className="text-base md:text-lg font-semibold text-white leading-relaxed pt-0.5">
                  {cleanSentence}
                </p>
              </div>

              {hint && (
                <div className="flex items-center gap-2 text-xs text-amber-300/95 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-lg ml-10">
                  <span className="font-bold shrink-0">💡 Wskazówka:</span>
                  <span>{hint}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-2 px-1">
                {type === 'translation'
                  ? `Twoje tłumaczenie zdania ${s.num}:`
                  : isFindMistake
                  ? `Twoja poprawiona wersja zdania ${s.num}:`
                  : `Twoja odpowiedź dla zdania ${s.num}:`}
              </label>
              <input
                type="text"
                value={subAnswers[idx] || ''}
                onChange={(e) => handleTextChange(idx, e.target.value)}
                onPaste={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && ['v', 'V'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                placeholder={
                  type === 'translation'
                    ? `Wpisz tłumaczenie zdania ${s.num}...`
                    : isFindMistake
                    ? `Wpisz całe poprawione zdanie ${s.num}...`
                    : `Wpisz odpowiedź dla zdania ${s.num}...`
                }
                className="w-full bg-black/60 border border-white/15 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl p-3.5 text-base text-white outline-none transition-all placeholder:text-content-muted/40 font-medium cursor-text"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface TestQuestionFieldsProps {
  question: TestQuestion;
  answer?: string;
  onChange: (answer: string) => void;
}

/** Nagłówek pytania: typ, polecenie, treść i wskazówka. */
export const TestQuestionHeader: React.FC<{ question: TestQuestion }> = ({ question: q }) => {
  const showPrompt =
    q.type !== 'translation' &&
    q.type !== 'fill_in_blank' &&
    q.type !== 'fill_in_blank_bank' &&
    q.type !== 'find_mistake';

  // Treść pytania pochodzi od modelu i bywa niekompletna — brak `prompt` albo
  // `instruction` nie może wywalić całego testu, który kursant już otworzył.
  const prompt = String(q.prompt || '');
  const instruction = String(q.instruction || '');

  // Polecenie powtórzone w treści pytania czyta się jak usterka, więc pokazujemy
  // je tylko wtedy, gdy naprawdę wnosi coś ponad sam prompt.
  const showInstruction =
    instruction.trim().length > 0 &&
    instruction.trim().toLowerCase() !== prompt.trim().toLowerCase() &&
    !prompt.trim().toLowerCase().startsWith(instruction.trim().toLowerCase());

  return (
    <div>
      <div className="text-sm font-bold text-content-muted mb-2 uppercase tracking-wider">
        {QUESTION_TYPE_LABELS[q.type] || QUESTION_TYPE_LABELS.translation}
      </div>
      {showInstruction && <div className="font-bold text-primary text-lg mb-2">{instruction}</div>}
      {showPrompt && (
        <div className="font-medium text-xl leading-relaxed whitespace-pre-wrap">
          {normalizePromptLines(prompt)}
        </div>
      )}
      {q.hint && q.type !== 'find_mistake' && q.type !== 'translation' && (
        <div className="mt-3 text-sm text-content-muted/80 italic flex items-center gap-2">
          <span>💡</span> Wskazówka: {q.hint}
        </div>
      )}
    </div>
  );
};

/** Samo pole odpowiedzi, dobrane do typu zadania. */
const TestQuestionFields: React.FC<TestQuestionFieldsProps> = ({ question: q, answer, onChange }) => {
  if (q.type === 'multiple_choice' && q.options) {
    return (
      <div className="space-y-3">
        {q.options.map((opt, oIdx) => (
          <label
            key={oIdx}
            className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
              answer === opt
                ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)] text-primary'
                : 'bg-black/30 backdrop-blur-sm border-white/10 hover:border-primary/50'
            }`}
          >
            <input
              type="radio"
              name={`q_${q.id}`}
              value={opt}
              checked={answer === opt}
              onChange={() => onChange(opt)}
              className="accent-primary w-5 h-5"
            />
            <span className="font-medium text-base">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  if (q.type === 'fill_in_blank_bank') {
    return (
      <WordBankFillInBlankTask
        prompt={String(q.prompt || '')}
        correctAnswer={q.correctAnswer}
        wordBank={q.wordBank}
        options={q.options}
        onChange={onChange}
        initialAnswer={answer}
      />
    );
  }

  if (q.type === 'fill_in_blank' || q.type === 'translation' || q.type === 'find_mistake') {
    return (
      <SentenceListTask
        type={q.type}
        prompt={String(q.prompt || '')}
        questionHint={q.hint}
        initialAnswer={answer}
        onChange={onChange}
      />
    );
  }

  if (q.type === 'matching' && q.options) {
    return <MatchingTask options={q.options} onChange={onChange} initialAnswer={answer} />;
  }

  if (q.type === 'writing') {
    return (
      <textarea
        value={answer || ''}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        placeholder="Zacznij pisać tutaj..."
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        className="w-full bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-lg text-white outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all min-h-[200px] resize-y cursor-text font-medium"
      />
    );
  }

  return null;
};

export default TestQuestionFields;
