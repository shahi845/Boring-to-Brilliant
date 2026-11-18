import { FORMS, PAGES } from '../app/registry.js';
import { go, render } from '../app/router.js';
import { SHORT, STATUSES } from '../lib/constants.js';
import { notify, resolveRef } from '../lib/notifications.js';
import { actorName, canEditAttendance, isAA, markableClasses, me, myClasses } from '../lib/permissions.js';
import { save } from '../lib/store.js';
import {
  addDays,
  avatar,
  esc,
  firstName,
  fmtDate,
  fmtDay,
  fmtRange,
  fmtTime,
  nowTime,
  plural,
  rel,
  sClass,
  sName,
  stamp,
  today,
} from '../lib/utils.js';
import { formsPage } from './forms.js';
import { benchViewHTML, isArranging } from './benches.js';
import { medicalPage } from './medical.js';
import { att, attPct, classStudents, leaveCovering, outsideNow, setAtt, subOf } from './shared.js';
import { S } from '../state.js';
import { btn, call, calm, card, heading, itemRow, table, tabs, tag } from '../ui/components.js';
import { mhead, modal, toast } from '../ui/feedback.js';
import { F, commit, formHTML } from '../ui/forms.js';
/* ==========================================================================
   ATTENDANCE
   ========================================================================== */
export let markClass = '',
  markDate = '',
  markView = 'bench';
