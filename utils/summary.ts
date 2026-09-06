/**
 * Skracanie streszczenia lekcji do kilku pierwszych zdań.
 *
 * Panel kursanta ma mówić, co przerabialiśmy, a nie przepisywać całą notatkę
 * lektora — na telefonie długie streszczenie spycha słownictwo i historię
 * poniżej pierwszego ekranu. Pełny tekst zostaje dostępny pod „pokaż więcej",
 * więc skracanie niczego nie ukrywa na stałe.
 */

/** Wypunktowanie rozpoznajemy po myślniku, gwiazdce albo numeracji na początku linii. */
const LIST_LINE = /^\s*([-*+•]|\d+[.)])\s+/;

export interface ShortenedText {
  /** Wersja skrócona — do pokazania domyślnie. */
  short: string;
  /** Czy cokolwiek zostało ucięte (czyli czy warto dawać „pokaż więcej"). */
  truncated: boolean;
}

/**
 * Zwraca pierwsze `max` zdań tekstu.
 *
 * Tekst bywa markdownem z listą, a listy nie mają kropek na końcu pozycji —
 * dlatego wypunktowanie liczy się jako całość i nie jest cięte w środku.
 * Kropka w skrócie („np.", „itd.") kończyłaby zdanie przedwcześnie, więc
 * wymagamy po niej spacji i wielkiej litery albo końca tekstu.
 */
export function firstSentences(text: string | undefined, max = 3): ShortenedText {
  const trimmed = (text || '').trim();
  if (!trimmed) return { short: '', truncated: false };

  const lines = trimmed.split('\n');
  const firstListLine = lines.findIndex((line) => LIST_LINE.test(line));

  // Proza przed pierwszą listą. Gdy wpis zaczyna się od listy, nie ma czego
  // skracać zdaniami — oddajemy całość i zostawiamy decyzję układowi.
  if (firstListLine === 0) return { short: trimmed, truncated: false };

  const prose = (firstListLine === -1 ? lines : lines.slice(0, firstListLine)).join('\n').trim();
  const hasListBelow = firstListLine !== -1;

  const sentences = prose.match(/[^.!?…]+[.!?…]+(?=\s+[A-ZĄĆĘŁŃÓŚŹŻ0-9"„(]|\s*$)|[^.!?…]+$/g);
  if (!sentences) return { short: trimmed, truncated: false };

  const kept = sentences.slice(0, max).join(' ').replace(/\s+/g, ' ').trim();
  const truncated = sentences.length > max || hasListBelow;

  return { short: kept, truncated };
}
