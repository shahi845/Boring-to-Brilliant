import { PAGES } from '../app/registry.js';
import { go } from '../app/router.js';
import { notify, resolveRef } from '../lib/notifications.js';
import { actorName, canManageLab, me } from '../lib/permissions.js';
import { save } from '../lib/store.js';
import { avatar, esc, fmtDate, nextId, rel, sClass, sName, stamp, today } from '../lib/utils.js';
import { S } from '../state.js';
import { btn, call, calm, card, heading, itemRow, tabs, tag } from '../ui/components.js';
import { confirmBox, mhead, modal, toast } from '../ui/feedback.js';
import { commit } from '../ui/forms.js';
import { labSceneConfirm, labSceneMarkup, labSceneReset, labSceneSeat } from '../scene/lab-controller.js';
export { labSceneConfirm, labSceneReset, labSceneSeat };
/* ==========================================================================
   COMPUTER LAB — 40 seats, no double booking
   ========================================================================== */
export const seatBooking = n =>
  S.db.lab.bookings.find(
    b => b.seat === n && b.date === today() && ['Active', 'Requested'].includes(b.status),
  );
export const myPass = () =>
  S.db.lab.bookings.find(
    b => b.studentId === me()?.id && b.date === today() && ['Active', 'Requested'].includes(b.status),
  );
