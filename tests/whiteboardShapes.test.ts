import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Shape, scaleShapes } from '../components/admin/presentation/whiteboardShapes';

/**
 * Przeliczanie rysunku między oknami.
 *
 * Lektor rysuje na swoim płótnie, kursant ogląda na swoim — prawie nigdy tej
 * samej wielkości. Błąd w skalowaniu nie wywala niczego: strzałka po prostu
 * wskazuje inne słowo niż to, o którym lektor mówi, i nikt nie wie dlaczego.
 */

const stroke: Shape = {
  kind: 'stroke',
  points: [
    { x: 100, y: 200 },
    { x: 300, y: 400 },
  ],
  color: '#72f0b4',
  width: 4,
  alpha: 1,
  erase: false,
};

const arrow: Shape = {
  kind: 'arrow',
  from: { x: 100, y: 100 },
  to: { x: 500, y: 300 },
  color: '#f87171',
};

const label: Shape = { kind: 'text', at: { x: 250, y: 150 }, text: 'ważne', color: '#fbbf24' };

test('skala 1:1 zwraca dokładnie to samo', () => {
  const shapes = [stroke, arrow, label];
  assert.equal(scaleShapes(shapes, 1, 1), shapes);
});

test('punkty kreski przeliczają się proporcjonalnie', () => {
  const [scaled] = scaleShapes([stroke], 0.5, 0.5) as [Extract<Shape, { kind: 'stroke' }>];
  assert.deepEqual(scaled.points, [
    { x: 50, y: 100 },
    { x: 150, y: 200 },
  ]);
});

test('strzałka zachowuje oba końce', () => {
  const [scaled] = scaleShapes([arrow], 0.5, 2) as [Extract<Shape, { kind: 'arrow' }>];
  assert.deepEqual(scaled.from, { x: 50, y: 200 });
  assert.deepEqual(scaled.to, { x: 250, y: 600 });
});

test('tekst przenosi się razem z treścią i kolorem', () => {
  const [scaled] = scaleShapes([label], 2, 2) as [Extract<Shape, { kind: 'text' }>];
  assert.deepEqual(scaled.at, { x: 500, y: 300 });
  assert.equal(scaled.text, 'ważne');
  assert.equal(scaled.color, '#fbbf24');
});

test('grubość skaluje się mniejszym z mnożników, żeby pisak został okrągły', () => {
  // Osobne mnożniki dla osi zrobiłyby z okrągłej końcówki elipsę, a canvas
  // i tak rysuje jedną szerokością linii.
  const [wide] = scaleShapes([stroke], 2, 0.5) as [Extract<Shape, { kind: 'stroke' }>];
  assert.equal(wide.width, 2);

  const [big] = scaleShapes([stroke], 3, 3) as [Extract<Shape, { kind: 'stroke' }>];
  assert.equal(big.width, 12);
});

test('kolor, przezroczystość i tryb gumki przechodzą bez zmian', () => {
  const eraser: Shape = { ...stroke, erase: true, alpha: 0.32, color: '#fff' };
  const [scaled] = scaleShapes([eraser], 0.5, 0.5) as [Extract<Shape, { kind: 'stroke' }>];
  assert.equal(scaled.erase, true);
  assert.equal(scaled.alpha, 0.32);
  assert.equal(scaled.color, '#fff');
});

test('pusta lista nie wywraca przeliczenia', () => {
  assert.deepEqual(scaleShapes([], 0.7, 0.7), []);
});

test('przeliczenie nie zmienia oryginału', () => {
  const original: Shape = {
    kind: 'stroke',
    points: [{ x: 10, y: 20 }],
    color: '#fff',
    width: 4,
    alpha: 1,
    erase: false,
  };
  scaleShapes([original], 5, 5);
  assert.deepEqual((original as any).points, [{ x: 10, y: 20 }]);
  assert.equal((original as any).width, 4);
});

test('proporcje między kształtami zostają zachowane', () => {
  // Strzałka wskazująca punkt kreski ma po przeliczeniu wskazywać ten sam punkt.
  const point = { x: 300, y: 400 };
  const pointer: Shape = { kind: 'arrow', from: { x: 0, y: 0 }, to: point, color: '#fff' };
  const [s, a] = scaleShapes([stroke, pointer], 0.6, 0.6) as [
    Extract<Shape, { kind: 'stroke' }>,
    Extract<Shape, { kind: 'arrow' }>,
  ];
  assert.deepEqual(a.to, s.points[1]);
});
