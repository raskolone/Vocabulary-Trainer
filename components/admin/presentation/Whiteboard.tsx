import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Pen, RotateCcw, Trash2, X } from 'lucide-react';

/**
 * Tablica do rysowania na lekcji.
 *
 * Narzędzi jest pięć i wszystkie są widoczne naraz: pisak, cztery kolory, gumka,
 * cofnij, wyczyść. Rozwijane menu i paski właściwości działają w programach, w
 * których rysuje się godzinami — tutaj lektor sięga po tablicę w środku zdania i
 * musi trafić w narzędzie bez patrzenia, a każde kliknięcie „w co to się
 * schowało" to przerwana myśl kursanta.
 *
 * Rysunek jest ulotny z założenia: żyje do końca lekcji i znika. Zapis do bazy
 * dołożyłby decyzję („zachować?") do sytuacji, w której lektor mówi i rysuje
 * jednocześnie — a od utrwalania materiału są slajdy i notatnik.
 *
 * Rysujemy w `pointer events`, nie w mouse/touch osobno: ten sam kod obsługuje
 * mysz, palec i pióro na tablecie, bez gałęzi na każde urządzenie.
 */

interface WhiteboardProps {
  /** Zamknięcie tablicy — wraca widok prezentacji. */
  onClose?: () => void;
  /** Ciemne tło pasuje do prezentacji; jasne bywa czytelniejsze na rzutniku. */
  variant?: 'dark' | 'light';
}

const COLORS = [
  { name: 'Zielony', value: '#72f0b4' },
  { name: 'Biały', value: '#f8fafc' },
  { name: 'Żółty', value: '#fbbf24' },
  { name: 'Czerwony', value: '#f87171' },
];

/** Grubość pisaka i gumki — dwie wartości zamiast suwaka. */
const PEN_WIDTH = 3.5;
const ERASER_WIDTH = 28;

type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; width: number; erase: boolean };

const Whiteboard: React.FC<WhiteboardProps> = ({ onClose, variant = 'dark' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[0].value);
  const [isErasing, setIsErasing] = useState(false);

  // Bieżąca kreska żyje w ref, nie w stanie: przy rysowaniu dokładamy punkt co
  // kilka milisekund, a przerysowanie całego Reacta przy każdym ruchu ręki
  // gubiłoby płynność linii.
  const current = useRef<Stroke | null>(null);
  const isDrawing = useRef(false);

  const background = variant === 'dark' ? '#0b1120' : '#f8fafc';

  /** Przerysowuje całą tablicę — po zmianie rozmiaru, cofnięciu i czyszczeniu. */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const all = current.current ? [...strokes, current.current] : strokes;
    all.forEach((stroke) => {
      if (stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke.width;
      // Gumka maluje tłem zamiast wycinać piksele: przy `destination-out`
      // ślad po niej robi się przezroczysty i widać przez niego slajd pod spodem.
      ctx.strokeStyle = stroke.erase ? background : stroke.color;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    });
  }, [strokes, background]);

  /** Dopasowanie do rozmiaru okna z uwzględnieniem gęstości pikseli. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext('2d');
      // Bez tej skali linia na ekranie z dpr 2 byłaby o połowę cieńsza, niż
      // wynika z `lineWidth`, i rozjeżdżała się z pozycją kursora.
      ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
      redraw();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    current.current = {
      points: [pointFrom(e)],
      color,
      width: isErasing ? ERASER_WIDTH : PEN_WIDTH,
      erase: isErasing,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !current.current) return;
    current.current.points.push(pointFrom(e));
    redraw();
  };

  const handlePointerUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (current.current && current.current.points.length > 0) {
      const finished = current.current;
      current.current = null;
      setStrokes((prev) => [...prev, finished]);
    } else {
      current.current = null;
    }
  };

  const undo = () => setStrokes((prev) => prev.slice(0, -1));
  const clear = () => setStrokes([]);

  const toolButton =
    'min-h-[2.75rem] min-w-[2.75rem] px-3 inline-flex items-center justify-center gap-1.5 rounded-xl border text-sm font-bold transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base-100">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-white/10 bg-base-200/80 overflow-x-auto">
        <button
          onClick={() => setIsErasing(false)}
          aria-pressed={!isErasing}
          className={`${toolButton} ${
            !isErasing
              ? 'bg-primary/15 border-primary/40 text-primary'
              : 'border-white/12 text-content-muted'
          }`}
          title="Pisak"
        >
          <Pen size={16} />
        </button>

        {COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => {
              setColor(c.value);
              setIsErasing(false);
            }}
            aria-label={c.name}
            aria-pressed={!isErasing && color === c.value}
            title={c.name}
            className={`w-11 h-11 shrink-0 rounded-xl border-2 transition-transform ${
              !isErasing && color === c.value
                ? 'border-white scale-105'
                : 'border-white/20 hover:border-white/40'
            }`}
            style={{ backgroundColor: c.value }}
          />
        ))}

        <button
          onClick={() => setIsErasing(true)}
          aria-pressed={isErasing}
          className={`${toolButton} ${
            isErasing
              ? 'bg-warn/15 border-warn/40 text-warn'
              : 'border-white/12 text-content-muted'
          }`}
          title="Gumka"
        >
          <Eraser size={16} />
        </button>

        <div className="w-px h-8 bg-white/10 shrink-0 mx-1" />

        <button
          onClick={undo}
          disabled={strokes.length === 0}
          className={`${toolButton} border-white/12 text-content-muted disabled:opacity-30`}
          title="Cofnij"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={clear}
          disabled={strokes.length === 0}
          className={`${toolButton} border-white/12 text-content-muted disabled:opacity-30`}
          title="Wyczyść tablicę"
        >
          <Trash2 size={16} />
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className={`${toolButton} border-white/12 text-content-muted ml-auto shrink-0`}
            title="Zamknij tablicę"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        // `touch-none` jest tu konieczne: bez niego przeciągnięcie palcem po
        // tablecie przewija stronę zamiast rysować.
        className="flex-1 w-full touch-none cursor-crosshair"
        style={{ backgroundColor: background }}
      />
    </div>
  );
};

export default Whiteboard;
