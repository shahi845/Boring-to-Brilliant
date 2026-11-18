/* ==========================================================================
   ATTENDANCE — bench view. Every student is a pin on their bench:
     tap  → absent / present (saved instantly)
     hold → details card with all status options
   Students on approved leave, verified medical or outside campus are shown
   separately and can't be toggled by accident. The class teacher (assigned
   by the Admin) can rearrange the seats.
   ========================================================================== */
import { render } from '../app/router.js';
import { actorName, canArrange } from '../lib/permissions.js';
import { save } from '../lib/store.js';
import { esc, firstName, fmtDate, plural, stamp } from '../lib/utils.js';
import { S } from '../state.js';
import { btn, call, tag } from '../ui/components.js';
import { closeModal, mhead, modal, toast } from '../ui/feedback.js';
import { CLASS_LAYOUT, PIN_STATE, classroomSVG, faceSVG, fullRows } from '../scene/classroom.js';
import { scenePalette } from '../scene/palette.js';
import { markClass, markDate, outsideModal, submitAttendance } from './attendance.js';
import { att, attPct, classStudents, leaveCovering, setAtt } from './shared.js';

let arrange = false,
  draft = null,
  pick = null,
  holdT = 0,
  held = false,
  downId = null;

export const medicalCovering = (sid, d) =>
  S.db.medical.find(m => m.studentId === sid && m.status === 'Verified' && m.from <= d && m.to >= d);

/** Bench state of one student on a date. */
export function pinState(s, d) {
  const r = att(s.id, d);
  if (r)
    return (
      {
        Present: 'present',
        Absent: 'absent',
        Late: 'late',
        'On Leave': /^medical/i.test(r.note || '') ? 'medical' : 'leave',
        'Outside Campus': r.returnedAt ? 'present' : 'outside',
      }[r.status] || 'unmarked'
    );
  if (medicalCovering(s.id, d)) return 'medical';
  if (leaveCovering(s.id, d)) return 'leave';
  return 'unmarked';
}

const byRoll = (a, b) => String(a.roll).localeCompare(String(b.roll), undefined, { numeric: true });

/** Seat order for a class: saved plan first, new students fill gaps, rows padded to full benches. */
export function seatOrder(cls) {
  const st = classStudents(cls).slice().sort(byRoll),
    ids = new Set(st.map(s => s.id));
  const order = (S.db.seating?.[cls]?.order || []).map(x => (x != null && ids.has(+x) ? +x : null));
  const placed = new Set(order.filter(x => x != null));
  st.filter(s => !placed.has(s.id)).forEach(s => {
    const gap = order.indexOf(null);
    if (gap >= 0) order[gap] = s.id;
    else order.push(s.id);
  });
  while (order.length && order[order.length - 1] == null) order.pop();
  const n = fullRows(order.length);
  while (order.length < n) order.push(null);
  return order;
}

const student = id => S.db.students.find(x => x.id === id);
const GROUPS = [
  ['absent', 'Absent'],
  ['late', 'Late'],
  ['leave', 'On leave'],
  ['medical', 'Medical'],
  ['outside', 'Outside campus'],
];

