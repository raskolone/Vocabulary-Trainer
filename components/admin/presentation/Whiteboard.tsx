import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Eraser, Highlighter, Pen, RotateCcw, Trash2, Type, X } from 'lucide-react';

/**
 * Tablica do rysowania na lekcji.
 *
 * Dwa tryby, ta sama tablica: pusta (do tłumaczenia czegoś od zera) i nakładka
 * na slajd (do pisania po materiale, który kursant właśnie widzi). Nakładka jest
 * tym, po co sięga się najczęściej — „popatrz na to słowo" z zakreśleniem działa
 * lepiej niż to samo powiedziane.
 *
 * Pięć narzędzi i wszystkie widoczne naraz: pisak, zakreślacz, strzałka, tekst,
 * gumka. Rozwijane menu działają w programach, w których rysuje się godzinami —
 * tutaj lektor sięga po narzędzie w środku zdania i musi trafić bez patrzenia,
 * a każde „w co to się schowało" to przerwana myśl kursanta.
 *
 * Rysunek trzymamy jako listę kształtów, nie jako bitmapę: dzięki temu cofanie
 * działa naprawdę, a zmiana rozmiaru okna albo wejście w pełny ekran nie
 * rozmazuje tego, co już narysowane.
 */

export type WhiteboardTool = 'pen' | 'marker' | 'arrow' | 'text' | 'eraser';

interface WhiteboardProps {
  onClose?: () => void;
  /**
   * Treść, po której się rysuje — zwykle bieżący slajd. Podana, tablica staje
   * się przezroczystą nakładką zamiast pustej płachty.
   */
  backdrop?: React.ReactNode;
  /** Podpis w pasku narzędzi, np. tytuł slajdu — żeby wiadomo było, co pod spodem. */
  contextLabel?: string;
}

const COLORS = [
  { name: 'Zielony', value: '#72f0b4' },
  { name: 'Biały', value: '#f8fafc' },
  { name: 'Żółty', value: '#fbbf24' },
  { name: 'Czerwony', value: '#f87171' },
];

const PEN_WIDTH = 3.5;
/** Zakreślacz jest gruby i półprzezroczysty — ma podkreślać, nie zamalowywać. */
const MARKER_WIDTH = 18;
const MARKER_ALPHA = 0.32;
const ERASER_WIDTH = 30;

type Point = { x: number; y: number };

type Shape =
  | { kind: 'stroke'; points: Point[]; color: string; width: number; alpha: number; erase: boolean }
  | { kind: 'arrow'; from: Point; to: Point; color: string }
  | { kind: 'text'; at: Point; text: string; color: string };

const TOOLS: Array<{ id: WhiteboardTool; label: string; icon: React.ReactNode }> = [
  { id: 'pen', label: 'Pisak', icon: <Pen size={16} /> },
  { id: 'marker', label: 'Zakreślacz', icon: <Highlighter size={16} /> },
  { id: 'arrow', label: 'Strzałka', icon: <ArrowUpRight size={16} /> },
  { id: 'text', label: 'Tekst', icon: <Type size={16} /> },
  { id: 'eraser', label: 'Gumka', icon: <Eraser size={16} /> },
];

