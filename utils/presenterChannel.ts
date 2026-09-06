import { PresentationSlide } from '../types';
import type { SlideInteraction } from '../components/admin/presentation/SlideCard';
import type { Shape } from '../components/admin/presentation/whiteboardShapes';
import type { LiveCorrectionItem, LiveVocabItem } from '../types';

/**
 * Łącze między kartą lektora a oknem, które widzi kursant.
 *
 * Tryb prezentera ma sens tylko wtedy, gdy slajd i notatki są w dwóch różnych
 * oknach: przy udostępnianiu ekranu kursant widzi dokładnie to, co lektor, więc
 * „notatki tylko dla mnie" w tej samej karcie nie istnieją. Lektor udostępnia
 * okno prezentacji, a panel prowadzącego zostaje u niego.
 *
 * `BroadcastChannel` jest tu właściwym narzędziem — działa między kartami tego
 * samego pochodzenia i nie wymaga trzymania referencji do okna, która i tak
 * ginie przy odświeżeniu. Starsze Safari go nie zna, więc pod spodem leży
 * zapasowa ścieżka przez `localStorage`: zapis w jednej karcie wywołuje zdarzenie
 * `storage` w drugiej.
 */

/** Nazwa kanału i klucz zapasowy — obie karty muszą używać tych samych. */
const CHANNEL_NAME = 'cribro-presenter';
const STORAGE_KEY = 'cribro_presenter_state';

export interface PresenterState {
  slide: PresentationSlide | null;
  slideIndex: number;
  totalSlides: number;
  deckTitle: string;
  /**
   * Co lektor odkrył i podświetlił na slajdzie. Bez tego okno kursanta
   * pokazywało slajd, ale każde odsłonięcie odpowiedzi zostawało po stronie
   * prowadzącego — czyli wszystko klikalne działało tylko dla niego.
   */
  interaction: SlideInteraction;
  /**
   * Rysunek z tablicy lektora wraz z rozmiarem płótna, na którym powstał.
   * Rozmiar jest potrzebny, bo okno kursanta ma inne wymiary — bez przeliczenia
   * strzałka wskazująca słowo trafiałaby u niego w inne miejsce.
   */
  whiteboard?: { shapes: Shape[]; width: number; height: number } | null;
  /**
   * Koniec odliczania jako znacznik czasu, nie liczba sekund: dzięki temu
   * wystarczy jedna wiadomość na całe ćwiczenie, a każde okno liczy sobie samo
   * — inaczej trzeba by wysyłać tykanie co sekundę do wszystkich naraz.
   */
  timerEndsAt?: number | null;
  /**
   * Nowe słowa i poprawki zapisywane w trakcie zajęć. Kursant widzi je na
   * bieżąco, zamiast dostawać dopiero po lekcji — poprawka przeczytana w chwili,
   * w której padła, zostaje w głowie inaczej niż ta sama linijka w mailu.
   */
  liveNotebook?: { vocab: LiveVocabItem[]; corrections: LiveCorrectionItem[] } | null;
  /** Rośnie z każdą wiadomością — okno odrzuca to, co już pokazało. */
  revision: number;
}

type Listener = (state: PresenterState) => void;

export interface PresenterLink {
  send: (state: Omit<PresenterState, 'revision'>) => void;
  subscribe: (listener: Listener) => () => void;
  close: () => void;
}

const supportsBroadcast = (): boolean =>
  typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function';

/**
 * Otwiera łącze prezentera.
 *
 * Ostatni stan trafia też do `localStorage`, nie tylko na kanał: okno kursanta
 * bywa otwierane po tym, jak lektor zdążył przeklikać kilka slajdów, i musi mieć
 * skąd wziąć aktualny slajd, zamiast czekać na następną zmianę.
 */
export function openPresenterLink(): PresenterLink {
  let revision = 0;
  const channel = supportsBroadcast() ? new BroadcastChannel(CHANNEL_NAME) : null;
  const listeners = new Set<Listener>();

  const handleMessage = (state: PresenterState) => {
    listeners.forEach((listener) => listener(state));
  };

  if (channel) {
    channel.onmessage = (event) => {
      if (event.data && typeof event.data === 'object') handleMessage(event.data as PresenterState);
    };
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      handleMessage(JSON.parse(event.newValue) as PresenterState);
    } catch {
      /* uszkodzony wpis — pomijamy, następna zmiana slajdu naprawi widok */
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);

  return {
    send: (state) => {
      revision += 1;
      const payload: PresenterState = { ...state, revision };
      if (channel) channel.postMessage(payload);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Bez schowka zostaje sam kanał — wtedy okno otwarte później zobaczy
        // slajd dopiero przy następnej zmianie.
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => {
      listeners.clear();
      if (channel) channel.close();
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
    },
  };
}

/** Ostatni znany stan — dla okna, które dopiero się otworzyło. */
export function readLastPresenterState(): PresenterState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PresenterState) : null;
  } catch {
    return null;
  }
}

/** Adres okna prezentacji — App.tsx rozpoznaje tę ścieżkę przed logowaniem. */
export const PRESENTER_PATH = '/present';
