import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

/**
 * Komunikat, który nie zatrzymuje pracy.
 *
 * Zastępuje `alert()` tam, gdzie kursant coś właśnie robi. Natywne okno zabiera
 * fokus, blokuje stronę do czasu kliknięcia i potrafi schować się za oknem
 * przeglądarki — a wtedy aplikacja wygląda na zawieszoną. Tutaj komunikat
 * pojawia się nad treścią, znika sam i nie przerywa tego, co kursant pisał.
 *
 * Nie miga i nie pulsuje: wjeżdża raz, spokojnie, i tyle. Przy włączonym
 * ograniczeniu ruchu pojawia się bez animacji (patrz `motion-reduce` niżej).
 */

export type ToastTone = 'info' | 'success' | 'warning';

export interface ToastState {
  message: string;
  tone: ToastTone;
}

/** Ile komunikat zostaje na ekranie, zanim zniknie sam. */
const AUTO_DISMISS_MS = 5000;

const TONE_STYLES: Record<ToastTone, { ring: string; icon: React.ReactNode }> = {
  info: {
    ring: 'border-white/15 bg-base-200',
    icon: <Info size={16} className="text-content-muted shrink-0" />,
  },
  success: {
    ring: 'border-primary/35 bg-base-200',
    icon: <CheckCircle2 size={16} className="text-primary shrink-0" />,
  },
  warning: {
    ring: 'border-warn/35 bg-base-200',
    icon: <AlertTriangle size={16} className="text-warn shrink-0" />,
  },
};

/**
 * Stan komunikatu dla jednego ekranu.
 *
 * Trzyma jeden komunikat naraz — kolejny zastępuje poprzedni, zamiast układać
 * stos okienek w rogu, przez który trzeba się przeklikać.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { toast, showToast, dismissToast };
}

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;
  const style = TONE_STYLES[toast.tone];

  return (
    <div
      // `polite`, nie `assertive`: komunikat ma dotrzeć, ale nie przerywać
      // czytnikowi ekranu w połowie zdania, które kursant właśnie słucha.
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-4 z-50 mx-auto max-w-md sm:inset-x-auto sm:right-5 sm:left-auto sm:w-[22rem] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
    >
      <div
        className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur-sm ${style.ring}`}
      >
        {style.icon}
        <p className="flex-1 text-[13px] leading-relaxed text-content">{toast.message}</p>
        <button
          onClick={onDismiss}
          aria-label="Zamknij komunikat"
          className="shrink-0 -m-1 p-1 text-content-muted transition-colors hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
