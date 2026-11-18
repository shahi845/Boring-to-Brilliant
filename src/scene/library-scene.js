/* ==========================================================================
   LIBRARY scene — bookshelves with individually selectable books, an
   entrance, a walking path and the issue counter (pure SVG builder).
   ========================================================================== */
import { kidSVG, KID_COLORS } from './rig.js';
import { SCENE_LIGHT } from './palette.js';

export const LIB_LAYOUTS = {
  desktop: {
    W: 1000,
    H: 700,
    wall: 334,
    door: [22, 100],
    cases: [124, 396, 668],
    caseW: 250,
    caseTop: 92,
    counter: { x: 690, y: 508, w: 272 },
    walkY: 452,
    standY: 396,
    counterStand: [812, 662],
    corner: 646,
    start: [61, 384],
    kidScale: 1.1,
  },
  mobile: {
    W: 430,
    H: 760,
    wall: 334,
    door: [8, 78],
    cases: [96],
    caseW: 322,
    caseTop: 92,
    counter: { x: 196, y: 548, w: 226 },
    walkY: 452,
    standY: 396,
    counterStand: [306, 704],
    corner: 156,
    start: [43, 384],
    kidScale: 1.1,
  },
};

const LEVEL_H = 76;
const xesc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '');
/** Position of a book: shelves map to bookcases (mobile shows one case at a time). */
export function bookRect(L, book, caseIndex) {
  const cx = L.cases[caseIndex],
    slotW = (L.caseW - 24) / 8,
    w = slotW * book.width,
    base = L.caseTop + 12 + (book.level + 1) * LEVEL_H;
  return {
    x: cx + 12 + book.slot * slotW + (slotW - w) / 2,
    y: base - book.height,
    w,
    h: book.height,
    base,
    cx: cx + 12 + book.slot * slotW + slotW / 2,
  };
}

const BOOK_LABEL = { free: 'Available', unavailable: 'Issued — not available', mine: 'Requested by you' };

/** One reusable book component (spine view). */
export function bookSVG(
  book,
  r,
  state,
  C = SCENE_LIGHT,
  { selected = false, taken = false, interactive = true, located = false } = {},
) {
  const out = state === 'unavailable',
    fill = out ? C.state.unavailable : book.color;
  const lift = selected ? ' transform="translate(0 -8)"' : '';
  const act = interactive
    ? ` role="button" tabindex="0" onclick="libSceneBook('${book.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();libSceneBook('${book.id}')}"`
    : ' role="img"';
  return `<g class="book b-${state}${selected ? ' is-sel' : ''}" id="book-${book.id}" data-book="${book.id}" aria-label="${xesc(book.title)} by ${xesc(book.author)}: ${selected ? 'Selected' : BOOK_LABEL[state]}"${act}${taken ? ' style="opacity:0"' : ''}>
<g${lift}>
${selected ? `<rect x="${r.x - 4}" y="${r.y - 4}" width="${r.w + 8}" height="${r.h + 8}" rx="6" fill="${C.state.selected}55" stroke="${C.state.selected}" stroke-width="3"/>` : ''}
<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3" fill="${fill}" stroke="${C.line}" stroke-width="1.3"/>
<rect x="${r.x + 1.6}" y="${r.y + 6}" width="${r.w - 3.2}" height="3" fill="#ffffff" opacity="${out ? 0.3 : 0.6}"/>
<rect x="${r.x + 1.6}" y="${r.y + r.h - 10}" width="${r.w - 3.2}" height="3" fill="#ffffff" opacity="${out ? 0.3 : 0.6}"/>
<rect x="${r.x + r.w / 2 - 2.6}" y="${r.y + r.h / 2 - 9}" width="5.2" height="18" rx="2" fill="#ffffff" opacity="${out ? 0.25 : 0.42}"/>
${out ? `<path d="M${r.x + r.w / 2 - 4} ${r.y + 14} l8 8 m0 -8 l-8 8" stroke="${C.muted}" stroke-width="2" stroke-linecap="round"/>` : ''}
${state === 'mine' ? `<path d="M${r.x + r.w - 7} ${r.y - 1} h5 v13 l-2.5 -3 l-2.5 3 z" fill="${C.state.selected}" stroke="${C.line}" stroke-width="1"/>` : ''}
</g>${
    located
      ? `<g transform="translate(${r.x + r.w / 2} ${r.y - 12})" aria-hidden="true"><g class="locate-pin"><path d="M0 0 C-4 -6 -12 -10 -12 -19 A12 12 0 1 1 12 -19 C12 -10 4 -6 0 0 Z" fill="#ff4b4b" stroke="${C.line}" stroke-width="1.5"/><circle cy="-19" r="4.5" fill="#fff"/></g></g>`
      : ''
  }</g>`;
}

