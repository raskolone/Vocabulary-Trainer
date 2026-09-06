import React, { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

/**
 * Odliczanie czasu ćwiczenia — to samo w oknie lektora i kursanta.
 *
 * Slajdy miały pole `timerMinutes`, ale było ono wyłącznie napisem „sugerowany
 * czas". Na lekcji liczy się co innego: kursant ma widzieć, ile zostało, bo
 * „macie trzy minuty" bez widocznego zegara znaczy tyle, co nic.
 *
 * Komponent dostaje moment końca, nie liczbę sekund. Dzięki temu oba okna liczą
 * niezależnie i zawsze pokazują to samo — wystarczyła jedna wiadomość na całe
 * ćwiczenie zamiast tykania wysyłanego co sekundę.
 */

interface SlideTimerProps {
  /** Znacznik czasu końca (ms). `null` — odliczanie nie trwa. */
  endsAt: number | null;
  /** Kompaktowa wersja do paska narzędzi lektora. */
  compact?: boolean;
}

const format = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const SlideTimer: React.FC<SlideTimerProps> = ({ endsAt, compact = false }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    // Odliczanie zatrzymuje się na zerze zamiast schodzić w minus: po czasie
    // liczy się komunikat „koniec", a nie to, o ile ktoś się spóźnił.
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt) return null;

  const remaining = endsAt - now;
  const isOver = remaining <= 0;
  // Ostatnia minuta na pomarańczowo — to moment, w którym warto zacząć kończyć.
  const isEnding = !isOver && remaining <= 60_000;

  const tone = isOver
    ? 'border-danger/40 bg-danger/15 text-danger'
    : isEnding
      ? 'border-warn/40 bg-warn/15 text-warn'
      : 'border-primary/35 bg-primary/10 text-primary';

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 min-h-[2.5rem] px-3 rounded-xl border font-mono text-sm font-bold ${tone}`}
      >
        <Timer size={14} />
        {isOver ? 'koniec' : format(remaining)}
      </span>
    );
  }

  return (
    <div
      role="timer"
      aria-live="off"
      className={`inline-flex items-center gap-3 rounded-2xl border px-5 py-3 ${tone}`}
    >
      <Timer size={22} />
      <span className="font-mono text-3xl font-black tabular-nums leading-none">
        {isOver ? 'Koniec' : format(remaining)}
      </span>
    </div>
  );
};

export default SlideTimer;
