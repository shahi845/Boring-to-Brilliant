/* ==========================================================================
   CLASSROOM — benches with one location pin per student (pure SVG builder).
   Each pin shows the student's photo (or an illustrated avatar) and their
   attendance state. Bench size is configurable (CLASS_LAYOUT.perBench).
   ========================================================================== */
import { SCENE_LIGHT } from './palette.js';

export const CLASS_LAYOUT = { perBench: 3, cols: 2, seatW: 66, aisle: 54, margin: 20, rowH: 112, top: 150 };

export function classGeometry(L, nSeats) {
  const perRow = L.perBench * L.cols,
    rows = Math.max(1, Math.ceil(nSeats / perRow)),
    benchW = L.perBench * L.seatW,
    W = L.margin * 2 + L.cols * benchW + (L.cols - 1) * L.aisle,
    H = L.top + rows * L.rowH + 8;
  const seat = i => {
    const bench = Math.floor(i / L.perBench),
      pos = i % L.perBench,
      row = Math.floor(bench / L.cols),
      col = bench % L.cols,
      bx = L.margin + col * (benchW + L.aisle);
    return {
      i,
      bench,
      row,
      col,
      x: bx + pos * L.seatW + L.seatW / 2,
      y: L.top + row * L.rowH + 62,
      bx,
      benchW,
    };
  };
  return { W, H, rows, seats: rows * perRow, benchW, seat };
}

/** Pad the seat list so every bench row is full. */
export const fullRows = (n, L = CLASS_LAYOUT) =>
  Math.max(1, Math.ceil(n / (L.perBench * L.cols))) * L.perBench * L.cols;

const SKIN = ['#f6c7a1', '#e9b48a', '#d29a6e', '#b97d55', '#f3d2b3'];
const HAIR = ['#3a2a35', '#2b2236', '#5a3a28', '#1d1a24', '#6b4a33'];
const BG = ['#d7f3ee', '#e1ecff', '#ffe9d6', '#f0e4ff', '#fff3c4', '#ffe1e6'];

/** Profile picture: the student's photo if one is set, otherwise an illustrated face. */
export function faceSVG(s, r = 18, uid = '') {
  const id = 'av' + uid + s.id;
  if (s.photo)
    return `<clipPath id="${id}"><circle r="${r}"/></clipPath><image href="${s.photo}" x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`;
  const n = s.id * 7 + 3,
    skin = SKIN[n % SKIN.length],
    hair = HAIR[(n >> 1) % HAIR.length],
    bg = BG[s.id % BG.length],
    style = (s.id * 5) % 3,
    k = r / 18;
  const hairPath =
    style === 0
      ? `M${-12 * k} ${-3 * k} q${-1 * k} ${-12 * k} ${12 * k} ${-12 * k} q${13 * k} 0 ${12 * k} ${12 * k} q${-5 * k} ${-6 * k} ${-12 * k} ${-5 * k} q${-4 * k} ${4 * k} ${-12 * k} ${5 * k} z`
      : style === 1
        ? `M${-12.5 * k} ${-1 * k} q${-2 * k} ${-14 * k} ${12.5 * k} ${-14 * k} q${14 * k} 0 ${12.5 * k} ${14 * k} q${-8 * k} ${-9 * k} ${-21 * k} ${-4 * k} z`
        : `M${-12 * k} ${-2 * k} q0 ${-13 * k} ${12 * k} ${-13 * k} q${12 * k} 0 ${12 * k} ${13 * k} l${-3 * k} ${-4 * k} l${-3 * k} ${3 * k} l${-3 * k} ${-4 * k} l${-3 * k} ${3 * k} l${-3 * k} ${-4 * k} l${-3 * k} ${3 * k} l${-3 * k} ${-4 * k} z`;
  return `<clipPath id="${id}"><circle r="${r}"/></clipPath><g clip-path="url(#${id})"><circle r="${r}" fill="${bg}"/>
<path d="M${-11 * k} ${r} q0 ${-9 * k} ${11 * k} ${-9 * k} q${11 * k} 0 ${11 * k} ${9 * k} z" fill="#0e9f9a"/>
<rect x="${-3 * k}" y="${6 * k}" width="${6 * k}" height="${5 * k}" fill="${skin}"/>
<circle cy="${-1 * k}" r="${11 * k}" fill="${skin}"/>
<path d="${hairPath}" fill="${hair}"/>
<circle cx="${-4 * k}" cy="${0}" r="${1.4 * k}" fill="#213049"/><circle cx="${4 * k}" cy="0" r="${1.4 * k}" fill="#213049"/>
<path d="M${-3 * k} ${4.5 * k} q${3 * k} ${3 * k} ${6 * k} 0" fill="none" stroke="#213049" stroke-width="${1.3 * k}" stroke-linecap="round"/></g>`;
}