/** Bookcase frame with three shelf boards and a name sign. */
export function bookcaseSVG(L, i, name, C = SCENE_LIGHT) {
  const x = L.cases[i],
    w = L.caseW,
    top = L.caseTop,
    bottom = top + 12 + 3 * LEVEL_H + 8;
  const boards = [0, 1, 2]
    .map(
      k =>
        `<rect x="${x + 6}" y="${top + 12 + (k + 1) * LEVEL_H}" width="${w - 12}" height="8" rx="3" fill="${C.woodDark}" stroke="${C.line}" stroke-width="1.3"/>`,
    )
    .join('');
  return `<g id="bookshelf-${i + 1}">
<rect x="${x - 4}" y="${top - 6}" width="${w + 8}" height="${bottom - top + 14}" rx="12" fill="${C.woodDeep}" stroke="${C.line}" stroke-width="1.5"/>
<rect x="${x + 6}" y="${top + 6}" width="${w - 12}" height="${bottom - top - 6}" rx="6" fill="${C.woodDark}" opacity=".55"/>
${boards}
<rect x="${x + w / 2 - 74}" y="${top - 34}" width="148" height="22" rx="11" fill="${C.sign}"/>
<text x="${x + w / 2}" y="${top - 19}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="900" letter-spacing=".6" fill="#ffffff">${xesc(name.toUpperCase())}</text>
</g>`;
}

const LIBRARIAN = {
  ...KID_COLORS,
  hoodie: '#a56cf0',
  hoodieDark: '#8a52d6',
  hair: '#2b2236',
  lanyard: '#ffc800',
};

function counterSVG(L, C) {
  const { x, y, w } = L.counter;
  return `<g id="issue-counter">
<g id="librarian">${kidSVG({ x: x + w * 0.62, y: y + 22, scale: 1, pose: 'stand', C: LIBRARIAN })
    .replace(/ id="[^"]*"/g, '')
    .replace(/ data-(kid|part|slot|flip|viewwrap)(="[^"]*")?/g, '')}</g>
<rect x="${x}" y="${y}" width="${w}" height="26" rx="8" fill="${C.woodTop}" stroke="${C.line}" stroke-width="1.5"/>
<rect x="${x + 6}" y="${y + 22}" width="${w - 12}" height="54" rx="8" fill="${C.wood}" stroke="${C.line}" stroke-width="1.5"/>
<rect x="${x + w / 2 - 62}" y="${y + 38}" width="124" height="22" rx="11" fill="${C.sign}"/>
<text x="${x + w / 2}" y="${y + 53}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="900" letter-spacing=".8" fill="#ffffff">ISSUE COUNTER</text>
<g id="counter-props"><rect x="${x + 16}" y="${y - 10}" width="30" height="8" rx="2" fill="#ff6b6b" stroke="${C.line}" stroke-width="1"/><rect x="${x + 19}" y="${y - 18}" width="26" height="8" rx="2" fill="#1cb0f6" stroke="${C.line}" stroke-width="1"/>
<path d="M${x + w - 34} ${y - 2} a9 9 0 0 1 18 0 z" fill="${C.state.selected}" stroke="${C.line}" stroke-width="1.2"/><rect x="${x + w - 37}" y="${y - 3}" width="24" height="4" rx="2" fill="${C.metal}"/></g>
</g>`;
}