export function labStats() {
  const t = today(),
    occ = S.db.lab.bookings.filter(b => b.date === t && b.status === 'Active').length,
    req = S.db.lab.bookings.filter(b => b.date === t && b.status === 'Requested').length,
    un = S.db.lab.unavailable.length;
  const charge =
    S.db.staff
      .filter(s => s.positions.includes('Lab Charge'))
      .map(s => s.name)
      .join(', ') || 'Not assigned';
  return `<div class="play-stats">${[
    ['🟢', 'Available', 40 - occ - req - un],
    ['💻', 'In use', occ],
    ['⏳', 'Requested', req],
    ['🧑‍🏫', 'Lab charge', charge],
  ]
    .map(
      ([i, l, v], k) =>
        `<div class="play-mini tone-${k}"><span class="play-mini-icon">${i}</span><strong style="${k === 3 ? 'font-size:17px' : ''}">${esc(v)}</strong><span>${l}</span></div>`,
    )
    .join('')}</div>`;
}
export function seatMap(mode) {
  const mine = myPass();
  let html = '';
  for (let n = 1; n <= 40; n++) {
    const b = seatBooking(n),
      un = S.db.lab.unavailable.includes(n),
      own = b && mine && b.id === mine.id;
    const cls = un
        ? 'unavailable'
        : own
          ? 'mine'
          : b
            ? b.status === 'Requested'
              ? 'requested'
              : 'occupied'
            : 'free',
      lab = un ? 'Off' : own ? 'Yours' : b ? (b.status === 'Requested' ? 'Held' : 'Taken') : 'Free';
    const act = mode === 'manage' ? call('seatManage', n) : !b && !un && !mine ? call('bookSeat', n) : '';
    html += `<button class="seat ${cls} ${mode === 'manage' ? 'manage' : ''}" ${act ? `onclick="${act}"` : 'disabled'} aria-label="Seat ${n}: ${lab}">${n}<small style="display:block;font-size:9px">${lab}</small></button>`;
  }
  return card(
    'Seat map · ' + fmtDate(today()),
    `<div class="legend" style="margin-top:0"><span><i style="background:#22b98b"></i>Available</span><span><i style="background:#ff8f9a"></i>In use</span><span><i style="background:#1cb0f6"></i>Requested</span><span><i style="background:#c7d6d7"></i>Unavailable</span>${mode !== 'manage' ? '<span><i style="background:#18a876"></i>Yours</span>' : ''}</div><div class="labseats">${html}</div>${mode === 'manage' ? '<p class="tinyhint">Tap any seat to manage it — mark unavailable, review or release a pass.</p>' : mine ? '<p class="tinyhint">You already have a pass for today. Cancel it under My Pass to choose another seat.</p>' : `<p class="tinyhint">${S.db.settings.labMode === 'Instant' ? 'Tap a free seat to get your pass instantly.' : 'Tap a free seat to request it. The Lab Charge confirms your pass.'}</p>`}`,
  );
}
PAGES['Lab Pass'] = () => {
  const h = heading('Lab pass', '40 seats in the computer lab. Pick one in seconds.') + tabs();
  if (S.section === 'Seat Map') return h + labStats() + labSceneMarkup(labCtx);
  const p = myPass(),
    hist = S.db.lab.bookings
      .filter(b => b.studentId === me().id && b !== p)
      .sort((a, b) => b.id - a.id)
      .slice(0, 6);
  return (
    h +
    (p
      ? labPassHTML(p, false, true)
      : calm('💻', 'No pass for today', '', btn('Choose a seat', "go('Lab Pass','Seat Map')", 'primary'))) +
    (hist.length
      ? card(
          'Earlier passes',
          hist
            .map(b => itemRow({ title: 'Seat ' + b.seat + ' · ' + fmtDate(b.date), right: tag(b.status) }))
            .join(''),
          'style="margin-top:16px"',
        )
      : '')
  );
};
/* ---------- digital lab pass + scene context ---------- */
function passCode(p) {
  let h = 2166136261;
  for (const ch of `${p.id}|${p.seat}|${p.date}|${p.studentId}`)
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let cells = '';
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const fx = x < 3 ? 0 : x > 5 ? 6 : -1,
        fy = y < 3 ? 0 : y > 5 ? 6 : -1,
        finder = fx >= 0 && fy >= 0 && !(fx === 6 && fy === 6);
      h = Math.imul(h ^ (x * 31 + y + 7), 2246822519) >>> 0;
      if (finder && x === fx + 1 && y === fy + 1) continue; // hollow centre of each corner marker
      if (finder || h % 3 === 0) cells += `<rect x="${x * 6}" y="${y * 6}" width="6" height="6" rx="1.2"/>`;
    }
  return `<svg class="lp-code" viewBox="-4 -4 62 62" aria-hidden="true"><rect x="-4" y="-4" width="62" height="62" rx="9" fill="#fff"/><g fill="#18233c">${cells}</g></svg>`;
}
export function labPassHTML(p, fresh = false, full = false) {
  const s = me(),
    req = p.status === 'Requested';
  return `<div class="labpass ${req ? 'req' : ''} ${fresh ? 'pop' : ''}" role="group" aria-label="Lab pass for seat ${p.seat}">
<div class="lp-stub"><span>SEAT</span><strong>${p.seat}</strong><small>${req ? 'HELD' : 'ACTIVE'}</small></div>
<div class="lp-body"><div class="hero-eyebrow">💻 COMPUTER LAB · ${esc(fmtDate(p.date)).toUpperCase()}</div>
<h2>${fresh ? (req ? 'Seat requested! 🙌' : 'Seat booked! 🎉') : req ? 'Waiting for the Lab Charge' : 'Your pass is active'}</h2>
<p>${esc(s?.name || '')}${s?.class ? ' · ' + esc(s.class) : ''}<br><span class="muted">${req ? 'Your seat is held while the Lab Charge reviews the request.' : 'Show this pass if asked. Valid for today only.'}</span></p>
<div class="formactions">${full ? '' : btn('Open My Pass', "go('Lab Pass','My Pass')", 'sm primary')}${btn('Cancel pass', call('cancelPass', p.id), 'sm')}</div></div>
${passCode(p)}</div>`;
}
const labCtx = {
  seats: () => {
    const mine = myPass(),
      out = [];
    for (let n = 1; n <= 40; n++) {
      const b = seatBooking(n);
      out.push({
        n,
        state: S.db.lab.unavailable.includes(n)
          ? 'unavailable'
          : b && mine && b.id === mine.id
            ? 'mine'
            : b
              ? b.status === 'Requested'
                ? 'requested'
                : 'occupied'
              : 'free',
      });
    }
    return out;
  },
  pass: () => myPass(),
  mode: () => S.db.settings.labMode,
  passHTML: (p, fresh) => labPassHTML(p, fresh),
  book: n => bookNow(n),
};
/** Book a seat straight from the scene — sitting down to try the seat is the confirmation step. */
export function bookNow(n) {
  const fail = msg => (toast(msg, 'err'), msg);
  if (S.db.lab.unavailable.includes(n)) return fail('Seat ' + n + ' is unavailable');
  if (seatBooking(n)) return fail('Seat ' + n + ' was just taken — pick another');
  if (myPass()) return fail('You already have a pass for today');
  const inst = S.db.settings.labMode === 'Instant',
    id = nextId(S.db.lab.bookings),
    s = me(),
    b = {
      id,
      seat: n,
      studentId: s.id,
      date: today(),
      status: inst ? 'Active' : 'Requested',
      createdAt: stamp(),
    };
  S.db.lab.bookings.push(b);
  if (!inst)
    notify('position:Lab Charge', s.name + ' requested lab seat ' + n, {
      icon: '💻',
      ref: 'lab:' + id,
      action: true,
      link: ['Computer Lab', 'Passes', 'lab:' + id],
    });
  save();
  toast(inst ? 'Seat ' + n + ' is yours today 🎉' : 'Seat ' + n + ' requested');
  return b;
}
export function bookSeat(n) {
  if (S.db.lab.unavailable.includes(n)) return toast('Seat ' + n + ' is unavailable', 'err');
  if (seatBooking(n)) return toast('Seat ' + n + ' was just taken — pick another', 'err');
  if (myPass()) return toast('You already have a pass for today', 'err');
  const inst = S.db.settings.labMode === 'Instant';
  confirmBox(
    (inst ? 'Get a pass for seat ' : 'Request seat ') + n + '?',
    inst
      ? 'Your pass will be active immediately for today.'
      : 'The seat is held for you while the Lab Charge reviews the request.',
    inst ? 'Get pass' : 'Request seat',
    () => {
      if (seatBooking(n) || myPass()) return toast('That seat is no longer available', 'err');
      const id = nextId(S.db.lab.bookings),
        s = me();
      S.db.lab.bookings.push({
        id,
        seat: n,
        studentId: s.id,
        date: today(),
        status: inst ? 'Active' : 'Requested',
        createdAt: stamp(),
      });
      if (!inst)
        notify('position:Lab Charge', s.name + ' requested lab seat ' + n, {
          icon: '💻',
          ref: 'lab:' + id,
          action: true,
          link: ['Computer Lab', 'Passes', 'lab:' + id],
        });
      save();
      go('Lab Pass', 'My Pass');
      toast(inst ? 'Seat ' + n + ' is yours today 🎉' : 'Seat ' + n + ' requested');
    },
  );
}
export function cancelPass(id) {
  confirmBox(
    'Cancel this pass?',
    'The seat becomes available to others.',
    'Cancel pass',
    () => {
      const b = S.db.lab.bookings.find(x => x.id === id);
      if (b) {
        b.status = 'Cancelled';
        resolveRef('lab:' + id);
      }
      commit('Pass cancelled');
    },
    true,
  );
}
PAGES['Computer Lab'] = () => {
  const h =
    heading(
      'Computer lab',
      S.role === 'Admin'
        ? 'Seat availability and passes. The Lab Charge is assigned in Staff Management.'
        : 'Your Lab Charge responsibilities.',
    ) + tabs();
  if (S.section === 'Seat Map')
    return h + labStats() + `<div style="margin-top:16px">${seatMap('manage')}</div>`;
  const t = today(),
    req = S.db.lab.bookings.filter(b => b.date === t && b.status === 'Requested'),
    act = S.db.lab.bookings
      .filter(b => b.date === t && b.status === 'Active')
      .sort((a, b) => a.seat - b.seat),
    done = S.db.lab.bookings.filter(b => b.date === t && !['Active', 'Requested'].includes(b.status));
  return (
    h +
    card(
      'Requests',
      req.length
        ? req
            .map(b =>
              itemRow({
                icon: avatar(sName(b.studentId), b.studentId),
                title: 'Seat ' + b.seat + ' · ' + esc(sName(b.studentId)),
                meta: esc(sClass(b.studentId)) + ' · ' + esc(rel(b.createdAt)),
                right:
                  btn('Approve', call('labDecide', b.id, 'Active'), 'sm primary') +
                  btn('Decline', call('labDecide', b.id, 'Rejected'), 'sm danger'),
              }),
            )
            .join('')
        : '<p class="muted">No requests waiting.</p>',
    ) +
    card(
      'In use now',
      act.length
        ? act
            .map(b =>
              itemRow({
                title: 'Seat ' + b.seat + ' · ' + esc(sName(b.studentId)),
                meta: esc(sClass(b.studentId)),
                right: btn('Release', call('labRelease', b.id), 'sm'),
              }),
            )
            .join('')
        : '<p class="muted">No active passes.</p>',
      'style="margin-top:16px"',
    ) +
    (done.length
      ? card(
          'Earlier today',
          done
            .map(b =>
              itemRow({ title: 'Seat ' + b.seat + ' · ' + esc(sName(b.studentId)), right: tag(b.status) }),
            )
            .join(''),
          'style="margin-top:16px"',
        )
      : '')
  );
};
export function labDecide(id, st) {
  const b = S.db.lab.bookings.find(x => x.id === id);
  if (!b || b.status !== 'Requested' || !canManageLab()) return;
  b.status = st;
  b.decidedBy = actorName();
  resolveRef('lab:' + id);
  notify(
    'student:' + b.studentId,
    st === 'Active'
      ? 'Your lab pass for seat ' + b.seat + ' is confirmed 💻'
      : 'Your request for lab seat ' + b.seat + ' was declined',
    { icon: '💻', link: ['Lab Pass', 'My Pass'] },
  );
  commit(st === 'Active' ? 'Pass approved for seat ' + b.seat : 'Request declined');
}
export function labRelease(id) {
  const b = S.db.lab.bookings.find(x => x.id === id);
  if (!b) return;
  b.status = 'Released';
  commit('Seat ' + b.seat + ' released');
}
export function bookingDetail(id) {
  const b = S.db.lab.bookings.find(x => x.id === id);
  if (!b) return toast('This pass no longer exists', 'err');
  modal(
    mhead('Seat ' + b.seat, esc(sName(b.studentId)) + ' · ' + esc(sClass(b.studentId))) +
      `<dl class="kv"><dt>Date</dt><dd>${fmtDate(b.date)}</dd><dt>Status</dt><dd>${tag(b.status)}</dd><dt>Requested</dt><dd>${esc(rel(b.createdAt))}</dd></dl>` +
      (canManageLab()
        ? `<div class="formactions">${b.status === 'Requested' ? btn('Approve', call('labDecide', id, 'Active'), 'primary') + btn('Decline', call('labDecide', id, 'Rejected'), 'danger') : b.status === 'Active' ? btn('Release seat', call('labRelease', id) + ';closeModal()', '') : ''}</div>`
        : ''),
  );
}
export function seatManage(n) {
  const b = seatBooking(n);
  if (b) return bookingDetail(b.id);
  const un = S.db.lab.unavailable.includes(n);
  confirmBox(
    'Seat ' + n,
    un
      ? 'This seat is marked unavailable. Make it available for booking again?'
      : 'This seat is free. Mark it unavailable (e.g. under maintenance)?',
    un ? 'Make available' : 'Mark unavailable',
    () => {
      if (un) S.db.lab.unavailable = S.db.lab.unavailable.filter(x => x !== n);
      else if (!seatBooking(n)) S.db.lab.unavailable.push(n);
      commit('Seat ' + n + (un ? ' is available again' : ' marked unavailable'));
    },
  );
}