export function benchViewHTML() {
  const cls = markClass,
    d = markDate,
    order = arrange && draft ? draft : seatOrder(cls),
    seats = order.map(id => {
      const s = id != null && student(id);
      return s ? { student: s, state: pinState(s, d) } : { student: null };
    });
  const list = seats.filter(x => x.student),
    count = k => list.filter(x => x.state === k).length,
    present = count('present') + count('unmarked');
  const tray = GROUPS.map(([k, label]) => {
    const g = list.filter(x => x.state === k);
    return g.length
      ? `<div class="tray-group"><span class="tray-label" style="--c:${PIN_STATE[k].ring}">${PIN_STATE[k].icon} ${label} · ${g.length}</span>${g
          .map(
            x =>
              `<button type="button" class="tray-chip" onclick="${call('pinInfo', x.student.id)}">${esc(firstName(x.student.name))}</button>`,
          )
          .join('')}</div>`
      : '';
  }).join('');
  const tools = arrange
    ? `<div class="bench-tools arranging"><span class="bench-hint">✥ <b>Arranging seats</b> — tap a student, then tap where they should sit.</span>${btn('Sort by roll no.', 'arrangeSort()', 'sm')}${btn('Cancel', 'arrangeCancel()', 'sm')}${btn('Save seating', 'arrangeSave()', 'sm primary')}</div>`
    : `<div class="bench-tools"><span class="bench-hint">👆 <b>Tap</b> a student to mark absent · <b>hold</b> for details</span>${canArrange(cls) ? btn('✥ Arrange seats', 'arrangeStart()', 'sm') : ''}</div>`;
  return `<div class="bench-wrap">${tools}
<div class="scene-stage"><div class="scene" id="benchHost">${classroomSVG({ cls, seats, selected: pick, arrange, C: scenePalette() })}</div></div>
${arrange ? '' : `<div class="bench-tray">${tray || '<span class="muted">Everyone is in class 🎉</span>'}${count('unmarked') ? `<div class="tinyhint">${plural(count('unmarked'), 'student')} not tapped yet — counted present when you submit.</div>` : ''}</div>`}
${
  arrange
    ? ''
    : `<div class="sticky-submit"><div><b>${present} present${count('absent') ? ' · ' + count('absent') + ' absent' : ''}${count('late') ? ' · ' + count('late') + ' late' : ''}</b><div class="muted" style="font-size:12px">${esc(cls)} · ${fmtDate(d)} · each tap is saved instantly</div></div>${btn('Submit attendance', 'benchSubmit()', 'primary')}</div>`
}</div>`;
}

/* ---------------- pointer: tap vs hold ---------------- */
export function pinDown(e, sid) {
  if (e.button > 0) return;
  downId = sid;
  held = false;
  clearTimeout(holdT);
  e.currentTarget.classList.add('pressing');
  holdT = setTimeout(() => {
    held = true;
    document.querySelectorAll('.pin.pressing').forEach(p => p.classList.remove('pressing'));
    try {
      navigator.vibrate?.(25);
    } catch {}
    if (!arrange) pinInfo(sid);
  }, 480);
}
export function pinUp(e, sid) {
  clearTimeout(holdT);
  e.currentTarget?.classList?.remove('pressing');
  const was = downId;
  downId = null;
  if (held || was !== sid) return;
  pinTap(sid);
}
export function pinCancel() {
  clearTimeout(holdT);
  downId = null;
  document.querySelectorAll('.pin.pressing').forEach(p => p.classList.remove('pressing'));
}
export function pinKey(e, sid) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (e.shiftKey) pinInfo(sid);
    else pinTap(sid);
  } else if (e.key === 'i') pinInfo(sid);
}

/** One tap: absent ↔ present. Leave / medical / outside open the card instead. */
export function pinTap(sid) {
  if (arrange) return arrangePick(sid);
  const s = student(sid),
    st = pinState(s, markDate);
  if (st === 'leave' || st === 'medical' || st === 'outside') return pinInfo(sid);
  benchSet(sid, st === 'absent' || st === 'late' ? 'Present' : 'Absent', false);
}

export function benchSet(sid, status, close = true) {
  if (status === 'Outside Campus') {
    closeModal();
    return outsideModal(sid, markDate);
  }
  const extra =
    status === 'On Leave'
      ? { note: medicalCovering(sid, markDate) ? 'Medical (verified)' : 'Approved leave' }
      : {};
  setAtt(sid, markDate, status, extra);
  save();
  if (close) closeModal();
  render();
  setTimeout(() => document.getElementById('pin-' + sid)?.classList.add('bump'), 10);
}