function roomSVG(L, C) {
  const { W, H, wall, door } = L;
  const tiles = [];
  for (let y = wall + 44; y < H; y += 44)
    tiles.push(`<path d="M0 ${y} H${W}" stroke="${C.floorLine}" stroke-width="2"/>`);
  for (let x = 50; x < W; x += 100)
    tiles.push(`<path d="M${x} ${wall} V${H}" stroke="${C.floorLine}" stroke-width="2"/>`);
  const [dl, dr] = door,
    dc = (dl + dr) / 2;
  return `<g id="room-background">
<rect width="${W}" height="${H}" fill="${C.floor}"/>${tiles.join('')}
<rect width="${W}" height="${wall}" fill="${C.wall}"/>
<path d="M0 46 H${W}" stroke="${C.wallLine}" stroke-width="3"/>
<rect y="${wall - 10}" width="${W}" height="10" fill="${C.base}"/>
<g id="entrance-door"><rect x="${dl}" y="${wall - 178}" width="${dr - dl}" height="178" rx="8" fill="${C.doorDark}" stroke="${C.line}" stroke-width="1.5"/>
<rect x="${dl + 7}" y="${wall - 170}" width="${dr - dl - 14}" height="170" rx="4" fill="${C.doorway}"/>
<path d="M${dl + 7} ${wall - 170} L${dl - 6} ${wall - 162} V${wall + 6} L${dl + 7} ${wall}" fill="${C.door}" stroke="${C.line}" stroke-width="1.5" stroke-linejoin="round"/>
<rect x="${dc - 34}" y="${wall - 200}" width="68" height="18" rx="9" fill="${C.sign}"/><text x="${dc}" y="${wall - 187}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="9.5" font-weight="900" letter-spacing=".8" fill="#ffffff">LIBRARY</text></g>
<g id="walking-path"><rect x="${dl + 4}" y="${wall + 8}" width="${dr - dl - 8}" height="${L.walkY - wall + 10}" rx="14" fill="${C.rug}" opacity=".7"/>
<rect x="${dl + 4}" y="${L.walkY - 18}" width="${L.corner - dl + 22}" height="36" rx="18" fill="${C.rug}" opacity=".7"/>
<rect x="${L.corner - 18}" y="${L.walkY - 18}" width="36" height="${L.counterStand[1] - L.walkY + 34}" rx="18" fill="${C.rug}" opacity=".7"/>
<rect x="${L.corner - 18}" y="${L.counterStand[1] - 16}" width="${L.counterStand[0] - L.corner + 50}" height="34" rx="17" fill="${C.rug}" opacity=".7"/></g>
<g id="plant"><rect x="${W - 46}" y="${wall - 30}" width="24" height="22" rx="5" fill="${C.pot}"/><ellipse cx="${W - 40}" cy="${wall - 40}" rx="9" ry="14" fill="${C.plant}"/><ellipse cx="${W - 28}" cy="${wall - 42}" rx="8" ry="13" fill="${C.plantDark}"/></g>
</g>`;
}

/**
 * Whole library scene.
 * shelves: BOOK_SHELVES; states: {bookId: 'free'|'unavailable'|'mine'};
 * visible: indexes of shelves drawn (mobile shows one); taken: book id in hand.
 */
export function librarySVG({
  layout = LIB_LAYOUTS.desktop,
  shelves,
  visible,
  states,
  selected = '',
  located = '',
  taken = '',
  kid,
  C = SCENE_LIGHT,
  interactive = true,
  extra = '',
}) {
  if (kid && kid.holdingBook) kid = { ...kid, holding: heldBookSVG(kid.holdingBook, C) };
  const L = layout;
  const vis = visible || shelves.map((_, i) => i).slice(0, L.cases.length);
  const cases = vis
    .map((si, ci) => {
      const sh = shelves[si];
      return (
        bookcaseSVG(L, ci, sh.name, C) +
        `<g id="books-${sh.id}">${sh.books
          .map(b =>
            bookSVG(b, bookRect(L, b, ci), states[b.id] || 'free', C, {
              selected: b.id === selected,
              taken: b.id === taken,
              interactive,
              located: b.id === located,
            }),
          )
          .join('')}</g>`
      );
    })
    .join('');
  return `<svg class="scene-svg" viewBox="0 0 ${L.W} ${L.H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Library with bookshelves and an issue counter">
${roomSVG(L, C)}
<g id="bookshelves">${cases}</g>
${counterSVG(L, C)}
<g id="walker">${kid ? kidSVG({ ...kid, scale: L.kidScale }) : ''}</g>
<g id="fx">${extra}</g>
</svg>`;
}

/** Book held in the student's hand (drawn in the hand's local coordinates). */
export function heldBookSVG(book, C = SCENE_LIGHT) {
  return `<g id="selected-book"><rect x="5" y="-46" width="18" height="23" rx="2.5" fill="${book.color}" stroke="${C.line}" stroke-width="1.3"/><rect x="5" y="-46" width="4" height="23" rx="1.5" fill="#000" opacity=".15"/><rect x="11" y="-41" width="9" height="3" rx="1.5" fill="#fff" opacity=".75"/><rect x="11" y="-36" width="7" height="2.4" rx="1.2" fill="#fff" opacity=".5"/></g>`;
}
