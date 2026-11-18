/* ==========================================================================
   COMPUTER LAB — interactive seat booking scene (runtime).
   Flow: entrance → tap a seat → student walks there → turns → sits → uses the
   computer → confirm → celebration + digital lab pass.
   The page passes a small context object so this file has no data logic:
     ctx.seats() → [{n,state}]   ctx.pass() → today's booking or undefined
     ctx.book(n) → booking | error string    ctx.mode() → 'Instant' | 'Approval'
     ctx.passHTML(booking, fresh) → HTML for the lab pass card
   ========================================================================== */
import { Kid } from './rig.js';
import { LAB_LAYOUTS, labGeometry, labSVG, pathToSeat, KID_SCALE_LAB } from './lab-scene.js';
import { scenePalette } from './palette.js';
import { busyWhile, confettiSVG, onSceneEnvChange } from './fx.js';

const ui = { seat: 0, phase: 'idle', sitAt: 0, busy: false };
const kid = new Kid();
kid.scale = KID_SCALE_LAB;
let ctx = null,
  G = null,
  key = '',
  host = null;

export function labSceneMarkup(c) {
  ctx = c;
  setTimeout(mountLab, 0);
  return `<div class="scene-wrap lab-wrap"><div class="scene-stage"><div class="scene" id="labScene"></div></div><div class="scene-panel" id="labPanel" aria-live="polite"></div></div>`;
}

function seatInfo(n) {
  return ctx.seats().find(s => s.n === n);
}

export function mountLab() {
  host = document.getElementById('labScene');
  if (!host || !ctx) return;
  key = host.clientWidth < 600 ? 'mobile' : 'desktop';
  G = labGeometry(LAB_LAYOUTS[key]);
  const pass = ctx.pass();
  ui.busy = false;
  if (pass) {
    ui.seat = pass.seat;
    ui.sitAt = pass.seat;
    if (ui.phase !== 'celebrate') ui.phase = 'booked';
  } else if (ui.phase === 'booked' || ui.phase === 'celebrate') {
    Object.assign(ui, { seat: 0, phase: 'idle', sitAt: 0 });
  }
  if (ui.phase === 'walking') ui.phase = 'seated';
  if (ui.phase === 'seated' && seatInfo(ui.seat)?.state !== 'free')
    Object.assign(ui, { seat: 0, phase: 'idle', sitAt: 0 });
  // place the student for the current phase (no animation on (re)mount)
  if (ui.phase === 'idle' && !ui.sitAt) {
    kid.place(...G.start).pose('wave');
    kid.flip = 1;
  } else if (ui.phase === 'celebrate') {
    const s = G.seat(ui.seat);
    ui.sitAt = 0;
    kid.place(s.cx, s.laneY).pose('cheer');
  } else if (ui.sitAt) {
    const s = G.seat(ui.sitAt);
    kid.place(s.cx, s.sitY).pose(ui.phase === 'booked' || ui.phase === 'seated' ? 'type' : 'sit');
    kid.flip = 1;
  }
  paint();
}

function paint(extra = '') {
  if (!host) return;
  host.innerHTML = labSVG({
    layout: LAB_LAYOUTS[key],
    seats: ctx.seats(),
    selected: ui.phase === 'booked' || ui.phase === 'celebrate' ? 0 : ui.seat,
    kid: { x: kid.x, y: kid.y, pose: kid.poseName, flip: kid.flip, sitAt: ui.sitAt },
    C: scenePalette(),
    extra,
  });
  kid.bind(host.querySelector('[data-kid]'));
  panel();
}

function panel() {
  const el = document.getElementById('labPanel');
  if (!el) return;
  const inst = ctx.mode() === 'Instant';
  const free = ctx.seats().filter(s => s.state === 'free').length;
  if (ui.phase === 'idle')
    el.innerHTML = `<div class="sp-row"><span class="sp-emoji">👋</span><div><b>Pick a green seat</b><div class="muted">Your student walks over, sits down and tries the computer before you book. ${free} of ${ctx.seats().length} seats free today.</div></div></div>${legend()}`;
  else if (ui.phase === 'walking')
    el.innerHTML = `<div class="sp-row"><span class="sp-emoji sp-bounce">🚶</span><div><b>Walking to seat ${ui.seat}…</b><div class="muted">Hold on, almost there.</div></div></div>${legend()}`;
  else if (ui.phase === 'seated') {
    const s = G.seat(ui.seat);
    el.innerHTML = `<div class="sp-row"><span class="sp-seatnum">${ui.seat}</span><div class="grow"><b>Seat ${ui.seat} looks good!</b><div class="muted">Row ${s.row + 1} · ${s.col < LAB_LAYOUTS[key].perSide ? 'left' : 'right'} side of the aisle · ${inst ? 'pass is active right away' : 'the Lab Charge confirms your pass'}</div></div></div>
<div class="formactions" style="margin-top:12px"><button type="button" class="btn primary" onclick="labSceneConfirm()">${inst ? 'Get pass for seat ' + ui.seat : 'Request seat ' + ui.seat}</button><button type="button" class="btn" onclick="labSceneReset()">Choose another seat</button></div>`;
  } else {
    const p = ctx.pass();
    el.innerHTML = p ? ctx.passHTML(p, ui.phase === 'celebrate') : '';
  }
}