const Whiteboard: React.FC<WhiteboardProps> = ({ onClose, backdrop, contextLabel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [color, setColor] = useState(COLORS[0].value);
  const [tool, setTool] = useState<WhiteboardTool>('pen');

  /** Wpisywany właśnie tekst — dopóki nie zatwierdzony, żyje obok kształtów. */
  const [draftText, setDraftText] = useState<{ at: Point; value: string } | null>(null);

  // Kształt w trakcie rysowania siedzi w ref, nie w stanie: przy ruchu ręki
  // dokładamy punkt co kilka milisekund, a przerysowanie Reacta przy każdym
  // z nich gubiłoby płynność linii.
  const current = useRef<Shape | null>(null);
  const isDrawing = useRef(false);

  const isOverlay = Boolean(backdrop);
  // Na nakładce tło musi zostać przezroczyste, żeby slajd był widoczny. Gumka
  // nie ma wtedy czym zamalowywać, więc wycina piksele (`destination-out`).
  const background = isOverlay ? null : '#0b1120';

  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    ctx.save();
    if (shape.kind === 'stroke') {
      ctx.globalAlpha = shape.alpha;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = shape.width;
      if (shape.erase) {
        ctx.globalCompositeOperation = isOverlay ? 'destination-out' : 'source-over';
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
      const { from, to, color: c } = shape;
      const head = 14;
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      ctx.strokeStyle = c;
      ctx.fillStyle = c;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      // Grot rysowany jako trójkąt, nie dwie kreski — przy grubej linii dwie
      // kreski rozjeżdżają się na końcu i strzałka wygląda na złamaną.
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - head * Math.cos(angle - Math.PI / 7), to.y - head * Math.sin(angle - Math.PI / 7));
      ctx.lineTo(to.x - head * Math.cos(angle + Math.PI / 7), to.y - head * Math.sin(angle + Math.PI / 7));
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
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.restore();

    const all = current.current ? [...shapes, current.current] : shapes;
    all.forEach((shape) => drawShape(ctx, shape));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, background, isOverlay]);

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

  const commitText = () => {
    if (draftText && draftText.value.trim()) {
      setShapes((prev) => [
        ...prev,
        { kind: 'text', at: draftText.at, text: draftText.value.trim(), color },
      ]);
    }
    setDraftText(null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointFrom(e);

    if (tool === 'text') {
      // Kliknięcie przy otwartym polu najpierw zatwierdza poprzedni tekst,
      // żeby nie znikał bez śladu przy przeniesieniu się w inne miejsce.
      if (draftText) commitText();
      else setDraftText({ at: point, value: '' });
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawing.current = true;

    if (tool === 'arrow') {
      current.current = { kind: 'arrow', from: point, to: point, color };
      return;
    }

    current.current = {
      kind: 'stroke',
      points: [point],
      color,
      width: tool === 'marker' ? MARKER_WIDTH : tool === 'eraser' ? ERASER_WIDTH : PEN_WIDTH,
      alpha: tool === 'marker' ? MARKER_ALPHA : 1,
      erase: tool === 'eraser',
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !current.current) return;
    const point = pointFrom(e);
    if (current.current.kind === 'arrow') current.current.to = point;
    else if (current.current.kind === 'stroke') current.current.points.push(point);
    redraw();
  };

  const handlePointerUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const finished = current.current;
    current.current = null;
    if (!finished) return;

    // Samo dotknięcie bez przeciągnięcia to nie kształt — bez tego każdy klik
    // zostawiałby na tablicy kropkę albo strzałkę o zerowej długości.
    if (finished.kind === 'arrow') {
      const dist = Math.hypot(finished.to.x - finished.from.x, finished.to.y - finished.from.y);
      if (dist < 12) {
        redraw();
        return;
      }
    }
    setShapes((prev) => [...prev, finished]);
  };

  const undo = () => setShapes((prev) => prev.slice(0, -1));
  const clear = () => {
    setShapes([]);
    setDraftText(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (draftText) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draftText, onClose]);

  const toolButton =
    'min-h-[2.75rem] min-w-[2.75rem] px-3 inline-flex items-center justify-center rounded-xl border text-sm font-bold transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base-100">
      <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 border-b border-white/10 bg-base-200/90 overflow-x-auto shrink-0">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              if (draftText) commitText();
              setTool(t.id);
            }}
            aria-pressed={tool === t.id}
            title={t.label}
            className={`${toolButton} shrink-0 ${
              tool === t.id
                ? t.id === 'eraser'
                  ? 'bg-warn/15 border-warn/40 text-warn'
                  : 'bg-primary/15 border-primary/40 text-primary'
                : 'border-white/12 text-content-muted'
            }`}
          >
            {t.icon}
          </button>
        ))}

        <div className="w-px h-8 bg-white/10 shrink-0 mx-0.5" />

        {COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => {
              setColor(c.value);
              if (tool === 'eraser') setTool('pen');
            }}
            aria-label={c.name}
            aria-pressed={color === c.value}
            title={c.name}
            className={`w-10 h-10 shrink-0 rounded-xl border-2 transition-transform ${
              color === c.value ? 'border-white scale-105' : 'border-white/20 hover:border-white/40'
            }`}
            style={{ backgroundColor: c.value }}
          />
        ))}

        <div className="w-px h-8 bg-white/10 shrink-0 mx-0.5" />

        <button
          onClick={undo}
          disabled={shapes.length === 0}
          title="Cofnij (Ctrl+Z)"
          className={`${toolButton} shrink-0 border-white/12 text-content-muted disabled:opacity-30`}
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={clear}
          disabled={shapes.length === 0}
          title="Wyczyść tablicę"
          className={`${toolButton} shrink-0 border-white/12 text-content-muted disabled:opacity-30`}
        >
          <Trash2 size={16} />
        </button>

        {contextLabel && (
          <span className="hidden md:block ml-3 text-[12px] text-content-muted truncate max-w-[16rem]">
            {contextLabel}
          </span>
        )}

        {onClose && (
          <button
            onClick={onClose}
            title="Zamknij tablicę (Esc)"
            className={`${toolButton} shrink-0 border-white/12 text-content-muted ml-auto`}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
        {/* Slajd pod spodem. `pointer-events-none`, bo cała warstwa dotyku
            należy do płótna — inaczej przyciski slajdu łapałyby rysowanie. */}
        {backdrop && (
          <div className="absolute inset-0 overflow-auto pointer-events-none">{backdrop}</div>
        )}

        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          // `touch-none` jest konieczne: bez niego przeciągnięcie palcem po
          // tablecie przewija stronę zamiast rysować.
          className={`absolute inset-0 w-full h-full touch-none ${
            tool === 'text' ? 'cursor-text' : 'cursor-crosshair'
          }`}
        />

        {draftText && (
          <textarea
            autoFocus
            value={draftText.value}
            onChange={(e) => setDraftText({ ...draftText, value: e.target.value })}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitText();
              }
              if (e.key === 'Escape') setDraftText(null);
            }}
            placeholder="Wpisz i naciśnij Enter"
            style={{
              left: draftText.at.x,
              top: draftText.at.y,
              color,
              caretColor: color,
            }}
            className="absolute z-10 min-w-[12rem] resize-none rounded-lg border border-white/25 bg-black/70 px-2 py-1 text-[24px] font-semibold leading-tight outline-none"
            rows={1}
          />
        )}
      </div>
    </div>
  );
};

export default Whiteboard;
