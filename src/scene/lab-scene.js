/* ==========================================================================
   COMPUTER LAB scene — 2.5D room with 40 selectable seats (pure SVG builder).
   The seating arrangement is configurable: change LAB_LAYOUTS when the real
   lab plan is known (rows × seats per side of the centre aisle).
   ========================================================================== */
import { kidSVG } from './rig.js';
import { SCENE_LIGHT } from './palette.js';

export const LAB_LAYOUTS = {
  desktop: { rows: 4, perSide: 5, unit: 80, aisle: 110, margin: 50 },
  mobile: { rows: 10, perSide: 2, unit: 84, aisle: 86, margin: 18 },
};
export const KID_SCALE_LAB = 0.8;
const WALL = 132,
  TOP = 186,
  PITCH = 124;

export function labGeometry(L) {
  const block = L.perSide * L.unit,
    W = L.margin * 2 + block * 2 + L.aisle,
    aisleX = L.margin + block + L.aisle / 2,
    H = TOP + L.rows * PITCH + 4;
  const seat = n => {
    const i = n - 1,
      perRow = L.perSide * 2,
      row = Math.floor(i / perRow),
      col = i % perRow,
      cx =
        col < L.perSide
          ? L.margin + col * L.unit + L.unit / 2
          : L.margin + block + L.aisle + (col - L.perSide) * L.unit + L.unit / 2,
      dy = TOP + row * PITCH;
    return { n, row, col, cx, dy, laneY: dy + 108, sitY: dy + 80 };
  };
  return { W, H, aisleX, wall: WALL, seat, count: L.rows * L.perSide * 2, start: [aisleX, WALL + 34] };
}

export const SEAT_LABEL = {
  free: 'Available',
  occupied: 'In use',
  requested: 'Requested',
  unavailable: 'Unavailable',
  mine: 'Your seat',
};

/** One reusable seat component: desk + monitor + keyboard + chair + number badge. */
export function seatSVG(
  s,
  state,
  C = SCENE_LIGHT,
  { selected = false, interactive = true, lit = false } = {},
) {
  const { cx, dy, n } = s,
    col = C.state[state] || C.state.free,
    on = lit || state === 'occupied' || state === 'mine' || state === 'requested',
    off = state === 'unavailable';
  const screen = off ? C.screenOff : state === 'mine' ? C.screenMine : on ? C.screenOn : C.screenOff;
  const st = `stroke="${C.line}" stroke-width="1.5" stroke-linejoin="round"`;
  const label = `Seat ${n}: ${selected ? 'Selected' : SEAT_LABEL[state]}`;
  const act =
    interactive && (state === 'free' || state === 'mine')
      ? ` role="button" tabindex="0" onclick="labSceneSeat(${n})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();labSceneSeat(${n})}"`
      : ` role="img"`;
  return `<g class="lab-seat s-${state}${selected ? ' is-sel' : ''}" id="seat-${n}" data-seat="${n}" aria-label="${label}"${act}>
<rect class="seat-hit" x="${cx - 39}" y="${dy - 20}" width="78" height="118" rx="16" fill="${selected ? C.state.selected + '33' : 'transparent'}" stroke="${selected ? C.state.selected : 'none'}" stroke-width="3"/>
<ellipse cx="${cx}" cy="${dy + 74}" rx="26" ry="6" fill="${C.shadow}"/>
<g id="desk-${n}">
<rect x="${cx - 31}" y="${dy + 34}" width="4" height="14" rx="2" fill="${C.woodDeep}"/><rect x="${cx + 27}" y="${dy + 34}" width="4" height="14" rx="2" fill="${C.woodDeep}"/>
<rect x="${cx - 35}" y="${dy + 12}" width="70" height="18" rx="6" fill="${C.woodTop}" ${st}/>
<rect x="${cx - 35}" y="${dy + 26}" width="70" height="11" rx="4" fill="${C.wood}" ${st}/>
</g>
<g id="computer-${n}">
<rect x="${cx - 3}" y="${dy + 4}" width="6" height="10" fill="${C.metal}"/><rect x="${cx - 10}" y="${dy + 12}" width="20" height="4" rx="2" fill="${C.metal}" ${st}/>
<rect x="${cx - 21}" y="${dy - 16}" width="42" height="27" rx="5" fill="${C.monitor}" ${st}/>
<rect class="screen" x="${cx - 18}" y="${dy - 13}" width="36" height="20" rx="2.5" fill="${screen}"/>
${
  on
    ? `<g class="code" fill="${C.code}" opacity=".85"><rect x="${cx - 14}" y="${dy - 9}" width="14" height="2.4" rx="1.2"/><rect x="${cx - 14}" y="${dy - 4.5}" width="22" height="2.4" rx="1.2"/><rect x="${cx - 10}" y="${dy}" width="12" height="2.4" rx="1.2"/></g>`
    : off
      ? `<path d="M${cx - 6} ${dy - 7} l12 8 M${cx + 6} ${dy - 7} l-12 8" stroke="${C.muted}" stroke-width="2.4" stroke-linecap="round"/>`
      : `<circle cx="${cx}" cy="${dy - 3}" r="3.4" fill="none" stroke="${C.state.free}" stroke-width="2"/>`
}
<rect x="${cx - 14}" y="${dy + 17}" width="28" height="6" rx="2" fill="${C.kbd}" ${st}/>
<ellipse cx="${cx + 22}" cy="${dy + 20}" rx="3.4" ry="4" fill="${C.kbd}" ${st}/>
</g>
<g class="sit-slot" data-sit="${n}"></g>
<g id="chair-${n}">
<rect x="${cx - 2}" y="${dy + 62}" width="4" height="7" fill="${C.metal}"/><rect x="${cx - 12}" y="${dy + 67}" width="24" height="4" rx="2" fill="${C.metal}"/>
<rect x="${cx - 14}" y="${dy + 42}" width="28" height="22" rx="8" fill="${col}" ${st}/>
<rect x="${cx - 9}" y="${dy + 46}" width="18" height="4" rx="2" fill="#ffffff" opacity=".35"/>
</g>
<g class="badge" id="seat-number-${n}">
<rect x="${cx - 19}" y="${dy + 76}" width="38" height="21" rx="10.5" fill="${selected ? C.state.selected : col}" ${st}/>
<text x="${cx}" y="${dy + 91}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="900" fill="${selected || off ? C.line : '#ffffff'}">${n}</text>
</g>
</g>`;
}