/** Hold: details card with every status option. */
export function pinInfo(sid) {
  const s = student(sid);
  if (!s) return;
  const st = pinState(s, markDate),
    P = PIN_STATE[st],
    { n, pct } = attPct(sid),
    lv = leaveCovering(sid, markDate),
    med = medicalCovering(sid, markDate),
    r = att(sid, markDate);
  const last = S.db.attendance
    .filter(a => a.studentId === sid)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .reverse();
  const opts = [
    ['Present', '✓', 'primary'],
    ['Absent', '✕', 'danger'],
    ['Late', '⏰', ''],
    ['Outside Campus', '🚶', ''],
    ...(lv || med ? [['On Leave', '🌙', '']] : []),
  ];
  modal(
    mhead(s.name, esc(s.class) + ' · Roll ' + esc(s.roll)) +
      `<div class="pin-card"><svg viewBox="-44 -44 88 88" class="pin-face" aria-hidden="true"><circle r="42" fill="${P.ring}"/>${faceSVG(s, 38, 'big')}</svg>
<dl class="kv"><dt>${fmtDate(markDate)}</dt><dd>${tag(P.label)}${r?.time && st !== 'unmarked' ? ' <span class="muted">' + esc(r.time) + '</span>' : ''}</dd>
<dt>Attendance</dt><dd>${pct}% of ${plural(n, 'day')}</dd>
${lv ? `<dt>Leave</dt><dd>${esc(lv.type)} · ${esc(lv.reason)}</dd>` : ''}${med ? `<dt>Medical</dt><dd>Verified · ${esc(med.note)}</dd>` : ''}
${r?.status === 'Outside Campus' && r.note ? `<dt>Outside</dt><dd>${esc(r.note)}</dd>` : ''}
${S.role !== 'Student' && s.guardian ? `<dt>Guardian</dt><dd>${esc(s.guardian)}</dd>` : ''}</dl></div>
${last.length ? `<div class="daystrip" style="margin:6px 0 4px">${last.map(a => `<div class="day" title="${esc(a.status)}">${new Date(a.date + 'T00:00:00').getDate()}<i class="${esc(a.status.toLowerCase().replace(/\s+/g, '-'))}"></i></div>`).join('')}</div>` : ''}
<div class="formactions pin-actions">${opts.map(([v, i, c]) => btn(i + ' ' + v, call('benchSet', sid, v), 'sm ' + c + (r?.status === v ? ' on' : ''))).join('')}${window.studentDetail && S.role !== 'Staff' ? btn('Full profile', call('studentDetail', sid), 'sm') : ''}</div>`,
  );
}

/** Submit: untapped students count as present; leave / medical are recorded as On Leave. */
export function benchSubmit() {
  classStudents(markClass).forEach(s => {
    if (att(s.id, markDate)) return;
    const med = medicalCovering(s.id, markDate),
      lv = leaveCovering(s.id, markDate);
    if (med || lv)
      setAtt(s.id, markDate, 'On Leave', { note: med ? 'Medical (verified)' : 'Approved leave' });
    else setAtt(s.id, markDate, 'Present');
  });
  submitAttendance();
}

/* ---------------- arranging seats (class teacher / Admin) ---------------- */
export function arrangeStart() {
  if (!canArrange(markClass)) return toast('Only the class teacher can arrange seats', 'err');
  arrange = true;
  draft = seatOrder(markClass);
  pick = null;
  render();
}
function swapWith(target) {
  const ia = typeof pick === 'string' ? +pick.slice(1) : draft.indexOf(pick),
    ib = typeof target === 'string' ? +target.slice(1) : draft.indexOf(target);
  if (ia < 0 || ib < 0) return;
  [draft[ia], draft[ib]] = [draft[ib], draft[ia]];
}
export function arrangePick(sid) {
  if (pick == null) pick = sid;
  else if (pick === sid) pick = null;
  else {
    swapWith(sid);
    pick = null;
  }
  render();
}
export function seatPick(i) {
  if (!arrange) return;
  if (pick == null) return toast('Tap a student first, then the empty seat', 'info');
  swapWith('e' + i);
  pick = null;
  render();
}
export function arrangeSort() {
  const st = classStudents(markClass)
    .slice()
    .sort(byRoll)
    .map(s => s.id);
  while (st.length < fullRows(st.length)) st.push(null);
  draft = st;
  pick = null;
  render();
}
export function arrangeCancel() {
  arrange = false;
  draft = null;
  pick = null;
  render();
}
export function arrangeSave() {
  const order = draft.slice();
  while (order.length && order[order.length - 1] == null) order.pop();
  S.db.seating ||= {};
  S.db.seating[markClass] = { order, perBench: CLASS_LAYOUT.perBench, by: actorName(), at: stamp() };
  save();
  arrange = false;
  draft = null;
  pick = null;
  render();
  toast('Seating saved for ' + markClass);
}
export const isArranging = () => arrange;
