import { HOMES } from '../app/registry.js';
import { counts, navAll } from '../app/structure.js';
import { canDecide, isUnread, me, myClasses, myNotifs } from '../lib/permissions.js';
import {
  addDays,
  avatar,
  esc,
  firstName,
  fmtDate,
  fmtRange,
  fmtTime,
  greet,
  money,
  plural,
  rel,
  sName,
  today,
} from '../lib/utils.js';
import {
  att,
  attPct,
  classStudents,
  feeStatus,
  importantBanner,
  outsideNow,
  shortcuts,
  subOf,
  updatesPanel,
  welcome,
} from './shared.js';
import { S } from '../state.js';
import { btn, call, calm, itemRow, tag, taskRow } from '../ui/components.js';
/* ==========================================================================
   HOME SCREENS — task first, progressive disclosure
   ========================================================================== */
HOMES.Student = () => {
  const s = me(),
    t = today(),
    r = att(s.id, t),
    { n, pct } = attPct(s.id);
  const cele = myNotifs().find(x => x.kind === 'celebrate' && isUnread(x));
  const fees = S.db.fees.filter(f => f.studentId === s.id && f.status !== 'Paid'),
    over = fees.find(f => feeStatus(f) === 'Overdue'),
    soon = fees
      .filter(f => f.due >= t && f.due <= addDays(t, 7))
      .sort((a, b) => a.due.localeCompare(b.due))[0];
  const ready = S.db.requests.find(q => q.studentId === s.id && q.status === 'Completed' && !q.collected);
  let primary = '';
  if (over)
    primary = `<div class="banner">💳 <span>${esc(over.category)} (${money(over.amount)}) was due on ${fmtDate(over.due)}.</span><button class="btn sm" style="margin-left:auto" onclick="go('Fees','Status')">View fee</button></div>`;
  else if (soon)
    primary = `<div class="banner">💳 <span>${esc(soon.category)} of ${money(soon.amount)} is due on ${fmtDate(soon.due)}.</span><button class="btn sm" style="margin-left:auto" onclick="go('Fees','Status')">View fee</button></div>`;
  const statusLine = r
    ? r.status === 'Outside Campus'
      ? 'Outside campus since ' + fmtTime(r.time)
      : r.status + (r.time ? ' · ' + fmtTime(r.time) : '')
    : 'Not recorded yet';
  const ring = pct >= 75 ? '#0e9f9a' : '#ffb020';
  return (
    welcome(
      'YOUR CAMPUS COMPANION',
      `${greet()}, ${esc(firstName(s.name))}! <span>👋</span>`,
      r || cele || primary ? 'Here’s what matters today.' : 'Nothing needs your attention. Have a calm day.',
    ) +
    (cele
      ? `<div class="celebrate"><span class="ce">🎉</span><div><b>${esc(cele.text)}</b><p>${cele.link ? 'Tap to see the details and next step.' : ''}</p></div><div class="actions x">${btn('View', 'openNotif(' + cele.id + ')', 'primary sm')}${btn('Dismiss', 'dismissNotif(' + cele.id + ')', 'sm')}</div></div>`
      : '') +
    importantBanner() +
    primary +
    `<div class="play-hero"><div class="hero-copy"><div class="hero-eyebrow">📅 TODAY · ${esc(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }))}</div><h2>${esc(r ? r.status : 'Not recorded')}<span> ${r ? '' : 'yet'}</span></h2><div class="today-chip">🕘 ${esc(statusLine)}</div><p>${n ? `Overall ${pct}% present or late across ${plural(n, 'recorded day')}.` : 'Your attendance appears here once staff record it.'}</p><button class="play-hero-button" onclick="go('Attendance','Overview')">See attendance →</button></div><div class="play-ring" style="--ring:${pct};--ringcolor:${ring}" aria-label="${pct}% attendance"><div><span>📘</span><strong>${pct}%</strong></div></div></div>` +
    (ready
      ? `<div class="play-panel">${itemRow({ icon: '<span class="taskicon t-green">📄</span>', title: esc(ready.type) + ' is ready', meta: esc(ready.note || 'Collect it from the office.'), right: btn('Details', call('requestDetail', ready.id), 'sm') })}</div>`
      : '') +
    shortcuts([
      ['📝', 'Apply for leave', 'A quick, simple request', 'Leave Application', 'Apply'],
      ['💻', 'Lab pass', 'Pick a free seat today', 'Lab Pass', 'Seat Map'],
      ['📄', 'Official request', 'Certificates & letters', 'Official Requests', 'New Request'],
      ['💳', 'Fees & receipts', 'Status and receipts', 'Fees', 'Status'],
    ]) +
    updatesPanel(3, 'celebrate')
  );
};
export function staffTasks() {
  const t = today(),
    T = [],
    c = counts();
  myClasses().forEach(cl => {
    if (!subOf(cl, t)) {
      const st = classStudents(cl),
        mk = st.filter(s => att(s.id, t)).length;
      T.push(
        taskRow(
          '📅',
          'orange',
          `Today’s ${cl} attendance is not yet submitted`,
          `${mk} of ${st.length} students marked`,
          call('markOpen', cl, t),
        ),
      );
    }
  });
  if (c['Leave Clearance'])
    T.push(
      taskRow(
        '🗂️',
        'purple',
        plural(c['Leave Clearance'], 'approved leave') + ' waiting for clearance',
        'Record clearance after approval',
        call('go', 'Leave Clearance', 'Awaiting Clearance'),
      ),
    );
  [
    ['Attendance Submissions', '✅', 'attendance submission', 'to verify'],
    ['Medical Requests', '✚', 'medical request', 'to verify'],
    ['Corrections', '🛠️', 'correction request', 'waiting'],
    ['Follow-ups', '👀', 'student follow-up', 'open'],
  ].forEach(([s, i, w, x]) => {
    const n = c['Verification/' + s];
    if (n)
      T.push(
        taskRow(i, 'blue', plural(n, w) + ' ' + x, 'Verification · ' + s, call('go', 'Verification', s)),
      );
  });
  if (c['Library'])
    T.push(
      taskRow(
        '📚',
        'green',
        plural(c['Library'], 'library clearance request') + ' waiting',
        'Librarian responsibility',
        call('go', 'Library', 'Clearance Requests'),
      ),
    );
  if (S.role !== 'Admin' && c['Computer Lab'])
    T.push(
      taskRow(
        '💻',
        'blue',
        plural(c['Computer Lab'], 'lab pass request') + ' waiting for review',
        'Lab Charge responsibility',
        call('go', 'Computer Lab', 'Passes'),
      ),
    );
  return T;
}
export function outsideRow() {
  const o = outsideNow().length;
  return o
    ? taskRow(
        '🚶',
        'blue',
        plural(o, 'student is', 'students are') + ' currently recorded outside campus',
        'Tap to see names and times',
        call('go', 'Attendance', 'Outside Campus'),
      )
    : '';
}
HOMES.Staff = () => {
  const m = me(),
    T = staffTasks(),
    reviews = T.length,
    out = outsideRow();
  const subtitle = reviews
    ? `You have ${plural(reviews, 'thing')} that need${reviews === 1 ? 's' : ''} your attention.`
    : 'Nothing needs your attention right now.';
  const nav = navAll().map(n => n.page),
    sc = [];
  if (nav.includes('My Students') && myClasses().length)
    sc.push(
      ['📅', 'Mark attendance', myClasses().join(', '), 'Attendance', 'Mark Attendance'],
      ['👥', 'My students', 'Roster, marks, follow-ups', 'My Students', 'Class Roster'],
    );
  if (nav.includes('Leave Clearance'))
    sc.push(['🗂️', 'Leave clearance', 'Approved leave to clear', 'Leave Clearance', 'Awaiting Clearance']);
  if (nav.includes('Library'))
    sc.push(['📚', 'Library', 'Clearance & student status', 'Library', 'Clearance Requests']);
  if (nav.includes('Computer Lab'))
    sc.push(['💻', 'Computer lab', 'Seats and passes', 'Computer Lab', 'Seat Map']);
  sc.push(['🚶', 'Outside campus', 'Record or check returns', 'Attendance', 'Outside Campus']);
  return (
    welcome(
      (m.positions.join(' · ') || 'STAFF').toUpperCase(),
      `${greet()}, ${esc(m.name)}! <span>☀️</span>`,
      subtitle,
      '📚',
    ) +
    importantBanner() +
    `<div class="tasklist">${T.join('')}${out}</div>` +
    (!T.length && !out
      ? calm('🌿', 'All clear', 'Your tasks will appear here when something needs you.')
      : '') +
    shortcuts(sc) +
    updatesPanel(2)
  );
};
HOMES['Academic Assistant'] = () => {
  const m = me(),
    T = staffTasks(),
    out = outsideRow();
  return (
    welcome(
      'ACADEMIC OPERATIONS',
      `${greet()}, ${esc(m.ghost ? 'there' : m.name)}! <span>🗂️</span>`,
      T.length
        ? `${plural(T.length, 'queue')} need${T.length === 1 ? 's' : ''} your attention today.`
        : 'Every queue is clear. Nice and calm.',
      '🗂️',
    ) +
    (m.ghost
      ? `<div class="banner">ℹ️ No staff member holds the Academic Assistant position yet. Admin can assign it in Staff Management.</div>`
      : '') +
    importantBanner() +
    `<div class="tasklist">${T.join('')}${out}</div>` +
    (!T.length && !out
      ? calm('🌿', 'All clear', 'Clearances, verifications and follow-ups will appear here.')
      : '') +
    shortcuts([
      ['🗂️', 'Leave clearance', 'Approved leave to clear', 'Leave Clearance', 'Awaiting Clearance'],
      ['✅', 'Verification', 'Attendance & medical', 'Verification', 'Attendance Submissions'],
      ['👀', 'Follow-ups', 'Student status checks', 'Verification', 'Follow-ups'],
      ['📅', 'Attendance', 'Today across campus', 'Attendance', 'Overview'],
    ]) +
    updatesPanel(2)
  );
};
export function leaderHome() {
  const L = canDecide('leaveAuthority'),
    Fz = canDecide('feeAuthority'),
    T = [];
  const pl = S.db.leaves.filter(l => l.status === 'Pending'),
    pf = S.db.feeTasks.filter(f => f.status === 'Pending');
  if (L && pl.length)
    T.push(
      taskRow(
        '📨',
        'orange',
        plural(pl.length, 'leave application') + ' waiting for your decision',
        'Oldest: ' +
          esc(sName(pl.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0].studentId)),
        call('go', 'Leave Decisions', 'Pending'),
      ),
    );
  if (Fz && pf.length)
    T.push(
      taskRow(
        '🧾',
        'purple',
        plural(pf.length, 'fee task') + ' need authorization',
        'Extensions and concessions',
        call('go', 'Fee Authorization', 'Pending'),
      ),
    );
  const recent = [
    ...S.db.leaves
      .filter(l => l.decidedBy === S.role)
      .map(l => ({
        at: l.decidedAt,
        t: 'Leave · ' + sName(l.studentId),
        s: l.status === 'Rejected' ? 'Rejected' : 'Approved',
        fn: call('leaveDetail', l.id),
      })),
    ...S.db.feeTasks
      .filter(f => f.decidedBy === S.role)
      .map(f => ({
        at: f.decidedAt,
        t: 'Fee ' + f.kind.toLowerCase() + ' · ' + sName(f.studentId),
        s: f.status,
        fn: call('feeTaskDetail', f.id),
      })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3);
  const note =
    !L || !Fz
      ? `<div class="banner">ℹ️ Current configuration: leave decisions — ${esc(S.db.settings.leaveAuthority)}; fee authorization — ${esc(S.db.settings.feeAuthority)}.</div>`
      : '';
  return (
    welcome(
      'APPROVAL WORKSPACE',
      `${greet()}, ${esc(S.role)}! <span>🖋️</span>`,
      T.length ? 'Here is what is waiting for your decision.' : 'No decisions are waiting. Enjoy the quiet.',
      '🖋️',
    ) +
    importantBanner() +
    note +
    `<div class="tasklist">${T.join('')}</div>` +
    (!T.length
      ? calm('🌿', 'Nothing to decide right now', 'New applications will appear here automatically.')
      : '') +
    (L && pl.length
      ? `<div class="play-panel"><h2>📨 Next up</h2>${pl
          .slice(0, 3)
          .map(l =>
            itemRow({
              icon: avatar(sName(l.studentId), l.studentId),
              title: esc(sName(l.studentId)) + ' · ' + esc(l.type),
              meta: fmtRange(l.from, l.to) + ' · ' + esc(l.reason),
              onclick: call('leaveDetail', l.id),
              right: btn('Review', call('leaveDetail', l.id), 'sm'),
            }),
          )
          .join('')}</div>`
      : '') +
    (recent.length
      ? `<div class="play-panel"><h2>🕘 Recently decided</h2>${recent.map(x => itemRow({ title: esc(x.t), meta: esc(rel(x.at)), right: tag(x.s), onclick: x.fn })).join('')}</div>`
      : '') +
    updatesPanel(2)
  );
}
HOMES.Principal = leaderHome;
HOMES['Vice Principal'] = leaderHome;
HOMES.Admin = () => {
  const t = today(),
    T = [],
    c = counts();
  if (c['Official Requests'])
    T.push(
      taskRow(
        '📄',
        'blue',
        plural(c['Official Requests'], 'official request') + ' in the office queue',
        'Certificates, letters and more',
        call('go', 'Official Requests', 'Queue'),
      ),
    );
  const adm = S.db.admissions.filter(a => ['Received', 'Under Review'].includes(a.status)).length;
  if (adm)
    T.push(
      taskRow(
        '➕',
        'purple',
        plural(adm, 'admission application') + ' to review',
        'Admissions pipeline',
        call('go', 'Admissions', 'Pipeline'),
      ),
    );
  const ns = S.db.classes.filter(cl => classStudents(cl).length && !subOf(cl, t));
  if (ns.length)
    T.push(
      taskRow(
        '📅',
        'orange',
        'Attendance not yet submitted: ' + ns.join(', '),
        'Teachers have been reminded on their home screen',
        call('go', 'Attendance', 'Monitoring'),
      ),
    );
  const miss = ['Librarian', 'Lab Charge', 'Academic Assistant'].filter(
    p => !S.db.staff.some(s => s.positions.includes(p)),
  );
  if (miss.length)
    T.push(
      taskRow(
        '🧑‍🏫',
        'orange',
        'Unassigned position' + (miss.length > 1 ? 's' : '') + ': ' + miss.join(', '),
        'Assign in Staff Management',
        call('go', 'Staff Management', 'Staff & Positions'),
      ),
    );
  const od = S.db.fees.filter(f => feeStatus(f) === 'Overdue');
  if (od.length)
    T.push(
      taskRow(
        '⚠️',
        'red',
        plural(od.length, 'fee') + ' overdue · ' + money(od.reduce((a, f) => a + +f.amount, 0)),
        'Review and follow up',
        call('feeFilterGo', 'Overdue'),
      ),
    );
  const rec = S.db.attendance.filter(a => a.date === t).length,
    tot = S.db.students.length,
    col = S.db.fees.filter(f => f.status === 'Paid').reduce((a, f) => a + +f.amount, 0);
  return (
    welcome(
      'ADMIN WORKSPACE',
      `${greet()}, Admin! <span>✨</span>`,
      T.length ? `${plural(T.length, 'item')} could use your attention.` : 'Everything is running smoothly.',
      '🗂️',
    ) +
    importantBanner() +
    `<div class="tasklist">${T.join('')}${outsideRow()}</div>` +
    (!T.length ? calm('🌿', 'All clear', 'Pending decisions and alerts will appear here.') : '') +
    `<h2 class="play-heading">At a glance</h2><div class="play-stats">${[
      ['🎓', 'Students', tot, 'Students', 'Directory'],
      ['🧑‍🏫', 'Staff', S.db.staff.length, 'Staff Management', 'Staff & Positions'],
      ['📅', 'Recorded today', (tot ? Math.round((rec / tot) * 100) : 0) + '%', 'Attendance', 'Monitoring'],
      ['💳', 'Fees collected', money(col), 'Reports', 'Fees'],
    ]
      .map(
        ([i, l, v, p, s], k) =>
          `<button class="play-mini tone-${k}" style="text-align:left" onclick="${call('go', p, s)}"><span class="play-mini-icon">${i}</span><strong>${esc(v)}</strong><span>${esc(l)}</span></button>`,
      )
      .join('')}</div>` +
    updatesPanel(3)
  );
};
