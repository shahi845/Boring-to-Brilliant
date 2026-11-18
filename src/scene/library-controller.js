/* ==========================================================================
   LIBRARY — interactive book issuing scene (runtime).
   Flow: entrance → tap a book → walk to the shelf → look → reach → pull the
   book out → carry it → issue counter → request issue → celebration + slip.
   ctx.states() → {bookId: state}   ctx.issue(book) → request | error string
   ctx.slipHTML(book, request) → HTML    ctx.bookCard(book, state) → HTML
   ========================================================================== */
import { Kid } from './rig.js';
import { LIB_LAYOUTS, bookRect, heldBookSVG, librarySVG } from './library-scene.js';
import { scenePalette } from './palette.js';
import { busyWhile, confettiSVG, onSceneEnvChange } from './fx.js';
import { BOOK_SHELVES, bookById } from '../data/books.js';

const ui = { book: '', phase: 'idle', shelf: 0, taken: '', req: null, busy: false, step: '' };
const kid = new Kid();
let ctx = null,
  key = '',
  L = null,
  host = null;

export function librarySceneMarkup(c) {
  ctx = c;
  setTimeout(mountLibrary, 0);
  return `<div class="scene-wrap lib-wrap"><div class="scene-chips" id="libChips"></div><div class="scene-stage"><div class="scene" id="libScene"></div></div><div class="scene-panel" id="libPanel" aria-live="polite"></div></div>`;
}

/* Desktop shows the shelves three at a time (one aisle), phones one shelf at a time. */
const PER_AISLE = 3;
const aisleOf = i => Math.floor(i / PER_AISLE);
const visible = () => {
  if (key === 'mobile') return [ui.shelf];
  const a = aisleOf(ui.shelf) * PER_AISLE;
  return BOOK_SHELVES.map((_, i) => i).slice(a, a + PER_AISLE);
};
const shelfIndexOf = book => BOOK_SHELVES.findIndex(s => s.id === book.shelfId);
const caseIndexOf = book => visible().indexOf(shelfIndexOf(book));

export function mountLibrary() {
  host = document.getElementById('libScene');
  if (!host || !ctx) return;
  key = host.clientWidth < 600 ? 'mobile' : 'desktop';
  L = LIB_LAYOUTS[key];
  kid.scale = L.kidScale;
  ui.busy = false;
  // an interrupted animation resumes at the nearest calm state
  if (['walking', 'browsing', 'reaching', 'carrying'].includes(ui.phase)) {
    ui.phase = ui.taken ? 'counter' : 'selected';
  }
  if (ui.phase === 'counter' || ui.phase === 'done') {
    kid.place(...L.counterStand).pose(ui.phase === 'done' ? 'hold' : 'give');
  } else {
    kid.place(...L.start).pose(ui.phase === 'selected' ? 'stand' : 'wave');
    kid.flip = 1;
  }
  paint();
}

function paint() {
  if (!host) return;
  const C = scenePalette();
  host.innerHTML = librarySVG({
    layout: L,
    shelves: BOOK_SHELVES,
    visible: visible(),
    states: ctx.states(),
    selected: ui.phase === 'selected' ? ui.book : '',
    located: ui.phase === 'selected' ? ui.located : '',
    taken: ui.taken,
    kid: { x: kid.x, y: kid.y, pose: kid.poseName, flip: kid.flip },
    C,
  });
  kid.bind(host.querySelector('[data-kid]'));
  if (ui.taken) kid.hold(heldBookSVG(bookById(ui.taken), C));
  chips();
  panel();
}

function chips() {
  const el = document.getElementById('libChips');
  if (!el) return;
  if (key === 'mobile')
    el.innerHTML = BOOK_SHELVES.map(
      (s, i) =>
        `<button type="button" class="chip ${i === ui.shelf ? 'on' : ''}" aria-pressed="${i === ui.shelf}" onclick="libSceneShelf(${i})">${s.id} · ${s.name}</button>`,
    ).join('');
  else {
    const aisles = Math.ceil(BOOK_SHELVES.length / PER_AISLE);
    el.innerHTML =
      aisles > 1
        ? Array.from({ length: aisles }, (_, a) => {
            const sh = BOOK_SHELVES.slice(a * PER_AISLE, a * PER_AISLE + PER_AISLE),
              on = aisleOf(ui.shelf) === a;
            return `<button type="button" class="chip ${on ? 'on' : ''}" aria-pressed="${on}" onclick="libSceneShelf(${a * PER_AISLE})">Aisle ${a + 1} · ${sh.map(x => x.id).join(', ')} — ${sh.map(x => x.name).join(', ')}</button>`;
          }).join('')
        : '';
  }
}