function legend() {
  const C = scenePalette().state;
  return `<div class="legend scene-legend">${[
    ['free', 'Available'],
    ['occupied', 'In use'],
    ['requested', 'Requested'],
    ['unavailable', 'Unavailable'],
    ['selected', 'Selected'],
  ]
    .map(([k, l]) => `<span><i style="background:${C[k]}"></i>${l}</span>`)
    .join('')}</div>`;
}

function slotFor(n) {
  return host.querySelector(`[data-sit="${n}"]`);
}
function walker() {
  return host.querySelector('#walker');
}

async function standUp() {
  if (!ui.sitAt) return;
  const s = G.seat(ui.sitAt);
  kid.pose('prepare');
  await kid.moveTo(s.cx, s.sitY + 6, 220);
  await kid.moveTo(s.cx, s.laneY, 380);
  walker().appendChild(kid.el);
  ui.sitAt = 0;
  await kid.turn('stand');
}

async function sitDown(n) {
  const s = G.seat(n);
  kid.pose('turn');
  await kid.wait(260);
  await kid.turn('prepare', 1);
  slotFor(n).appendChild(kid.el);
  ui.sitAt = n;
  await kid.moveTo(s.cx, s.sitY, 520);
  kid.pose('sit');
  await kid.wait(320);
  const scr = host.querySelector(`#seat-${n} .screen`);
  if (scr) scr.setAttribute('fill', scenePalette().screenOn);
  kid.pose('type');
}

/** Seat tapped in the scene. */
export async function labSceneSeat(n) {
  if (!host || ui.busy) return;
  const info = seatInfo(n);
  if (ui.phase === 'booked' || ui.phase === 'celebrate') {
    document.getElementById('labPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  if (!info || info.state !== 'free') return;
  if (n === ui.seat && ui.phase === 'seated') return;
  ui.busy = true;
  ui.seat = n;
  ui.phase = 'walking';
  const sitting = ui.sitAt;
  paint();
  try {
    await busyWhile(async () => {
      if (sitting) await standUp();
      else if (kid.poseName !== 'stand') kid.pose('stand');
      await kid.walk(pathToSeat(G, [kid.x, kid.y], n), { speed: key === 'mobile' ? 190 : 170 });
      await sitDown(n);
    });
    ui.phase = 'seated';
  } finally {
    ui.busy = false;
    panel();
  }
}

export function labSceneReset() {
  if (ui.busy) return;
  ui.seat = 0;
  ui.phase = 'idle';
  paint();
}

export async function labSceneConfirm() {
  if (ui.busy || ui.phase !== 'seated') return;
  const r = ctx.book(ui.seat);
  if (typeof r === 'string') {
    ui.phase = 'idle';
    ui.seat = 0;
    paint();
    return;
  }
  ui.busy = true;
  ui.phase = 'celebrate';
  paint();
  try {
    await busyWhile(async () => {
      await standUp();
      kid.pose('cheer');
      const s = G.seat(ui.seat);
      host.querySelector('#fx').innerHTML = confettiSVG(s.cx, s.dy, scenePalette());
      await kid.wait(2600);
      host.querySelector('#fx').innerHTML = '';
      await kid.turn('prepare', 1);
      slotFor(ui.seat).appendChild(kid.el);
      ui.sitAt = ui.seat;
      await kid.moveTo(s.cx, s.sitY, 460);
      kid.pose('type');
    });
  } finally {
    ui.phase = 'booked';
    ui.busy = false;
    panel();
  }
}

onSceneEnvChange(() => {
  if (!document.getElementById('labScene') || ui.busy) return;
  mountLab();
});
export { KID_SCALE_LAB };
