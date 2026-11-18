/**
 * Exports the OURCAMPUS scene artwork as standalone, layered SVG files for
 * Figma and Rive:  node scripts/export-design.mjs
 *
 * Everything is generated from the same builders the app uses, so the files
 * always match what students see. Output: design/rive-assets/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { kidSVG, rigSVG, KID_COLORS } from '../src/scene/rig.js';
import { SCENE_DARK, SCENE_LIGHT } from '../src/scene/palette.js';
import { LAB_LAYOUTS, labGeometry, labSVG, seatSVG, KID_SCALE_LAB } from '../src/scene/lab-scene.js';
import {
  LIB_LAYOUTS,
  bookRect,
  bookSVG,
  bookcaseSVG,
  heldBookSVG,
  librarySVG,
} from '../src/scene/library-scene.js';
import { confettiSVG } from '../src/scene/fx.js';
import { BOOK_SHELVES, bookById } from '../src/data/books.js';

const OUT = join(
  dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..',
  'design',
  'rive-assets',
);
let count = 0;
const write = (rel, svg) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
  count++;
};
/** strip runtime-only attributes (event handlers, aria, data-*) so design tools get clean layers */
const clean = s =>
  s
    .replace(/ on(click|keydown)="[^"]*"/g, '')
    .replace(/ (role|tabindex|aria-label|class)="[^"]*"/g, '')
    .replace(/ data-[a-z-]+(="[^"]*")?/g, '')
    .replace(/ style="display:none"/g, ' visibility="hidden"');
const svgDoc = (vb, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${vb.split(' ')[2]}" height="${vb.split(' ')[3]}"><title>${title}</title>${clean(body)}</svg>`;

/* ---------------- character ---------------- */
write(
  'character/student-rig-front.svg',
  svgDoc('-40 -110 80 118', rigSVG('front'), 'OURCAMPUS student — front rig (named parts)'),
);
write(
  'character/student-rig-back.svg',
  svgDoc('-40 -110 80 118', rigSVG('back'), 'OURCAMPUS student — back rig (named parts)'),
);
const book = bookById('B-014');
const held = heldBookSVG(book);
const POSE_FILES = [
  ['lab-01-standing-at-entrance', 'wave'],
  ['lab-02-walking', 'walk'],
  ['lab-03-turning-to-seat', 'turn'],
  ['lab-04-preparing-to-sit', 'prepare'],
  ['lab-05-sitting', 'sit'],
  ['lab-06-using-computer', 'type'],
  ['lab-07-celebrating', 'cheer'],
  ['library-01-standing-at-entrance', 'stand'],
  ['library-02-walking-to-shelf', 'walk'],
  ['library-03-looking-at-books', 'browse'],
  ['library-04-reaching-for-book', 'reach'],
  ['library-05-pulling-book-out', 'pull', true],
  ['library-06-holding-book', 'hold', true],
  ['library-07-walking-with-book', 'carry', true],
  ['library-08-at-issue-counter', 'give', true],
];
for (const [name, pose, withBook] of POSE_FILES)
  write(
    `character/poses/${name}.svg`,
    svgDoc(
      '-50 -125 100 135',
      kidSVG({ pose, t: 0.35, holding: withBook ? held : '' }),
      `Student pose: ${name}`,
    ),
  );

/* ---------------- lab components ---------------- */
for (const [theme, C] of [
  ['light', SCENE_LIGHT],
  ['dark', SCENE_DARK],
]) {
  const G = labGeometry({ rows: 1, perSide: 1, unit: 100, aisle: 0, margin: 0 });
  for (const st of ['free', 'occupied', 'requested', 'unavailable', 'mine', 'selected'])
    write(
      `lab/components/${theme}/seat-${st}.svg`,
      svgDoc(
        `0 ${G.seat(1).dy - 24} 100 126`,
        seatSVG(G.seat(1), st === 'selected' ? 'free' : st, C, {
          selected: st === 'selected',
          interactive: false,
        }),
        `Seat component — ${st}`,
      ),
    );
}

/* ---------------- lab screens ---------------- */
function seats(extra = {}) {
  const busy = {
    3: 'occupied',
    7: 'occupied',
    12: 'occupied',
    15: 'requested',
    22: 'requested',
    39: 'unavailable',
    40: 'unavailable',
  };
  return Array.from({ length: 40 }, (_, i) => ({ n: i + 1, state: extra[i + 1] || busy[i + 1] || 'free' }));
}
function passCard(x, y, w, seat, C) {
  return `<g id="lab-pass"><rect x="${x}" y="${y}" width="${w}" height="120" rx="22" fill="#e8f7f5" stroke="#b3e2db" stroke-width="3"/>
<rect x="${x}" y="${y}" width="104" height="120" rx="22" fill="#0e9f9a"/><rect x="${x + 80}" y="${y}" width="24" height="120" fill="#0e9f9a"/>
<text x="${x + 52}" y="${y + 36}" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="900" fill="#fff" letter-spacing="1">SEAT</text>
<text x="${x + 52}" y="${y + 84}" text-anchor="middle" font-family="Inter, sans-serif" font-size="46" font-weight="900" fill="#fff">${seat}</text>
<text x="${x + 124}" y="${y + 34}" font-family="Inter, sans-serif" font-size="11" font-weight="900" fill="#0e9f9a" letter-spacing="1">COMPUTER LAB · TODAY</text>
<text x="${x + 124}" y="${y + 64}" font-family="Inter, sans-serif" font-size="22" font-weight="900" fill="#0f4b47">Seat booked!</text>
<text x="${x + 124}" y="${y + 90}" font-family="Inter, sans-serif" font-size="13" font-weight="600" fill="#0f4b47">Ahmed Rashid · Valid for today only</text>
<rect x="${x + w - 92}" y="${y + 22}" width="74" height="74" rx="10" fill="#fff" stroke="${C.line}" stroke-width="1.5"/>
${[0, 1, 2, 3, 4, 5, 6]
  .map(r =>
    [0, 1, 2, 3, 4, 5, 6]
      .filter(
        c => (r * 7 + c * 3 + seat) % 3 === 0 || (r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2),
      )
      .map(
        c =>
          `<rect x="${x + w - 87 + c * 9.2}" y="${y + 27 + r * 9.2}" width="8.4" height="8.4" rx="1.5" fill="#18233c"/>`,
      )
      .join(''),
  )
  .join('')}
</g>`;
}
const SEAT = 14;
for (const kind of ['desktop', 'mobile'])
  for (const [theme, C] of [
    ['light', SCENE_LIGHT],
    ['dark', SCENE_DARK],
  ]) {
    const L = LAB_LAYOUTS[kind],
      G = labGeometry(L),
      s = G.seat(SEAT),
      vb = `0 0 ${G.W} ${G.H}`;
    const midX = (G.aisleX + s.cx) / 2;
    const frames = [
      ['01-lab-entrance', { kid: { x: G.start[0], y: G.start[1], pose: 'wave' }, seats: seats() }],
      [
        '02-seat-selection',
        { kid: { x: G.start[0], y: G.start[1], pose: 'turn' }, seats: seats(), selected: SEAT },
      ],
      [
        '03-walking-preview',
        {
          kid: { x: midX, y: s.laneY, pose: 'walk', flip: s.cx < G.aisleX ? -1 : 1, t: 0.15 },
          seats: seats(),
          selected: SEAT,
        },
      ],
      [
        '04-sitting-using-computer',
        { kid: { x: s.cx, y: s.sitY, pose: 'type', sitAt: SEAT }, seats: seats(), selected: SEAT, lit: SEAT },
      ],
      [
        '05-booking-success',
        {
          kid: { x: s.cx, y: s.laneY, pose: 'cheer', t: 0.2 },
          seats: seats({ [SEAT]: 'mine' }),
          extra:
            confettiSVG(s.cx, s.dy, C, true) +
            passCard(
              kind === 'mobile' ? 14 : G.W - 470,
              kind === 'mobile' ? G.H - 150 : 148,
              kind === 'mobile' ? G.W - 28 : 450,
              SEAT,
              C,
            ),
        },
      ],
    ];
    for (const [name, f] of frames)
      write(
        `lab/screens/${kind}-${theme}/${name}.svg`,
        svgDoc(
          vb,
          labSVG({ layout: L, C, interactive: false, ...f }).replace(/^<svg[^>]*>|<\/svg>$/g, ''),
          `Computer lab — ${name} (${kind}, ${theme})`,
        ),
      );
    write(
      `lab/components/${theme}/room-background-${kind}.svg`,
      svgDoc(
        vb,
        labSVG({ layout: L, C, seats: [], interactive: false }).replace(/^<svg[^>]*>|<\/svg>$/g, ''),
        `Computer lab room (${kind})`,
      ),
    );
  }

/* ---------------- library components ---------------- */
const SHELF = BOOK_SHELVES[0];
for (const [theme, C] of [
  ['light', SCENE_LIGHT],
  ['dark', SCENE_DARK],
]) {
  const L = LIB_LAYOUTS.desktop;
  const states = {};
  SHELF.books.forEach(b => (states[b.id] = b.out ? 'unavailable' : 'free'));
  write(
    `library/components/${theme}/bookshelf-with-books.svg`,
    svgDoc(
      `${L.cases[0] - 10} ${L.caseTop - 40} ${L.caseW + 20} 300`,
      bookcaseSVG(L, 0, SHELF.name, C) +
        SHELF.books.map(b => bookSVG(b, bookRect(L, b, 0), states[b.id], C, { interactive: false })).join(''),
      'Bookshelf with individual books',
    ),
  );
  const one = SHELF.books[1],
    r = { x: 10, y: 10, w: 26, h: one.height, base: 10 + one.height };
  for (const st of ['free', 'unavailable', 'mine', 'selected'])
    write(
      `library/components/${theme}/book-${st}.svg`,
      svgDoc(
        `0 -6 46 ${one.height + 28}`,
        bookSVG(one, r, st === 'selected' ? 'free' : st, C, {
          selected: st === 'selected',
          interactive: false,
        }),
        `Book component — ${st}`,
      ),
    );
  write(
    `library/components/${theme}/selected-book-in-hand.svg`,
    svgDoc('0 -50 30 30', heldBookSVG(one, C), 'Selected book (held)'),
  );
}

/* ---------------- library screens ---------------- */
for (const kind of ['desktop', 'mobile'])
  for (const [theme, C] of [
    ['light', SCENE_LIGHT],
    ['dark', SCENE_DARK],
  ]) {
    const L = LIB_LAYOUTS[kind],
      ci = 0,
      b = BOOK_SHELVES[0].books[13],
      r = bookRect(L, b, ci),
      bx = r.cx,
      vb = `0 0 ${L.W} ${L.H}`;
    const states = {};
    BOOK_SHELVES.flatMap(s => s.books).forEach(x => (states[x.id] = x.out ? 'unavailable' : 'free'));
    const base = {
      layout: L,
      shelves: BOOK_SHELVES,
      visible: kind === 'mobile' ? [0] : undefined,
      states,
      C,
      interactive: false,
    };
    const frames = [
      ['01-library-entrance', { kid: { x: L.start[0], y: L.start[1], pose: 'wave' } }],
      ['02-browsing-books', { kid: { x: bx, y: L.standY, pose: 'browse', t: 0.6 } }],
      ['03-book-selected', { kid: { x: bx, y: L.standY, pose: 'browse', t: 0.6 }, selected: b.id }],
      [
        '04-reaching-and-taking-book',
        { kid: { x: bx, y: L.standY, pose: 'pull', holdingBook: b }, taken: b.id },
      ],
      [
        '05-carrying-book',
        {
          kid: {
            x: (bx + L.corner) / 2,
            y: L.walkY,
            pose: 'carry',
            holdingBook: b,
            flip: L.corner < bx ? -1 : 1,
            t: 0.15,
          },
          taken: b.id,
        },
      ],
      [
        '06-reaching-issue-counter',
        { kid: { x: L.counterStand[0], y: L.counterStand[1], pose: 'give', holdingBook: b }, taken: b.id },
      ],
    ];
    for (const [name, f] of frames)
      write(
        `library/screens/${kind}-${theme}/${name}.svg`,
        svgDoc(
          vb,
          librarySVG({ ...base, ...f }).replace(/^<svg[^>]*>|<\/svg>$/g, ''),
          `Library — ${name} (${kind}, ${theme})`,
        ),
      );
  }

console.log(`Exported ${count} SVG files to ${OUT}`);