const STEPS = [
  ['walking', '🚶', 'Walk'],
  ['browsing', '👀', 'Look'],
  ['reaching', '✋', 'Take'],
  ['carrying', '📖', 'Carry'],
  ['counter', '🛎️', 'Counter'],
];
function journey() {
  const at = STEPS.findIndex(s => s[0] === ui.phase);
  return `<div class="scene-steps">${STEPS.map(([k, i, l], n) => `<span class="${n < at ? 'done' : n === at ? 'cur' : ''}"><b>${n < at ? '✓' : i}</b>${l}</span>`).join('')}</div>`;
}

function panel() {
  const el = document.getElementById('libPanel');
  if (!el) return;
  const b = ui.book && bookById(ui.book);
  const st = ctx.states();
  if (ui.phase === 'idle')
    el.innerHTML = `<div class="sp-row"><span class="sp-emoji">📚</span><div><b>Tap a book on the shelf</b><div class="muted">Your student walks over, takes it down and carries it to the issue counter.</div></div></div>${legend()}`;
  else if (ui.phase === 'selected') el.innerHTML = ctx.bookCard(b, st[b.id] || 'free');
  else if (ui.phase === 'counter')
    el.innerHTML = `${journey()}<div class="sp-row"><span class="sp-book" style="background:${b.color}"></span><div class="grow"><b>At the issue counter with “${b.title}”</b><div class="muted">${b.id} · ${b.shelf} · the Librarian confirms and hands it over.</div></div></div>
<div class="formactions" style="margin-top:12px"><button type="button" class="btn primary" onclick="libSceneIssue()">Request issue</button><button type="button" class="btn" onclick="libScenePutBack()">Put it back</button></div>`;
  else if (ui.phase === 'done') el.innerHTML = ctx.slipHTML(b, ui.req);
  else
    el.innerHTML = `${journey()}<div class="sp-row"><span class="sp-emoji sp-bounce">${STEPS.find(s => s[0] === ui.phase)?.[1] || '📖'}</span><div><b>${ui.step}</b><div class="muted">${b ? '“' + b.title + '” · ' + b.id : ''}</div></div></div>`;
}

function legend() {
  const C = scenePalette().state;
  return `<div class="legend scene-legend">${[
    ['free', 'Available'],
    ['unavailable', 'Issued'],
    ['selected', 'Selected / yours'],
  ]
    .map(([k, l]) => `<span><i style="background:${C[k]}"></i>${l}</span>`)
    .join('')}</div>`;
}

function setStep(phase, text) {
  ui.phase = phase;
  ui.step = text;
  panel();
}

export function libSceneShelf(i) {
  if (ui.busy || ui.taken) return;
  ui.shelf = i;
  if (ui.phase === 'selected' && !visible().includes(shelfIndexOf(bookById(ui.book)))) {
    ui.phase = 'idle';
    ui.book = '';
  }
  paint();
}

/**
 * OPAC: show where a book is. Switches to its shelf, highlights it with a
 * location pin, scrolls the room into view and opens its details card.
 */
export function libSceneLocate(id) {
  const b = bookById(id);
  if (!b || !host) return;
  if (ui.busy || ui.taken) return 'busy';
  ui.shelf = shelfIndexOf(b);
  ui.book = id;
  ui.phase = 'selected';
  ui.located = id;
  if (kid.poseName === 'wave') kid.pose('stand');
  paint();
  document.getElementById('libScene')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => host?.querySelector('#book-' + id)?.focus({ preventScroll: true }), 400);
}
/** A book was tapped on the shelf. */
export function libSceneBook(id) {
  if (ui.busy || ui.taken) return;
  ui.book = id;
  ui.located = '';
  ui.phase = 'selected';
  if (kid.poseName === 'wave') kid.pose('stand');
  paint();
}

export function libSceneClose() {
  if (ui.busy) return;
  ui.book = '';
  ui.phase = 'idle';
  paint();
}

