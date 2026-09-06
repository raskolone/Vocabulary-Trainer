import React from 'react';
import { ArrowRight, BookOpen, PenLine } from 'lucide-react';
import { LiveCorrectionItem, LiveVocabItem } from '../../../types';

/**
 * Notatnik lekcji widziany przez kursanta.
 *
 * Lektor zapisuje nowe słowa i poprawki w trakcie zajęć, ale dotąd trafiały one
 * wyłącznie do jego panelu — kursant dostawał je dopiero po lekcji, w podsumowaniu.
 * Poprawka przeczytana w chwili, w której padła, zostaje w głowie inaczej niż ta
 * sama linijka w mailu następnego dnia.
 *
 * To widok wyłącznie do czytania i celowo ubogi: pasek u dołu slajdu, bez
 * nagłówków sekcji i bez przewijania, pokazujący ostatnie wpisy. Pełna notatka
 * i tak trafia do historii lekcji — tutaj chodzi o to, co padło przed chwilą.
 */

interface LiveNotesForStudentProps {
  vocab: LiveVocabItem[];
  corrections: LiveCorrectionItem[];
}

/**
 * Ile ostatnich wpisów pokazujemy — reszta zasłoniłaby slajd.
 *
 * Notatnik dokłada nowe pozycje na początek listy, więc najświeższe są tutaj,
 * nie na końcu. Branie z końca pokazywałoby trzy pierwsze wpisy lekcji i tam
 * zamarzało — kursant patrzyłby przez godzinę na to, co padło na starcie.
 */
const MAX_VISIBLE = 3;

const LiveNotesForStudent: React.FC<LiveNotesForStudentProps> = ({ vocab, corrections }) => {
  const lastVocab = vocab.slice(0, MAX_VISIBLE);
  const lastCorrections = corrections.slice(0, MAX_VISIBLE);

  if (lastVocab.length === 0 && lastCorrections.length === 0) return null;

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-base-200/60 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {lastVocab.length > 0 && (
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
              <BookOpen size={12} /> Nowe słowa
            </span>
            <ul className="space-y-1">
              {lastVocab.map((item) => (
                <li key={item.id} className="text-[15px] leading-snug">
                  <strong className="text-white">{item.term}</strong>
                  {item.translation && (
                    <span className="text-content-muted"> — {item.translation}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {lastCorrections.length > 0 && (
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-warn">
              <PenLine size={12} /> Poprawki
            </span>
            <ul className="space-y-1">
              {lastCorrections.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-baseline gap-x-2 text-[15px] leading-snug"
                >
                  <span className="text-content-muted line-through">{item.studentSaid}</span>
                  <ArrowRight size={13} className="text-warn shrink-0" />
                  <strong className="text-white">{item.betterWay}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};

export default LiveNotesForStudent;
