/**
 * Kształty tablicy i ich rysowanie.
 *
 * Wydzielone z komponentu, bo tablica żyje w dwóch oknach: lektor rysuje
 * u siebie, a kursant musi zobaczyć to samo w swoim oknie. Rysowanie po obu
 * stronach z jednej funkcji znaczy, że kreska u kursanta nie może wyglądać
 * inaczej niż u prowadzącego.
 *
 * Kształty są zwykłymi obiektami, nie bitmapą — dzięki temu przechodzą przez
 * kanał między oknami jako JSON, cofanie działa naprawdę, a zmiana rozmiaru
 * okna nie rozmazuje tego, co narysowane.
 */

export type Point = { x: number; y: number };

export type Shape =
  | { kind: 'stroke'; points: Point[]; color: string; width: number; alpha: number; erase: boolean }
  | { kind: 'arrow'; from: Point; to: Point; color: string }
  | { kind: 'text'; at: Point; text: string; color: string };

export const PEN_WIDTH = 3.5;
/** Zakreślacz jest gruby i półprzezroczysty — ma podkreślać, nie zamalowywać. */
export const MARKER_WIDTH = 18;
export const MARKER_ALPHA = 0.32;
export const ERASER_WIDTH = 30;

/** Grot strzałki jako trójkąt: dwie kreski rozjeżdżają się przy grubej linii. */
const ARROW_HEAD = 14;

export interface DrawOptions {
  /** Kolor tła. `null` na nakładce — wtedy gumka wycina, zamiast zamalowywać. */
  background: string | null;
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  { background }: DrawOptions
): void {
  ctx.save();

  if (shape.kind === 'stroke') {
    ctx.globalAlpha = shape.alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = shape.width;
    if (shape.erase) {
      ctx.globalCompositeOperation = background ? 'source-over' : 'destination-out';
      ctx.strokeStyle = background || 'rgba(0,0,0,1)';
    } else {
      ctx.strokeStyle = shape.color;
    }
    ctx.beginPath();
    if (shape.points.length > 0) {
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      shape.points.forEach((p) => ctx.lineTo(p.x, p.y));
    }
    ctx.stroke();
  } else if (shape.kind === 'arrow') {
    const { from, to, color } = shape;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - ARROW_HEAD * Math.cos(angle - Math.PI / 7),
      to.y - ARROW_HEAD * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
      to.x - ARROW_HEAD * Math.cos(angle + Math.PI / 7),
      to.y - ARROW_HEAD * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = shape.color;
    ctx.font = '600 24px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'top';
    shape.text.split('\n').forEach((line, i) => {
      ctx.fillText(line, shape.at.x, shape.at.y + i * 30);
    });
  }

  ctx.restore();
}

/** Czyści płótno i rysuje wszystko od nowa. */
export function renderShapes(
  canvas: HTMLCanvasElement,
  shapes: Shape[],
  options: DrawOptions
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.restore();

  shapes.forEach((shape) => drawShape(ctx, shape, options));
}

/**
 * Skalowanie płótna pod gęstość pikseli ekranu.
 *
 * Bez tego linia na ekranie z dpr 2 jest o połowę cieńsza, niż wynika
 * z `lineWidth`, i rozjeżdża się z pozycją kursora.
 */
export function fitCanvasToDisplay(canvas: HTMLCanvasElement): void {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

/**
 * Przesuwa kształty o zadany wektor.
 *
 * Potrzebne, by sprowadzić rysunek do układu współrzędnych samego slajdu:
 * u lektora slajd leży w środku płótna, z marginesem dookoła, a w oknie kursanta
 * wypełnia kadr. Wspólnym punktem odniesienia jest lewy górny róg slajdu — bez
 * tego przeliczenie rozmiaru nie wystarcza i rysunek ląduje przesunięty.
 */
export function translateShapes(shapes: Shape[], dx: number, dy: number): Shape[] {
  if (dx === 0 && dy === 0) return shapes;
  const move = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });

  return shapes.map((shape) => {
    if (shape.kind === 'stroke') return { ...shape, points: shape.points.map(move) };
    if (shape.kind === 'arrow') return { ...shape, from: move(shape.from), to: move(shape.to) };
    return { ...shape, at: move(shape.at) };
  });
}

/**
 * Przelicza kształty na inny rozmiar płótna.
 *
 * Okno kursanta prawie nigdy nie ma tych samych wymiarów co karta lektora —
 * bez przeliczenia strzałka wskazująca słowo u prowadzącego trafiałaby
 * u kursanta w zupełnie inne miejsce.
 */
export function scaleShapes(shapes: Shape[], scaleX: number, scaleY: number): Shape[] {
  if (scaleX === 1 && scaleY === 1) return shapes;
  const scalePoint = (p: Point): Point => ({ x: p.x * scaleX, y: p.y * scaleY });
  // Grubość skalujemy jedną wartością — osobne mnożniki dla osi zrobiłyby
  // z okrągłej końcówki pisaka elipsę.
  const scaleWidth = (w: number) => w * Math.min(scaleX, scaleY);

  return shapes.map((shape) => {
    if (shape.kind === 'stroke') {
      return { ...shape, points: shape.points.map(scalePoint), width: scaleWidth(shape.width) };
    }
    if (shape.kind === 'arrow') {
      return { ...shape, from: scalePoint(shape.from), to: scalePoint(shape.to) };
    }
    return { ...shape, at: scalePoint(shape.at) };
  });
}
