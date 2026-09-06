import React, { useEffect, useRef, useState } from 'react';
import { EMPTY_SLIDE_INTERACTION, SlideCard } from './SlideCard';
import {
  PresenterState,
  openPresenterLink,
  readLastPresenterState,
} from '../../../utils/presenterChannel';
import { fitCanvasToDisplay, renderShapes, scaleShapes } from './whiteboardShapes';

/**
 * Okno, które widzi kursant.
 *
 * Sam slajd i nic więcej: bez paska narzędzi, bez notatnika, bez menu. To okno
 * lektor udostępnia na zajęciach, więc wszystko, co nie jest treścią lekcji,
 * jest tu zbędne — a przy okazji zdradzałoby, co lektor ma zaplanowane dalej.
 *
 * Stan przychodzi z karty prowadzącego przez `BroadcastChannel`. Przy otwarciu
 * bierzemy ostatni zapamiętany slajd, żeby okno otwarte w środku lekcji od razu
 * pokazywało to, co trzeba, zamiast czekać na następne kliknięcie.
 */

const PresenterScreen: React.FC = () => {
  const [state, setState] = useState<PresenterState | null>(() => readLastPresenterState());

  useEffect(() => {
    const link = openPresenterLink();
    const unsubscribe = link.subscribe((next) => {
      // Wiadomości mogą przyjść w innej kolejności niż wysłane; numer rewizji
      // pilnuje, żeby starszy slajd nie zastąpił nowszego.
      setState((prev) => (prev && next.revision < prev.revision ? prev : next));
    });
    return () => {
      unsubscribe();
      link.close();
    };
  }, []);

  useEffect(() => {
    document.title = state?.deckTitle ? `${state.deckTitle} — prezentacja` : 'Prezentacja';
  }, [state?.deckTitle]);

  // Rysunek lektora nad slajdem. Przeliczamy go na rozmiar tego okna — kursant
  // prawie nigdy nie ma okna tej samej wielkości co prowadzący, a strzałka ma
  // wskazywać to samo słowo, nie ten sam piksel.
  const boardRef = useRef<HTMLCanvasElement>(null);
  const board = state?.whiteboard;

  useEffect(() => {
    const canvas = boardRef.current;
    if (!canvas) return;

    const paint = () => {
      fitCanvasToDisplay(canvas);
      const rect = canvas.getBoundingClientRect();
      if (!board || board.shapes.length === 0 || !board.width || !board.height) {
        renderShapes(canvas, [], { background: null });
        return;
      }
      const scaled = scaleShapes(
        board.shapes,
        rect.width / board.width,
        rect.height / board.height
      );
      renderShapes(canvas, scaled, { background: null });
    };

    paint();
    window.addEventListener('resize', paint);
    return () => window.removeEventListener('resize', paint);
  }, [board]);

  if (!state?.slide) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-extrabold text-white">Okno prezentacji gotowe</h1>
          <p className="text-[15px] text-content-muted leading-relaxed">
            Udostępnij to okno kursantowi. Slajdy będą się tu zmieniać, gdy przełączysz je
            w panelu prowadzącego.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-8 flex items-center">
      <div className="relative w-full max-w-6xl mx-auto">
        <SlideCard
          slide={state.slide}
          slideIndex={state.slideIndex}
          totalSlides={state.totalSlides}
          isFullscreen
          // Interakcją steruje wyłącznie lektor: puste `onInteractionChange`
          // sprawia, że kliknięcie w oknie kursanta nic nie zmienia, więc widok
          // nie rozjeżdża się z tym, co prowadzący ma na ekranie.
          interaction={state.interaction || EMPTY_SLIDE_INTERACTION}
          onInteractionChange={() => {}}
        />

        {/* Warstwa rysunku. `pointer-events-none`, bo kursant tylko patrzy —
            wszystko, co widzi, pochodzi od prowadzącego. */}
        <canvas
          ref={boardRef}
          className="pointer-events-none absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  );
};

export default PresenterScreen;
