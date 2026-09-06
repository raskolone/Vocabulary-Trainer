import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Odpowiedzi w toku, które przeżyją zamknięcie karty.
 *
 * Aplikacja sama zakłada, że kursant rozwiązuje zadania „w tramwaju albo w
 * kolejce" — a tam karta zostaje uśpiona przez system, ktoś dzwoni, ktoś
 * przełącza się do słownika. Bez zapisu roboczego każde takie przerwanie
 * kasowało komplet odpowiedzi, bo żyły wyłącznie w stanie komponentu.
 *
 * To nie jest `useLocalStorage`, bo trzy rzeczy tutaj są inne: klucz zmienia się
 * w trakcie życia komponentu (kursant zamyka jedno zadanie i otwiera drugie, a
 * wtedy trzeba wczytać jego szkic, nie zostawić poprzedniego), szkic musi dać
 * się skasować po wysłaniu, i musi sam wygasać — inaczej `localStorage` zbiera
 * odpowiedzi do zadań sprzed miesięcy i nigdy ich nie oddaje.
 */

/** Po tylu dniach szkic przestaje być pomocą, a zaczyna być śmieciem. */
const DRAFT_TTL_DAYS = 7;

export const TTL_MS = DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;

interface StoredDraft<T> {
  value: T;
  savedAt: number;
}

export const readDraft = <T,>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    // Tryb prywatny, wyczyszczone dane, uszkodzony wpis — szkic to wygoda,
    // nie dane krytyczne, więc brak odczytu nie może niczego zatrzymać.
    return null;
  }
};

export const writeDraft = <T,>(key: string, value: T): void => {
  try {
    const payload: StoredDraft<T> = { value, savedAt: Date.now() };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Przepełniony schowek albo zablokowany zapis. Kursant nadal rozwiązuje
    // zadanie — traci tylko możliwość wrócenia do niego po zamknięciu karty.
  }
};

export const dropDraft = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* jak wyżej */
  }
};

/**
 * Zwraca odpowiedzi i setter działający jak `useState`, z zapisem w tle.
 *
 * `key === null` wyłącza zapis — tak wygląda podgląd lektora albo ekran bez
 * otwartego zadania, gdzie nie ma czego i po co zapisywać.
 */
export function useDraftAnswers<T>(
  key: string | null,
  initialValue: T
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => (key ? readDraft<T>(key) ?? initialValue : initialValue));

  // Wartość początkowa bywa nowym obiektem przy każdym renderze (`{}`), więc
  // trzymamy ją w ref — inaczej efekt niżej resetowałby stan bez końca.
  const initialRef = useRef(initialValue);

  // Zmiana zadania: wczytujemy szkic nowego zamiast zostawiać poprzedni.
  useEffect(() => {
    setValue(key ? readDraft<T>(key) ?? initialRef.current : initialRef.current);
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        if (key) writeDraft(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  /** Po wysłaniu pracy szkic nie ma już czego chronić. */
  const clear = useCallback(() => {
    if (key) dropDraft(key);
    setValue(initialRef.current);
  }, [key]);

  return [value, update, clear];
}

export default useDraftAnswers;