function roomSVG(G, C, doorOpen) {
  const { W, H, aisleX, wall } = G;
  const tiles = [];
  for (let y = wall + 40; y < H; y += 40)
    tiles.push(`<path d="M0 ${y} H${W}" stroke="${C.floorLine}" stroke-width="2"/>`);
  for (let x = 40; x < W; x += 80)
    tiles.push(`<path d="M${x} ${wall} V${H}" stroke="${C.floorLine}" stroke-width="2"/>`);
  const boardR = aisleX - 66,
    boardW = Math.min(300, boardR - 24),
    boardX = boardR - boardW;
  const winL = aisleX + 66,
    winSpace = W - 24 - winL,
    nWin = winSpace > 260 ? 2 : 1,
    winW = Math.min(130, (winSpace - (nWin - 1) * 16) / nWin);
  const wins = Array.from({ length: nWin }, (_, i) => {
    const x = winL + (winSpace - (nWin * winW + (nWin - 1) * 16)) / 2 + i * (winW + 16);
    return `<g id="window-${i + 1}"><rect x="${x}" y="26" width="${winW}" height="72" rx="10" fill="${C.sky}" stroke="${C.boardFrame}" stroke-width="5"/>
<ellipse cx="${x + winW * 0.35}" cy="58" rx="${winW * 0.17}" ry="7" fill="${C.cloud}"/><ellipse cx="${x + winW * 0.5}" cy="52" rx="${winW * 0.13}" ry="9" fill="${C.cloud}"/>
<path d="M${x + winW / 2} 26 V98" stroke="${C.boardFrame}" stroke-width="4"/></g>`;
  }).join('');
  const door = doorOpen
    ? `<rect x="${aisleX - 30}" y="34" width="60" height="${wall - 34}" rx="4" fill="${C.doorway}"/><path d="M${aisleX - 30} 34 L${aisleX - 46} 42 V${wall + 4} L${aisleX - 30} ${wall}" fill="${C.door}" stroke="${C.line}" stroke-width="1.5" stroke-linejoin="round"/>`
    : `<rect x="${aisleX - 30}" y="34" width="60" height="${wall - 34}" rx="4" fill="${C.door}" stroke="${C.line}" stroke-width="1.5"/><rect x="${aisleX - 22}" y="44" width="44" height="30" rx="6" fill="${C.sky}" opacity=".8"/><circle cx="${aisleX + 20}" cy="${wall - 44}" r="3.5" fill="${C.lanyard || '#ffc800'}"/>`;
  return `<g id="room-background">
<rect width="${W}" height="${H}" fill="${C.floor}"/>${tiles.join('')}
<rect width="${W}" height="${wall}" fill="${C.wall}"/>
<path d="M0 ${wall - 46} H${W}" stroke="${C.wallLine}" stroke-width="3"/>
<rect y="${wall - 10}" width="${W}" height="10" fill="${C.base}"/>
${
  boardW > 90
    ? `<g id="whiteboard"><rect x="${boardX}" y="22" width="${boardW}" height="78" rx="10" fill="${C.board}" stroke="${C.boardFrame}" stroke-width="5"/>
<path d="M${boardX + 18} 46 h${boardW * 0.42} M${boardX + 18} 62 h${boardW * 0.3} M${boardX + 18} 78 h${boardW * 0.5}" stroke="${C.state.requested}" stroke-width="4" stroke-linecap="round" opacity=".55"/>
<text x="${boardX + boardW - 18}" y="${70}" text-anchor="end" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="900" fill="${C.state.free}">&lt;/&gt;</text></g>`
    : ''
}
${wins}
<g id="entrance-door">
<rect x="${aisleX - 38}" y="26" width="76" height="${wall - 22}" rx="8" fill="${C.doorDark}" stroke="${C.line}" stroke-width="1.5"/>
${door}
<rect x="${aisleX - 52}" y="4" width="104" height="18" rx="9" fill="${C.sign}"/>
<text x="${aisleX}" y="17" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="900" letter-spacing="1" fill="#ffffff">COMPUTER LAB</text>
<rect x="${aisleX - 40}" y="${wall + 6}" width="80" height="16" rx="8" fill="${C.rug}" stroke="${C.rugEdge}" stroke-width="2"/>
</g>
<g id="plant"><rect x="${W - 46}" y="${wall - 30}" width="24" height="22" rx="5" fill="${C.pot}"/><ellipse cx="${W - 40}" cy="${wall - 40}" rx="9" ry="14" fill="${C.plant}"/><ellipse cx="${W - 28}" cy="${wall - 42}" rx="8" ry="13" fill="${C.plantDark}"/></g>
<rect id="aisle" x="${aisleX - 22}" y="${wall + 26}" width="44" height="${H - wall - 30}" rx="22" fill="${C.rug}" opacity=".55"/>
</g>`;
}

