/**
 * Kaskada modeli AI — jedno źródło prawdy dla klienta i dla serwera.
 *
 * Wcześniej kolejność modeli była wpisana w sześciu miejscach (klient,
 * `server.ts` w dwóch trasach, wariant serverless, generator prac domowych,
 * kilka wywołań punktowych) i każde z nich schodziło niżej inaczej. Zmiana
 * modelu znaczyła polowanie po repo, a rozjazd między listami był niewidoczny
 * aż do momentu, w którym jeden endpoint wołał model, którego drugi już nie
 * znał.
 *
 * Plik celowo nie importuje niczego: wchodzi zarówno do bundla przeglądarki,
 * jak i do `server.ts` uruchamianego przez tsx.
 *
 * Porządek schodzenia jest stały i wynika z ról, nie z upodobań:
 *   1. PRIMARY   — najmocniejszy, układa zadania i ocenia odpowiedzi,
 *   2. SECONDARY — inny dostawca, żeby awaria jednego nie zatrzymała nauki,
 *   3. TERTIARY  — lekki i tani; ma dowieźć cokolwiek sensownego, gdy dwa
 *                  poprzednie odmówią. Nigdy nie jest pierwszym wyborem.
 */

/** Model pierwszego wyboru — układanie zadań, ocena, streszczenia lekcji. */
export const PRIMARY_MODEL = 'openai/gpt-5.6-luna';

/** Zapas u drugiego dostawcy — chroni przed awarią po stronie OpenAI. */
export const SECONDARY_MODEL = 'gemini-3.8-flash';

/** Trzeci rzut: lekki, tani, zawsze dostępny. Ostatnia deska ratunku. */
export const TERTIARY_MODEL = 'openai/gpt-4o-mini';

/**
 * Domyślna kaskada dla zadań tekstowych i JSON-owych.
 *
 * `gemini-2.5-flash` zostaje na końcu jako sieć bezpieczeństwa dla kont, na
 * których nowsze modele Gemini nie są jeszcze włączone — kosztuje tylko wtedy,
 * gdy wszystko powyżej zawiodło.
 */
export const AI_MODEL_CASCADE: string[] = [
  PRIMARY_MODEL,
  SECONDARY_MODEL,
  TERTIARY_MODEL,
  'gemini-2.5-flash',
];

/**
 * Kaskada po stronie OpenAI — bez prefiksu `openai/`, bo tak nazwy trafiają
 * wprost do API. Serwer przechodzi tę listę, zanim odda sprawę Gemini.
 */
export const OPENAI_MODEL_CASCADE: string[] = AI_MODEL_CASCADE.filter((m) =>
  m.startsWith('openai/')
).map((m) => m.replace('openai/', ''));

/** Kaskada Gemini — kolejność prób po wyczerpaniu modeli OpenAI. */
export const GEMINI_MODEL_CASCADE: string[] = AI_MODEL_CASCADE.filter((m) =>
  m.startsWith('gemini')
);

/**
 * Układa listę modeli OpenAI do wypróbowania, zaczynając od modelu, o który
 * poprosił klient.
 *
 * Bez tego serwer ignorował pole `model` z żądania i zawsze zaczynał od
 * swojego pierwszego modelu — wybór modelu po stronie aplikacji był wtedy
 * czystą dekoracją.
 */
export const openAiModelsFor = (requestedModel?: string | null): string[] => {
  const requested = requestedModel ? String(requestedModel).replace('openai/', '').trim() : '';
  return Array.from(new Set([requested, ...OPENAI_MODEL_CASCADE].filter(Boolean)));
};
