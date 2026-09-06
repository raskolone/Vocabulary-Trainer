import React, { useState } from 'react';
import { HelpCircle, RotateCcw } from 'lucide-react';
import { HomeworkType } from '../../types';

/**
 * Jedno ćwiczenie pracy domowej, w czterech odmianach.
 *
 * Trzy z czterech rozwiązuje się samym dotykiem — klawiatura wchodzi tylko przy
 * tłumaczeniu, gdzie nie da się inaczej. To nie jest ozdoba: kursant robi zadanie
 * w tramwaju albo w kolejce, a każde pole tekstowe na telefonie to podniesiona
 * klawiatura, przewijanie i połowa ekranu mniej.
 *
 * Komponent nie ocenia i nie zapisuje — trzyma tylko odpowiedź i oddaje ją wyżej.
 */

export interface HomeworkExerciseProps {
  type: HomeworkType;
  item: any;
  answer: any;
  onChange: (answer: any) => void;
}

const chipBase =
  'min-h-[2.75rem] px-3.5 rounded-xl border text-[15px] font-semibold transition-colors active:scale-[0.97]';

const HomeworkExercise: React.FC<HomeworkExerciseProps> = ({ type, item, answer, onChange }) => {
  const [showHint, setShowHint] = useState(false);

  if (type === 'translation') {
    return (
      <div className="space-y-3">
        <p className="prose-justified text-lg font-bold text-white leading-snug">
          {item.polishSentence}
        </p>

        {item.hint && (
          <div>
            <button
              onClick={() => setShowHint((v) => !v)}
              className="inline-flex items-center gap-1.5 min-h-[2.5rem] text-xs font-bold text-warn"
            >
              <HelpCircle size={14} />
              {showHint ? 'Ukryj wskazówkę' : 'Wskazówka'}
            </button>
            {showHint && (
              <p className="prose-justified text-[13px] text-warn bg-warn/10 border border-warn/20 rounded-xl p-3 mt-1">
                {item.hint}
              </p>
            )}
          </div>
        )}

        <textarea
          value={answer || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="Wpisz tłumaczenie po angielsku…"
          className="w-full px-3.5 py-3 bg-base-100 text-white text-[15px] border border-white/15 rounded-xl focus:border-primary focus:outline-none resize-y"
        />
      </div>
    );
  }

  if (type === 'word_order') {
    const chosen: number[] = Array.isArray(answer) ? answer : [];
    const chunks: string[] = item.chunks || [];
    const remaining = chunks.map((_, i) => i).filter((i) => !chosen.includes(i));

    return (
      <div className="space-y-4">
        {item.polishHint && (
          <p className="prose-justified text-[15px] text-content leading-snug">{item.polishHint}</p>
        )}

        {/* Ułożone zdanie: dotknięcie fragmentu zdejmuje go z powrotem. */}
        <div className="min-h-[5rem] rounded-xl border border-dashed border-white/20 bg-base-100/40 p-2.5 flex flex-wrap gap-2 items-start">
          {chosen.length === 0 && (
            <span className="text-[13px] text-content-muted px-1 py-2">
              Dotykaj fragmentów poniżej, żeby ułożyć zdanie.
            </span>
          )}
          {chosen.map((chunkIndex, position) => (
            <button
              key={`${chunkIndex}-${position}`}
              onClick={() => onChange(chosen.filter((_, i) => i !== position))}
              className={`${chipBase} bg-primary/15 border-primary/40 text-primary`}
            >
              {chunks[chunkIndex]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {remaining.map((chunkIndex) => (
            <button
              key={chunkIndex}
              onClick={() => onChange([...chosen, chunkIndex])}
              className={`${chipBase} bg-base-100/60 border-white/15 text-content`}
            >
              {chunks[chunkIndex]}
            </button>
          ))}
        </div>

        {chosen.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="inline-flex items-center gap-1.5 min-h-[2.5rem] text-xs font-bold text-content-muted"
          >
            <RotateCcw size={13} /> Zacznij od nowa
          </button>
        )}
      </div>
    );
  }

  if (type === 'multiple_choice') {
    const options: string[] = item.options || [];
    const selected = typeof answer === 'number' ? answer : -1;

    return (
      <div className="space-y-4">
        <p className="prose-justified text-lg font-bold text-white leading-snug">{item.question}</p>
        <div className="space-y-2">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => onChange(index)}
              className={`w-full min-h-[3.25rem] px-4 rounded-xl border text-left text-[15px] font-semibold transition-colors ${
                selected === index
                  ? 'bg-primary/15 border-primary/45 text-primary'
                  : 'bg-base-100/50 border-white/12 text-content'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'fill_in_the_blank') {
    const blanks: Record<string, string> = answer && typeof answer === 'object' ? answer : {};
    const available: string[] = item.availableWords || [];
    const parts = String(item.textWithBlanks || '').split(/(\[BLANK_\d+\])/g);
    const usedWords = Object.values(blanks);

    const fillFirstEmpty = (word: string) => {
      const blankIds = parts
        .filter((p) => /^\[BLANK_\d+\]$/.test(p))
        .map((p) => p.replace(/[[\]]/g, ''));
      const target = blankIds.find((id) => !blanks[id]);
      if (target) onChange({ ...blanks, [target]: word });
    };

    return (
      <div className="space-y-4">
        {/* Treść ćwiczenia jest angielska, a strona deklaruje polski. Bez tego
            przeglądarka dzieliłaby angielskie słowa według polskich wzorców. */}
        <p lang="en" className="prose-justified text-[15px] text-content leading-loose">
          {parts.map((part, index) => {
            const match = part.match(/^\[BLANK_(\d+)\]$/);
            if (!match) return <span key={index}>{part}</span>;
            const blankId = `BLANK_${match[1]}`;
            const filled = blanks[blankId];
            return (
              <button
                key={index}
                onClick={() => {
                  if (!filled) return;
                  const next = { ...blanks };
                  delete next[blankId];
                  onChange(next);
                }}
                className={`inline-flex items-center justify-center min-h-[2.25rem] min-w-[5rem] px-2.5 mx-0.5 align-middle rounded-lg border text-[14px] font-semibold ${
                  filled
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'border-dashed border-white/30 text-content-muted'
                }`}
              >
                {filled || '???'}
              </button>
            );
          })}
        </p>

        <div className="flex flex-wrap gap-2">
          {available.map((word, index) => {
            const used = usedWords.includes(word);
            return (
              <button
                key={`${word}-${index}`}
                disabled={used}
                onClick={() => fillFirstEmpty(word)}
                className={`${chipBase} ${
                  used
                    ? 'bg-base-100/30 border-white/5 text-content-muted/40'
                    : 'bg-base-100/60 border-white/15 text-content'
                }`}
              >
                {word}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return <p className="text-sm text-content-muted">Nieobsługiwany typ zadania.</p>;
};

export default HomeworkExercise;
