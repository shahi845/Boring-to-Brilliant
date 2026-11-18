import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAB_LAYOUTS, labGeometry, labSVG, pathToSeat } from '../../src/scene/lab-scene.js';
import { LIB_LAYOUTS, bookRect, librarySVG } from '../../src/scene/library-scene.js';
import { PART_NAMES, POSES, rigSVG } from '../../src/scene/rig.js';
import { ALL_BOOKS, BOOK_SHELVES } from '../../src/data/books.js';

test('both lab layouts hold exactly 40 seats with no overlap', () => {
  for (const L of Object.values(LAB_LAYOUTS)) {
    const G = labGeometry(L);
    assert.equal(G.count, 40);
    const spots = new Set();
    for (let n = 1; n <= 40; n++) {
      const s = G.seat(n);
      assert.ok(s.cx > 0 && s.cx < G.W && s.dy > G.wall && s.laneY < G.H, `seat ${n} inside the room`);
      spots.add(s.cx + ',' + s.dy);
    }
    assert.equal(spots.size, 40);
  }
});

test('lab scene renders every seat and the path ends at the chosen seat', () => {
  const seats = Array.from({ length: 40 }, (_, i) => ({ n: i + 1, state: 'free' }));
  const svg = labSVG({ seats, selected: 7 });
  for (let n = 1; n <= 40; n++) assert.ok(svg.includes(`id="seat-${n}"`));
  const G = labGeometry(LAB_LAYOUTS.desktop),
    path = pathToSeat(G, G.start, 23),
    end = path[path.length - 1];
  assert.deepEqual(end, [G.seat(23).cx, G.seat(23).laneY]);
});

test('character rig exposes every named part in both views', () => {
  for (const v of ['front', 'back']) {
    const svg = rigSVG(v);
    for (const p of PART_NAMES) assert.ok(svg.includes(`data-part="${p}"`), `${v} has ${p}`);
  }
  for (const [name, fn] of Object.entries(POSES)) assert.ok(['front', 'back'].includes(fn(0).view), name);
});

test('library has 72 books with unique ids that fit on their shelves', () => {
  assert.equal(ALL_BOOKS.length, 72);
  assert.equal(new Set(ALL_BOOKS.map(b => b.id)).size, 72);
  const L = LIB_LAYOUTS.desktop;
  BOOK_SHELVES.forEach((sh, ci) =>
    sh.books.forEach(b => {
      const r = bookRect(L, b, ci);
      assert.ok(r.x >= L.cases[ci] && r.x + r.w <= L.cases[ci] + L.caseW, b.id + ' inside its bookcase');
    }),
  );
  const svg = librarySVG({ shelves: BOOK_SHELVES, states: {} });
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|#)/.test(svg), 'no unescaped ampersands');
});