/**
 * Whole lab scene. seats: array of {n, state}; kid: {x,y,pose,flip,sitAt}.
 * sitAt = seat number → the student is drawn inside that seat (behind the chair).
 */
export function labSVG({
  layout = LAB_LAYOUTS.desktop,
  seats,
  selected = 0,
  lit = 0,
  kid,
  C = SCENE_LIGHT,
  doorOpen = true,
  interactive = true,
  extra = '',
}) {
  const G = labGeometry(layout);
  const kidMarkup = kid ? kidSVG({ ...kid, scale: KID_SCALE_LAB }) : '';
  const seatMarkup = seats
    .map(s => {
      const g = seatSVG(G.seat(s.n), s.state, C, {
        selected: s.n === selected,
        interactive,
        lit: s.n === lit,
      });
      return kid && kid.sitAt === s.n
        ? g.replace(`data-sit="${s.n}"></g>`, `data-sit="${s.n}">${kidMarkup}</g>`)
        : g;
    })
    .join('');
  return `<svg class="scene-svg" viewBox="0 0 ${G.W} ${G.H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Computer lab with ${G.count} seats">
${roomSVG(G, C, doorOpen)}
<g id="seats">${seatMarkup}</g>
<g id="walker">${kid && !kid.sitAt ? kidMarkup : ''}</g>
<g id="fx">${extra}</g>
</svg>`;
}

/** Path from the student's current spot to a seat: aisle → row lane → seat. */
export function pathToSeat(G, from, n) {
  const s = G.seat(n),
    pts = [];
  const [fx, fy] = from;
  if (Math.abs(fx - G.aisleX) > 1) pts.push([G.aisleX, fy]);
  pts.push([G.aisleX, s.laneY], [s.cx, s.laneY]);
  return pts;
}
