import React, { useEffect, useState } from 'react';
import { SlideCard } from './SlideCard';
import {
  PresenterState,
  openPresenterLink,
  readLastPresenterState,
} from '../../../utils/presenterChannel';

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
      <div className="w-full max-w-6xl mx-auto">
        <SlideCard
          slide={state.slide}
          slideIndex={state.slideIndex}
          totalSlides={state.totalSlides}
          isFullscreen
        />
      </div>
    </div>
  );
};

export default PresenterScreen;