function flyBook(book, from, to, ms) {
  const C = scenePalette(),
    fx = host.querySelector('#fx');
  fx.innerHTML = `<g id="flying-book"><rect x="${-from.w / 2}" y="${-from.h}" width="${from.w}" height="${from.h}" rx="3" fill="${book.color}" stroke="${C.line}" stroke-width="1.3"/><rect x="${-from.w / 2 + 1.6}" y="${-from.h + 6}" width="${from.w - 3.2}" height="3" fill="#fff" opacity=".6"/></g>`;
  const g = fx.firstElementChild;
  return new Promise(res => {
    if (kid.instant) {
      fx.innerHTML = '';
      return res();
    }
    const t0 = performance.now();
    const f = now => {
      const k = Math.min(1, (now - t0) / ms),
        e = 1 - (1 - k) ** 3,
        x = from.x + (to.x - from.x) * e,
        y = from.y + (to.y - from.y) * e - Math.sin(k * Math.PI) * 26,
        s = 1 - 0.45 * e,
        r = -70 * e;
      g.setAttribute('transform', `translate(${x} ${y}) rotate(${r}) scale(${s})`);
      if (k < 1 && g.isConnected) requestAnimationFrame(f);
      else {
        fx.innerHTML = '';
        res();
      }
    };
    requestAnimationFrame(f);
  });
}

/** “Get this book” — the whole walk / take / carry sequence. */
export async function libSceneGo() {
  if (ui.busy || ui.phase !== 'selected') return;
  const book = bookById(ui.book),
    state = ctx.states()[book.id] || 'free';
  if (state !== 'free') return;
  ui.busy = true;
  try {
    await busyWhile(async () => {
      const ci = caseIndexOf(book),
        r = bookRect(L, book, ci),
        bx = Math.min(Math.max(r.cx, L.cases[ci] + 24), L.cases[ci] + L.caseW - 24);
      setStep('walking', 'Walking to the ' + book.shelf + ' shelf…');
      kid.pose('stand');
      await kid.walk(
        [
          [kid.x, L.walkY],
          [bx, L.walkY],
          [bx, L.standY],
        ],
        { speed: 210 },
      );
      setStep('browsing', 'Looking at the books…');
      await kid.turn('browse', 1);
      await kid.wait(900);
      setStep('reaching', 'Reaching for the book…');
      kid.pose('reach');
      await kid.wait(450);
      // the book slides out of the shelf and flies into the student's hand
      const el = host.querySelector(`#book-${book.id}`);
      if (el) el.style.opacity = '0';
      ui.taken = book.id;
      kid.pose('pull');
      await flyBook(
        book,
        { x: r.x + r.w / 2, y: r.base, w: r.w, h: r.h },
        { x: kid.x + 14, y: kid.y - 64 * L.kidScale },
        520,
      );
      kid.hold(heldBookSVG(book, scenePalette()));
      await kid.wait(200);
      await kid.turn('hold', 1);
      await kid.wait(350);
      setStep('carrying', 'Carrying the book to the issue counter…');
      await kid.walk([[bx, L.walkY], [L.corner, L.walkY], [L.corner, L.counterStand[1]], L.counterStand], {
        speed: 200,
        pose: 'carry',
      });
      await kid.turn('give', 1);
    });
    setStep('counter', '');
  } finally {
    ui.busy = false;
    panel();
  }
}

export async function libSceneIssue() {
  if (ui.busy || ui.phase !== 'counter') return;
  const book = bookById(ui.book),
    r = ctx.issue(book);
  if (typeof r === 'string') return;
  ui.req = r;
  ui.busy = true;
  ui.phase = 'done';
  panel();
  try {
    await busyWhile(async () => {
      await kid.turn('cheer', 1);
      host.querySelector('#fx').innerHTML = confettiSVG(kid.x, kid.y - 90, scenePalette());
      await kid.wait(2400);
      host.querySelector('#fx').innerHTML = '';
      kid.pose('hold');
    });
  } finally {
    ui.busy = false;
    panel();
  }
}

/** Return the book to the shelf and walk back to the entrance. */
export async function libScenePutBack() {
  if (ui.busy) return;
  ui.busy = true;
  try {
    await busyWhile(async () => {
      kid.hold('');
      ui.taken = '';
      ui.book = '';
      ui.phase = 'idle';
      paint();
      await kid.turn('stand', -1);
      await kid.walk([[L.corner, L.counterStand[1]], [L.corner, L.walkY], [L.start[0], L.walkY], L.start], {
        speed: 220,
      });
      kid.flip = 1;
      kid.pose('wave');
    });
  } finally {
    ui.busy = false;
    panel();
  }
}

/** Start over after a successful request (from the slip). */
export function libSceneAgain() {
  if (ui.busy) return;
  Object.assign(ui, { book: '', phase: 'idle', taken: '', req: null });
  kid.hold('');
  kid.place(...L.start).pose('wave');
  kid.flip = 1;
  paint();
}

onSceneEnvChange(() => {
  if (!document.getElementById('libScene') || ui.busy) return;
  mountLibrary();
});