export const PIN_STATE = {
  unmarked: { ring: '#9aa7bd', label: 'Not marked yet', icon: '' },
  present: { ring: '#22b98b', label: 'Present', icon: '✓' },
  absent: { ring: '#ff4b4b', label: 'Absent', icon: '✕' },
  late: { ring: '#ff9600', label: 'Late', icon: '⏰' },
  leave: { ring: '#a56cf0', label: 'On approved leave', icon: '🌙' },
  medical: { ring: '#ff86b6', label: 'Medical (verified)', icon: '✚' },
  outside: { ring: '#1cb0f6', label: 'Outside campus', icon: '🚶' },
};

const first = n => String(n).split(' ')[0].slice(0, 10);
const xesc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** Location pin with the student's face inside. */
export function pinSVG(
  s,
  x,
  y,
  state,
  C = SCENE_LIGHT,
  { selected = false, interactive = true, arrange = false } = {},
) {
  const P = PIN_STATE[state] || PIN_STATE.unmarked,
    dim = state === 'absent' || state === 'leave' || state === 'medical' || state === 'outside';
  const act = interactive
    ? ` role="button" tabindex="0" onpointerdown="pinDown(event,${s.id})" onpointerup="pinUp(event,${s.id})" onpointerleave="pinCancel()" onpointercancel="pinCancel()" oncontextmenu="return false" onkeydown="pinKey(event,${s.id})"`
    : ' role="img"';
  return `<g class="pin p-${state}${selected ? ' is-sel' : ''}${arrange ? ' arranging' : ''}" id="pin-${s.id}" data-sid="${s.id}" transform="translate(${x} ${y})" aria-label="${xesc(s.name)}, roll ${xesc(s.roll || '')}: ${P.label}${arrange ? '. Tap to move' : '. Tap to mark absent or present, hold for details'}"${act}>
<ellipse cx="0" cy="2" rx="12" ry="3.5" fill="${C.shadow}"/>
<g class="pin-body">
${selected ? `<circle cy="-36" r="30" fill="${C.state.selected}55" stroke="${C.state.selected}" stroke-width="3"/>` : ''}
<path d="M0 0 C-6 -10 -24 -19 -24 -36 A24 24 0 1 1 24 -36 C24 -19 6 -10 0 0 Z" fill="${P.ring}" stroke="${C.line}" stroke-width="1.6" stroke-linejoin="round"/>
<g transform="translate(0 -36)"${dim ? ' opacity=".55"' : ''}>${faceSVG(s, 19)}</g>
${state === 'absent' ? `<path d="M-11 -47 l22 22 M11 -47 l-22 22" stroke="#ff4b4b" stroke-width="4" stroke-linecap="round" opacity=".9"/>` : ''}
${P.icon ? `<g transform="translate(18 -56)"><circle r="10" fill="#fff" stroke="${P.ring}" stroke-width="2.5"/><text y="4" text-anchor="middle" font-size="${P.icon.length > 1 ? 10 : 12}" font-weight="900" fill="${P.ring}" font-family="Inter, system-ui, sans-serif">${P.icon}</text></g>` : ''}
</g>
<text y="18" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800" fill="${C.ink}">${xesc(first(s.name))}</text>
</g>`;
}

