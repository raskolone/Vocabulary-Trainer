import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Timer } from 'lucide-react';
import { LessonPresentation, PresentationSlide } from '../../../types';
import { PRESENTER_PATH, PresenterLink, openPresenterLink } from '../../../utils/presenterChannel';

/**
 * Panel prowadzącego — zostaje na ekranie lektora, gdy okno ze slajdem idzie
 * do kursanta.
 *
 * Pokazuje trzy rzeczy, których lektor nie ma dziś nigdzie: co jest na następnym
 * slajdzie, własne notatki do bieżącego i ile trwa lekcja. Bez tego prowadzi się
 * „w ciemno" — każde przejście dalej jest niespodzianką także dla prowadzącego.
 */

interface PresenterPanelProps {
  deck: LessonPresentation;
  activeSlideIndex: number;
  onNavigate: (index: number) => void;
}

/** Czas w formacie mm:ss — lekcja rzadko przekracza godzinę. */
const formatElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Skrót treści slajdu do podglądu — bez pełnego renderowania kolejnego slajdu. */
const slideSummary = (slide?: PresentationSlide): string => {
  if (!slide) return '';
  if (slide.content) return String(slide.content);
  if (Array.isArray(slide.items) && slide.items.length > 0) {
    return slide.items
      .map((item) => item?.term || item?.question || item?.definition || '')
      .filter(Boolean)
      .slice(0, 6)
      .join(' · ');
  }
  return '';
};

const PresenterPanel: React.FC<PresenterPanelProps> = ({ deck, activeSlideIndex, onNavigate }) => {
  const linkRef = useRef<PresenterLink | null>(null);
  const [presenterWindow, setPresenterWindow] = useState<Window | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const current = deck.slides[activeSlideIndex];
  const next = deck.slides[activeSlideIndex + 1];

  useEffect(() => {
    linkRef.current = openPresenterLink();
    return () => {
      linkRef.current?.close();
      linkRef.current = null;
    };
  }, []);

  // Każda zmiana slajdu leci do okna kursanta. Wysyłamy też przy zmianie talii,
  // bo lektor potrafi podmienić materiał w trakcie lekcji.
  useEffect(() => {
    linkRef.current?.send({
      slide: current || null,
      slideIndex: activeSlideIndex,
      totalSlides: deck.slides.length,
      deckTitle: deck.title,
    });
  }, [current, activeSlideIndex, deck.slides.length, deck.title]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  const openPresenterWindow = () => {
    const win = window.open(PRESENTER_PATH, 'cribro-presenter', 'width=1280,height=800');
    setPresenterWindow(win);
    // Pierwszy stan po otwarciu: okno czyta ostatni zapamiętany slajd samo,
    // ale wysyłka tutaj skraca oczekiwanie do zera, gdy schowek jest zablokowany.
    setTimeout(() => {
      linkRef.current?.send({
        slide: current || null,
        slideIndex: activeSlideIndex,
        totalSlides: deck.slides.length,
        deckTitle: deck.title,
      });
    }, 600);
    if (!isRunning) setIsRunning(true);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-base-200/60 p-4 space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
          Panel prowadzącego
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setIsRunning((v) => !v)}
            title={isRunning ? 'Zatrzymaj czas' : 'Licz czas lekcji'}
            className={`inline-flex items-center gap-1.5 min-h-[2.5rem] px-3 rounded-xl border text-sm font-mono font-bold ${
              isRunning
                ? 'border-primary/35 text-primary bg-primary/10'
                : 'border-white/12 text-content-muted'
            }`}
          >
            <Timer size={14} />
            {formatElapsed(elapsed)}
          </button>

          <button
            onClick={openPresenterWindow}
            className="inline-flex items-center gap-1.5 min-h-[2.5rem] px-3.5 rounded-xl bg-primary text-accent-ink text-sm font-bold"
          >
            <ExternalLink size={14} />
            {presenterWindow && !presenterWindow.closed ? 'Otwórz ponownie' : 'Okno dla kursanta'}
          </button>
        </div>
      </header>

      <p className="text-[12px] text-content-muted leading-relaxed">
        Udostępnij kursantowi <strong className="text-content">okno prezentacji</strong>, nie całą
        kartę — wtedy ten panel z notatkami i podglądem zostaje tylko dla Ciebie.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Notatki do bieżącego slajdu */}
        <div className="rounded-xl border border-white/[0.07] bg-base-100/50 p-3 space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-content-muted">
            Teraz na ekranie
          </span>
          <h3 className="text-[15px] font-bold text-white leading-snug">
            {current?.title || 'Brak slajdu'}
          </h3>
          {current?.speakerNotes ? (
            <p className="prose-justified text-[13px] text-warn leading-relaxed whitespace-pre-wrap">
              {current.speakerNotes}
            </p>
          ) : (
            <p className="text-[12px] text-content-muted">
              Ten slajd nie ma notatek prowadzącego.
            </p>
          )}
        </div>

        {/* Podgląd następnego */}
        <div className="rounded-xl border border-white/[0.07] bg-base-100/50 p-3 space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-content-muted">
            Następny slajd
          </span>
          {next ? (
            <>
              <h3 className="text-[15px] font-bold text-content leading-snug">{next.title}</h3>
              <p className="text-[13px] text-content-muted leading-relaxed line-clamp-3">
                {slideSummary(next)}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-content-muted">To ostatni slajd w tej talii.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigate(Math.max(0, activeSlideIndex - 1))}
          disabled={activeSlideIndex === 0}
          className="min-h-[2.75rem] px-4 inline-flex items-center gap-1.5 rounded-xl border border-white/12 text-content font-bold text-sm disabled:opacity-30"
        >
          <ChevronLeft size={16} /> Wstecz
        </button>

        <span className="font-mono text-xs text-content-muted">
          {activeSlideIndex + 1}/{deck.slides.length}
        </span>

        <button
          onClick={() => onNavigate(Math.min(deck.slides.length - 1, activeSlideIndex + 1))}
          disabled={activeSlideIndex >= deck.slides.length - 1}
          className="ml-auto min-h-[2.75rem] px-4 inline-flex items-center gap-1.5 rounded-xl bg-primary/15 border border-primary/30 text-primary font-bold text-sm disabled:opacity-30"
        >
          Dalej <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
};

export default PresenterPanel;