export function setMarkView(v) {
  markView = v;
  render();
}
export function markOpen(cl, d) {
  markClass = cl;
  markDate = d;
  go('Attendance', 'Mark Attendance');
}
PAGES.Attendance = () => {
  const desc =
    {
      Student: 'Your recorded attendance, leave status, medical requests and forms.',
      Admin: 'Monitor attendance across campus. Statuses are only what staff explicitly record.',
    }[S.role] || 'Statuses are recorded explicitly — the app never assumes where a student is.';
  const body =
    {
      Overview: S.role === 'Student' ? studentAttendance : campusOverview,
      'Leave Status': leaveStatusPage,
      Medical: medicalPage,
      Forms: formsPage,
      'Mark Attendance': markAttendancePage,
      'Outside Campus': outsidePage,
      History: historyPage,
      Monitoring: campusOverview,
    }[S.section] || (() => '');
  return heading('Attendance', desc) + tabs() + body();
};
export function studentAttendance() {
  const s = me(),
    own = S.db.attendance.filter(a => a.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date)),
    cnt = st => own.filter(a => a.status === st).length,
    { pct } = attPct(s.id);
  const last = own.slice(0, 14).reverse();
  return (
    `<div class="play-stats">${[
      ['✅', 'Present', cnt('Present')],
      ['⏰', 'Late', cnt('Late')],
      ['❌', 'Absent', cnt('Absent')],
      ['🌙', 'On leave', cnt('On Leave')],
    ]
      .map(
        ([i, l, v], k) =>
          `<div class="play-mini tone-${k}"><span class="play-mini-icon">${i}</span><strong>${v}</strong><span>${l}</span></div>`,
      )
      .join('')}</div>` +
    `<div class="play-panel"><div class="play-panel-head"><h2>Recent days</h2><span class="chip">${pct}% present or late</span></div>${last.length ? `<div class="daystrip">${last.map(a => `<div class="day" title="${esc(a.status)}">${esc(fmtDay(a.date))}<br>${new Date(a.date + 'T00:00:00').getDate()}<i class="${esc(a.status.toLowerCase().replace(/\s+/g, '-'))}"></i></div>`).join('')}</div>` + legend() : calm('📅', 'No attendance recorded yet')}</div>` +
    `<div class="play-panel"><h2>Records</h2>${
      own
        .slice(0, 10)
        .map(a =>
          itemRow({
            title: fmtDate(a.date) + ' · ' + esc(fmtDay(a.date)),
            meta: esc(
              [a.time ? fmtTime(a.time) : '', a.note, a.returnedAt ? 'Returned ' + fmtTime(a.returnedAt) : '']
                .filter(Boolean)
                .join(' · '),
            ),
            right: tag(a.status),
          }),
        )
        .join('') || '<p class="muted">Nothing yet.</p>'
    }<p class="tinyhint">Spot a mistake? ${btn('Request a correction', call('startRequest', 'Attendance Correction'), 'sm ghost')}</p></div>`
  );
}
export function legend() {
  return `<div class="legend">${[
    ['Present', '#0e9f9a'],
    ['Late', '#ffc800'],
    ['Absent', '#ff4b4b'],
    ['On Leave', '#a56cf0'],
    ['Outside Campus', '#1cb0f6'],
  ]
    .map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`)
    .join('')}</div>`;
}
export function campusOverview() {
  const t = today();
  const cls = S.db.classes
    .map(cl => {
      const st = classStudents(cl),
        mk = st.filter(s => att(s.id, t)).length,
        sb = subOf(cl, t);
      return `<div class="card"><div class="play-panel-head"><h3 class="sectiontitle" style="margin:0">${esc(cl)}</h3>${sb ? tag(sb.verified ? 'Verified' : 'Submitted') : tag('Not submitted')}</div><div class="progress"><div style="width:${st.length ? (mk / st.length) * 100 : 0}%"></div></div><p class="muted" style="margin:8px 0 0">${mk} of ${st.length} marked${sb ? ' · by ' + esc(sb.by) + ' at ' + fmtTime(sb.at.split(' ')[1]) : ''}</p><div class="actions" style="margin-top:10px">${btn('View roster', call('rosterModal', cl, t), 'sm')}</div></div>`;
    })
    .join('');
  const tc = st => S.db.attendance.filter(a => a.date === t && a.status === st).length;
  return `<div class="row2">${cls}</div><div class="play-panel"><h2>Today across campus</h2><div class="row3">${STATUSES.map(s => `<div>${tag(s)} <b style="font-size:20px;margin-left:6px">${tc(s)}</b></div>`).join('')}<div>${tag('Not marked')} <b style="font-size:20px;margin-left:6px">${S.db.students.length - S.db.attendance.filter(a => a.date === t).length}</b></div></div>${outsideNow().length ? `<div style="margin-top:14px">${btn('See who is outside campus →', "go('Attendance','Outside Campus')", 'sm')}</div>` : ''}</div>`;
}
export function rosterModal(cl, d) {
  const st = classStudents(cl),
    sb = subOf(cl, d);
  modal(
    mhead(
      cl + ' · ' + fmtDate(d),
      sb
        ? 'Submitted by ' +
            esc(sb.by) +
            (sb.verified ? ' · verified by ' + esc(sb.verifiedBy) : ' · not verified yet')
        : 'Not submitted',
    ) +
      st
        .map(s => {
          const r = att(s.id, d);
          return itemRow({
            icon: avatar(s.name, s.id),
            title: esc(s.name),
            meta: esc(r ? [r.time ? fmtTime(r.time) : '', r.note].filter(Boolean).join(' · ') : ''),
            right: tag(r ? r.status : 'Not marked'),
          });
        })
        .join('') +
      (isAA() && sb && !sb.verified
        ? `<div class="formactions">${btn('Verify this attendance', call('verifySub', cl, d), 'primary')}</div>`
        : ''),
    'wide',
  );
}
export function markAttendancePage() {
  const cls = markableClasses();
  if (!cls.length) return calm('📅', 'No classes yet', 'The Admin adds classes in Settings → Institution.');
  if (!cls.includes(markClass)) markClass = cls[0];
  const t = today();
  if (!markDate || markDate > t || markDate < addDays(t, -7)) markDate = t;
  const st = classStudents(markClass),
    sb = subOf(markClass, markDate),
    mk = st.filter(s => att(s.id, markDate)).length;
  const head = `<div class="card" style="margin-bottom:16px"><div class="actions" style="justify-content:space-between"><div class="actions">${cls.map(c => `<button class="btn sm ${c === markClass ? 'primary' : ''}" onclick="${call('setMarkClass', c)}">${esc(c)}</button>`).join('')}</div><label class="actions" style="font-weight:800">Date <input class="field" type="date" value="${markDate}" min="${addDays(t, -7)}" max="${t}" onchange="setMarkDate(this.value)"></label></div><div class="seg view-seg" role="group" aria-label="View" style="margin-top:12px"><button class="${markView === 'bench' ? 'on' : ''}" aria-pressed="${markView === 'bench'}" onclick="setMarkView('bench')">🪑 Benches</button><button class="${markView === 'list' ? 'on' : ''}" aria-pressed="${markView === 'list'}" onclick="setMarkView('list')">☰ List</button></div></div>`;
  if (!st.length) return head + calm('🎓', 'No students in ' + markClass);
  if (markView === 'bench') return head + benchViewHTML();
  return (
    head +
    `<div class="card"><div class="play-panel-head"><h3 class="sectiontitle" style="margin:0">${esc(markClass)} · ${fmtDate(markDate)}</h3>${mk < st.length ? btn('Mark remaining as Present', 'markRemaining()', 'sm') : ''}</div>` +
    st
      .map(s => {
        const r = att(s.id, markDate),
          lv = leaveCovering(s.id, markDate);
        return `<div class="markrow">${avatar(s.name, s.id)}<div class="grow"><div class="title" style="font-weight:850">${esc(s.name)} <span class="muted" style="font-weight:650;font-size:12px">${esc(s.roll)}</span></div><div class="meta" style="font-size:12px;color:var(--muted)">${lv ? `<span class="chip">🌙 Approved leave application</span>` : ''}${r && r.status === 'Outside Campus' ? `Out since ${fmtTime(r.time)}${r.note ? ' · ' + esc(r.note) : ''}` : ''}${r && r.returnedAt ? `Returned ${fmtTime(r.returnedAt)}` : ''}</div></div><div class="seg" role="group" aria-label="Status for ${esc(s.name)}">${STATUSES.map(x => `<button class="${r?.status === x ? 'on ' : ''}s-${x.toLowerCase().replace(/\s+/g, '-')}" aria-pressed="${r?.status === x}" onclick="${call('setMark', s.id, x)}">${SHORT[x]}</button>`).join('')}</div></div>`;
      })
      .join('') +
    `</div>` +
    `<div class="sticky-submit"><div><b>${mk} of ${st.length} marked</b><div class="muted" style="font-size:12px">${sb ? `Submitted by ${esc(sb.by)} · ${esc(rel(sb.at))}${sb.verified ? ' · verified' : ''}` : 'Each tap is saved instantly. Submit when everyone is marked.'}</div></div>${btn(sb ? 'Re-submit attendance' : 'Submit attendance', 'submitAttendance()', 'primary')}</div>`
  );
}
export function setMarkClass(c) {
  if (isArranging()) return toast('Save or cancel the seating first', 'err');
  markClass = c;
  render();
}
export function setMarkDate(d) {
  markDate = d;
  render();
}
export function setMark(sid, status) {
  if (status === 'Outside Campus') {
    outsideModal(sid, markDate);
    return;
  }
  const r = att(sid, markDate);
  if (r && r.status === status) return;
  setAtt(sid, markDate, status);
  save();
  render();
}
export function markRemaining() {
  classStudents(markClass).forEach(s => {
    if (!att(s.id, markDate)) setAtt(s.id, markDate, 'Present');
  });
  commit('Remaining students marked Present', false);
}
export function submitAttendance() {
  const st = classStudents(markClass),
    left = st.filter(s => !att(s.id, markDate));
  if (left.length) {
    toast(
      plural(left.length, 'student') + ' still unmarked: ' + left.map(s => firstName(s.name)).join(', '),
      'err',
    );
    return;
  }
  let sb = subOf(markClass, markDate);
  if (sb) {
    sb.at = stamp();
    sb.by = actorName();
    sb.verified = false;
    sb.verifiedBy = '';
  } else
    S.db.attSubs.push({
      class: markClass,
      date: markDate,
      by: actorName(),
      at: stamp(),
      verified: false,
      verifiedBy: '',
    });
  const ref = 'sub:' + markDate + '|' + markClass;
  resolveRef(ref);
  notify(
    'position:Academic Assistant',
    `${markClass} attendance for ${fmtDate(markDate)} submitted by ${actorName()} — ready to verify`,
    { icon: '✅', ref, action: true, link: ['Verification', 'Attendance Submissions'] },
  );
  commit(markClass + ' attendance submitted 🎉', false);
}
export function outsideModal(sid, date) {
  const s = S.db.students.find(x => x.id === sid),
    r = att(sid, date);
  modal(
    mhead('Record outside campus', esc(s.name) + ' · ' + fmtDate(date)) +
      formHTML(
        'outside',
        [
          `<input type="hidden" name="sid" value="${sid}"><input type="hidden" name="date" value="${date}">`,
          F('time', 'Time left campus', 'time', {
            value: r?.status === 'Outside Campus' ? r.time : nowTime(),
          }),
          F('note', 'Reason / where', 'text', {
            value: r?.note || '',
            ph: 'e.g. University office',
            full: true,
            hint: 'Keep it short and non-sensitive.',
          }),
        ],
        'Save',
      ),
  );
}
FORMS.outside = v => {
  setAtt(+v.sid, v.date, 'Outside Campus', { time: v.time, note: v.note });
  commit(firstName(sName(+v.sid)) + ' recorded outside campus');
};
export function outsidePage() {
  const out = outsideNow().sort((a, b) => a.time.localeCompare(b.time)),
    ret = S.db.attendance.filter(a => a.date === today() && a.returnedAt);
  return (
    `<div class="play-panel" style="margin-top:0"><div class="play-panel-head"><h2>🚶 Currently recorded outside campus</h2><span class="chip">${out.length}</span></div>${out.length ? out.map(a => itemRow({ icon: avatar(sName(a.studentId), a.studentId), title: esc(sName(a.studentId)) + ` <span class="muted" style="font-weight:650">· ${esc(sClass(a.studentId))}</span>`, meta: `Out since ${fmtTime(a.time)}${a.note ? ' · ' + esc(a.note) : ''} · recorded by ${esc(a.by || 'staff')}`, right: canEditAttendance() ? btn('Mark returned', call('markReturned', a.id), 'sm') : '', onclick: call('studentDetail', a.studentId) })).join('') : calm('🏫', 'Everyone recorded today is on campus')}</div>` +
    (canEditAttendance()
      ? card(
          'Record a student outside campus',
          formHTML(
            'outside2',
            [
              F('sid', 'Student', 'select', {
                options: S.db.students.map(s => [s.id, s.name + ' · ' + s.class]),
                placeholder: 'Choose a student',
              }),
              F('time', 'Time left', 'time', { value: nowTime() }),
              F('note', 'Reason / where', 'text', { full: true, ph: 'e.g. University office' }),
            ],
            'Record',
          ),
          'style="margin-top:20px"',
        )
      : '') +
    (ret.length
      ? `<div class="play-panel"><h2>↩️ Returned today</h2>${ret.map(a => itemRow({ title: esc(sName(a.studentId)), meta: `Out ${fmtTime(a.outAt)} → back ${fmtTime(a.returnedAt)}`, right: tag(a.status) })).join('')}</div>`
      : '')
  );
}
FORMS.outside2 = v => {
  const r = att(+v.sid, today());
  if (r && r.status === 'Outside Campus') return { field: 'sid', msg: 'Already recorded outside campus' };
  setAtt(+v.sid, today(), 'Outside Campus', { time: v.time, note: v.note });
  commit(firstName(sName(+v.sid)) + ' recorded outside campus');
};
export function markReturned(id) {
  const a = S.db.attendance.find(x => x.id === id);
  if (!a) return;
  a.outAt = a.time;
  a.returnedAt = nowTime();
  a.status = 'Present';
  a.by = actorName();
  commit(firstName(sName(a.studentId)) + ' marked as returned', false);
}
export function historyPage() {
  const cls = S.role === 'Staff' && myClasses().length ? myClasses() : S.db.classes,
    dates = [...new Set(S.db.attendance.map(a => a.date))].sort().reverse().slice(0, 14);
  const rows = [];
  dates.forEach(d =>
    cls.forEach(cl => {
      const st = classStudents(cl),
        rs = st.map(s => att(s.id, d)).filter(Boolean),
        c = x => rs.filter(r => r.status === x).length,
        sb = subOf(cl, d);
      if (!rs.length && !sb) return;
      rows.push([
        fmtDate(d) + ' <span class="muted">' + esc(fmtDay(d)) + '</span>',
        esc(cl),
        `<b>${c('Present')}</b> / ${c('Late')} / ${c('Absent')} / ${c('On Leave')} / ${c('Outside Campus')}`,
        sb ? tag(sb.verified ? 'Verified' : 'Submitted') : tag('Not submitted'),
        btn('View', call('rosterModal', cl, d), 'sm') +
          (markableClasses().includes(cl) && d >= addDays(today(), -7)
            ? ' ' + btn('Edit', call('markOpen', cl, d), 'sm')
            : ''),
      ]);
    }),
  );
  return card(
    'Last 14 recorded days',
    table(['Date', 'Class', 'Present / Late / Absent / Leave / Outside', 'Submission', ''], rows),
  );
}
export function leaveStatusPage() {
  const t = today();
  if (S.role === 'Student') {
    const s = me(),
      rec = S.db.attendance
        .filter(a => a.studentId === s.id && a.status === 'On Leave')
        .sort((a, b) => b.date.localeCompare(a.date)),
      apps = S.db.leaves.filter(l => l.studentId === s.id && l.status !== 'Rejected' && l.to >= t);
    return `<div class="softinfo">A leave <b>application</b> and your official <b>attendance record</b> are separate. Staff record “On Leave” in attendance explicitly.</div><div class="row2">${card('Upcoming / active applications', apps.length ? apps.map(l => itemRow({ title: fmtRange(l.from, l.to) + ' · ' + esc(l.type), right: tag(l.status), onclick: call('leaveDetail', l.id) })).join('') : calm('🌙', 'No active applications', '', btn('Apply for leave', "go('Leave Application','Apply')", 'primary')))}${card('Recorded as On Leave in attendance', rec.length ? rec.map(a => itemRow({ title: fmtDate(a.date), meta: esc(a.by || ''), right: tag('On Leave') })).join('') : '<p class="muted">No attendance days are recorded as On Leave.</p>')}</div>`;
  }
  const scope =
    S.role === 'Staff' && myClasses().length
      ? S.db.students.filter(s => myClasses().includes(s.class)).map(s => s.id)
      : S.db.students.map(s => s.id);
  const apps = S.db.leaves
    .filter(
      l =>
        scope.includes(l.studentId) &&
        ['Approved', 'Awaiting Clearance', 'Cleared'].includes(l.status) &&
        l.to >= addDays(t, -7),
    )
    .sort((a, b) => a.from.localeCompare(b.from));
  const rec = S.db.attendance
    .filter(a => scope.includes(a.studentId) && a.status === 'On Leave' && a.date >= addDays(t, -14))
    .sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="softinfo">Approved applications are shown for planning only. They do <b>not</b> change attendance — record “On Leave” yourself when appropriate.</div><div class="row2">${card('Approved leave applications', apps.length ? apps.map(l => itemRow({ icon: avatar(sName(l.studentId), l.studentId), title: esc(sName(l.studentId)), meta: fmtRange(l.from, l.to) + ' · ' + esc(l.type), right: tag(l.status), onclick: call('leaveDetail', l.id) })).join('') : '<p class="muted">No approved leave in this period.</p>')}${card('Recorded as On Leave (last 14 days)', rec.length ? rec.map(a => itemRow({ title: esc(sName(a.studentId)), meta: fmtDate(a.date) + ' · ' + esc(a.by || ''), right: tag('On Leave') })).join('') : '<p class="muted">No On Leave records.</p>')}</div>`;
}