function emptySeatSVG(i, x, y, C, arrange, selected) {
  const act = arrange
    ? ` role="button" tabindex="0" aria-label="Empty seat — tap to move the chosen student here" onclick="seatPick(${i})" onkeydown="if(event.key==='Enter')seatPick(${i})"`
    : ' aria-hidden="true"';
  return `<g class="empty-seat${arrange ? ' arranging' : ''}" transform="translate(${x} ${y})"${act}><circle cy="-30" r="16" fill="${selected ? C.state.selected + '55' : 'transparent'}" stroke="${C.muted}" stroke-width="2" stroke-dasharray="4 4" opacity=".6"/><text y="-26" text-anchor="middle" font-size="12" fill="${C.muted}" font-family="Inter, system-ui, sans-serif">+</text></g>`;
}

function roomSVG(G, C, cls) {
  const { W } = G,
    bw = Math.min(260, W * 0.5);
  return `<g id="classroom-background">
<rect width="${W}" height="${G.H}" fill="${C.floor}"/>
<rect width="${W}" height="96" fill="${C.wall}"/><rect y="88" width="${W}" height="8" fill="${C.base}"/>
<g id="blackboard"><rect x="${(W - bw) / 2}" y="14" width="${bw}" height="60" rx="8" fill="#2f5d50" stroke="${C.woodDeep}" stroke-width="6"/>
<text x="${W / 2}" y="50" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="800" fill="#e8fff6" opacity=".9">${xesc(cls)}</text></g>
<g id="door"><rect x="10" y="22" width="34" height="74" rx="4" fill="${C.door}" stroke="${C.line}" stroke-width="1.4"/><circle cx="37" cy="62" r="2.5" fill="#ffc800"/></g>
<g id="teacher-desk"><rect x="${W / 2 - 46}" y="104" width="92" height="22" rx="6" fill="${C.woodTop}" stroke="${C.line}" stroke-width="1.4"/><rect x="${W / 2 - 42}" y="122" width="84" height="8" rx="3" fill="${C.wood}"/>
<text x="${W / 2}" y="119" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="900" letter-spacing=".6" fill="${C.woodDeep}">TEACHER</text></g>
</g>`;
}

function benchesSVG(G, C) {
  let out = '';
  for (let r = 0; r < G.rows; r++)
    for (let c = 0; c < CLASS_LAYOUT.cols; c++) {
      const s = G.seat((r * CLASS_LAYOUT.cols + c) * CLASS_LAYOUT.perBench);
      out += `<g id="bench-${r + 1}-${c + 1}"><rect x="${s.bx + 4}" y="${s.y - 8}" width="${G.benchW - 8}" height="16" rx="6" fill="${C.woodTop}" stroke="${C.line}" stroke-width="1.3"/><rect x="${s.bx + 8}" y="${s.y + 6}" width="${G.benchW - 16}" height="6" rx="3" fill="${C.wood}"/></g>`;
    }
  return `<g id="benches">${out}</g>`;
}

/**
 * Whole classroom. seats: [{ student | null, state }] in seat order.
 * selected: student id (or 'e<i>' for an empty seat) chosen while arranging.
 */
export function classroomSVG({
  cls = '',
  seats,
  selected = null,
  arrange = false,
  interactive = true,
  C = SCENE_LIGHT,
}) {
  const G = classGeometry(CLASS_LAYOUT, seats.length);
  const pins = seats
    .map((x, i) => {
      const p = G.seat(i);
      return x.student
        ? pinSVG(x.student, p.x, p.y, x.state, C, {
            selected: selected === x.student.id,
            interactive,
            arrange,
          })
        : emptySeatSVG(i, p.x, p.y, C, arrange && interactive, selected === 'e' + i);
    })
    .join('');
  return `<svg class="scene-svg classroom-svg" viewBox="0 0 ${G.W} ${G.H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="${xesc(cls)} seating plan">
${roomSVG(G, C, cls)}${benchesSVG(G, C)}<g id="students">${pins}</g></svg>`;
}
