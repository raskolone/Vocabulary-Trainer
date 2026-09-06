/**
 * Kody dostępu do testów otwartych.
 *
 * Kod bywa przepisywany z ekranu, dyktowany przez telefon albo wklejany z maila,
 * więc alfabet nie zawiera znaków, które przy przepisywaniu mylą się ze sobą:
 * 0/O, 1/I/L, 5/S, 8/B. Zostaje 27 znaków — przy sześciu miejscach daje to
 * ponad 380 milionów kombinacji, czyli dość, by kodu nie dało się zgadnąć,
 * a jednocześnie na tyle krótko, że mieści się w jednej linijce SMS-a.
 *
 * Alfabet i tablica zamian w `normalizeAccessCode` muszą się zgadzać: znak,
 * który normalizacja na coś zamienia, nie może wychodzić z generatora, bo taki
 * kod po znormalizowaniu wskazywałby na inny dokument niż ten zapisany.
 */

/** Alfabet bez znaków mylących się przy przepisywaniu. */
export const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXYZ234679';

export const CODE_LENGTH = 6;

/**
 * Losuje kod dostępu.
 *
 * `crypto.getRandomValues` zamiast `Math.random`, bo kod jest jedynym
 * zabezpieczeniem testu — przewidywalny generator znaczyłby, że znajomość
 * jednego kodu pozwala zgadywać kolejne.
 */
export function generateAccessCode(length: number = CODE_LENGTH): string {
  const alphabet = CODE_ALPHABET;
  const max = alphabet.length;

  const randomBytes = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(randomBytes);
  } else {
    // Środowiska bez Web Crypto (starsze webview) — gorzej, ale wciąż działa.
    for (let i = 0; i < length; i++) randomBytes[i] = Math.floor(Math.random() * 0xffffffff);
  }

  let code = '';
  for (let i = 0; i < length; i++) {
    code += alphabet[randomBytes[i] % max];
  }
  return code;
}

/**
 * Sprowadza kod wpisany przez człowieka do postaci kanonicznej.
 *
 * Kandydat wpisze go z małych liter, ze spacją albo z myślnikiem w środku —
 * i za każdym razem ma trafić w ten sam dokument. Znaki wyrzucone z alfabetu
 * mapujemy na te, z którymi się mylą, więc „O" wpisane zamiast zera nadal
 * otwiera test.
 */
export function normalizeAccessCode(raw: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[\s-_.]/g, '')
    .replace(/0/g, 'D')
    .replace(/O/g, 'D')
    .replace(/[1IL]/g, 'J')
    .replace(/[5S]/g, 'X')
    .replace(/[8B]/g, 'W')
    .split('')
    .filter((char) => CODE_ALPHABET.includes(char))
    .join('');
}

/** Czy kod ma szansę być prawdziwy — sprawdzane przed odpytaniem bazy. */
export function isValidAccessCode(raw: string): boolean {
  const normalized = normalizeAccessCode(raw);
  return normalized.length === CODE_LENGTH;
}

/** Kod w formie do pokazania: „ABC-123" czyta się i dyktuje łatwiej niż „ABC123". */
export function formatAccessCode(code: string): string {
  const clean = String(code || '').toUpperCase();
  if (clean.length !== CODE_LENGTH) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3)}`;
}

/**
 * Pełny link do testu.
 *
 * Ścieżka `/test/KOD` idzie wzorem istniejącego `/starter`: aplikacja rozpoznaje
 * ją w App.tsx zanim cokolwiek wymaga logowania.
 */
export function buildPublicTestUrl(code: string, origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/test/${String(code || '').toUpperCase()}`;
}

/** Wyciąga kod ze ścieżki `/test/KOD`. Zwraca pusty string, gdy to nie ta trasa. */
export function readAccessCodeFromPath(pathname: string): string {
  const match = String(pathname || '').match(/^\/test\/?([^/?#]*)/);
  if (!match) return '';
  return normalizeAccessCode(match[1] || '');
}
