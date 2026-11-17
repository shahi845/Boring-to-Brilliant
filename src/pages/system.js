import { FORMS, PAGES } from '../app/registry.js';
import { go } from '../app/router.js';
import {
  AUTHORITY,
  BUILTIN_POSITIONS,
  HANDLERS,
  POSITION_INFO,
  REQUEST_TYPES,
  STATUSES,
} from '../lib/constants.js';
import { notify } from '../lib/notifications.js';
import { allPositions } from '../lib/permissions.js';
import { save } from '../lib/store.js';
import { esc, fmtRange, money, nextId, plural, rel, sClass, sName, stamp, today } from '../lib/utils.js';
import { classStudents, feeStatus } from './shared.js';
import { S } from '../state.js';
import { btn, call, calm, card, heading, itemRow, table, tabs, tag } from '../ui/components.js';
import { toast } from '../ui/feedback.js';
import { F, commit, formHTML } from '../ui/forms.js';
/* ==========================================================================
   REPORTS, ANNOUNCEMENTS, SETTINGS
   ========================================================================== */
PAGES.Reports = () => {
  const h =
    heading(
      'Reports',
      'Live summaries from your campus data.',
      btn('Export CSV', call('exportCSV', S.section), 'primary'),
    ) + tabs();
  if (S.section === 'Attendance') {
    const per = S.db.classes.map(cl => {
      const ids = classStudents(cl).map(s => s.id),
        rs = S.db.attendance.filter(a => ids.includes(a.studentId)),
        p = rs.filter(a => ['Present', 'Late'].includes(a.status)).length;
      return [cl, rs.length ? Math.round((p / rs.length) * 100) : 0, rs.length];
    });
    return (
      h +
      card(
        'Present or late, by class',
        per
          .map(
            ([c, p, n]) =>
              `<div class="bar"><span class="lbl">${esc(c)}</span><div class="trk"><div style="width:${p}%"></div></div><span class="val">${p}%</span></div>`,
          )
          .join('') +
          `<p class="tinyhint">Based on ${plural(S.db.attendance.length, 'recorded entry', 'recorded entries')}.</p>`,
      ) +
      card(
        'Status totals',
        `<div class="row3">${STATUSES.map(s => `<div>${tag(s)} <b style="font-size:20px;margin-left:6px">${S.db.attendance.filter(a => a.status === s).length}</b></div>`).join('')}</div>`,
        'style="margin-top:16px"',
      )
    );
  }
  if (S.section === 'Fees') {
    const sum = f => S.db.fees.filter(f).reduce((a, x) => a + +x.amount, 0),
      paid = sum(f => f.status === 'Paid'),
      pend = sum(f => feeStatus(f) === 'Pending'),
      over = sum(f => feeStatus(f) === 'Overdue'),
      tot = paid + pend + over || 1;
    return (
      h +
      `<div class="play-stats">${[
        ['💚', 'Collected', money(paid)],
        ['⏳', 'Pending', money(pend)],
        ['⚠️', 'Overdue', money(over)],
        ['🧾', 'Adjustments', S.db.feeTasks.length],
      ]
        .map(
          ([i, l, v], k) =>
            `<div class="play-mini tone-${k}"><span class="play-mini-icon">${i}</span><strong>${v}</strong><span>${l}</span></div>`,
        )
        .join('')}</div>` +
      card(
        'Collection',
        [
          ['Collected', paid],
          ['Pending', pend],
          ['Overdue', over],
        ]
          .map(
            ([l, v]) =>
              `<div class="bar"><span class="lbl">${l}</span><div class="trk"><div style="width:${(v / tot) * 100}%;${l === 'Overdue' ? 'background:#ff4b4b' : l === 'Pending' ? 'background:#ffc800' : ''}"></div></div><span class="val">${Math.round((v / tot) * 100)}%</span></div>`,
          )
          .join(''),
        'style="margin-top:16px"',
      )
    );
  }
  const st = ['Pending', 'Awaiting Clearance', 'Approved', 'Cleared', 'Rejected'];
  return (
    h +
    card(
      'Leave applications by status',
      `<div class="row3">${st.map(s => `<div>${tag(s)} <b style="font-size:20px;margin-left:6px">${S.db.leaves.filter(l => l.status === s).length}</b></div>`).join('')}</div>`,
    ) +
    card(
      'All applications',
      table(
        ['Student', 'Dates', 'Type', 'Status', ''],
        S.db.leaves
          .slice()
          .sort((a, b) => b.id - a.id)
          .map(l => [
            esc(sName(l.studentId)),
            fmtRange(l.from, l.to),
            esc(l.type),
            tag(l.status),
            btn('Open', call('leaveDetail', l.id), 'sm'),
          ]),
      ),
      'style="margin-top:16px"',
    )
  );
};
export function csv(v) {
  return '"' + String(v ?? '').replace(/"/g, '""') + '"';
}
export function download(name, content, mime) {
  const b = new Blob([content], { type: mime }),
    u = URL.createObjectURL(b),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export function exportCSV(kind) {
  let rows;
  if (kind === 'Fees')
    rows = [
      ['Student', 'Class', 'Fee', 'Amount', 'Due', 'Status', 'Receipt'],
      ...S.db.fees.map(f => [
        sName(f.studentId),
        sClass(f.studentId),
        f.category,
        f.amount,
        f.due,
        feeStatus(f),
        f.receipt || '',
      ]),
    ];
  else if (kind === 'Leave')
    rows = [
      ['Student', 'Class', 'Type', 'From', 'To', 'Status', 'Decided by', 'Cleared by'],
      ...S.db.leaves.map(l => [
        sName(l.studentId),
        sClass(l.studentId),
        l.type,
        l.from,
        l.to,
        l.status,
        l.decidedBy || '',
        l.clearedBy || '',
      ]),
    ];
  else
    rows = [
      ['Date', 'Student', 'Class', 'Status', 'Time', 'Note', 'Recorded by'],
      ...S.db.attendance
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(a => [a.date, sName(a.studentId), sClass(a.studentId), a.status, a.time, a.note, a.by || '']),
    ];
  download(
    'ourcampus-' + String(kind).toLowerCase() + '-report.csv',
    rows.map(r => r.map(csv).join(',')).join('\n'),
    'text/csv',
  );
  toast('CSV downloaded');
}
PAGES.Announcements = () => {
  if (S.section === 'Post')
    return (
      heading(
        'Announcements',
        'Share important news. Use “important” sparingly — it shows on home screens.',
      ) +
      tabs() +
      card(
        'New announcement',
        formHTML(
          'ann',
          [
            F('title', 'Title', 'text', { full: true }),
            F('body', 'Message', 'textarea', { full: true }),
            F('audience', 'Who should see it?', 'select', { options: ['Everyone', 'Students', 'Staff'] }),
            F('important', 'Important — show on home screens until read', 'checkbox'),
          ],
          'Publish',
        ),
      )
    );
  return (
    heading('Announcements', 'Everything published so far.') +
    tabs() +
    card(
      '',
      S.db.announcements.length
        ? S.db.announcements
            .slice()
            .sort((a, b) => b.at.localeCompare(a.at))
            .map(a =>
              itemRow({
                icon: '<span class="taskicon t-orange" style="width:40px;height:40px;font-size:19px">📢</span>',
                title: esc(a.title) + (a.important ? ' ' + tag('Important') : ''),
                meta: esc(a.body) + ' · ' + esc(a.audience) + ' · ' + esc(a.by) + ' · ' + esc(rel(a.at)),
              }),
            )
            .join('')
        : calm('📢', 'No announcements yet'),
    )
  );
};
FORMS.ann = v => {
  const id = nextId(S.db.announcements);
  S.db.announcements.push({
    id,
    title: v.title,
    body: v.body,
    audience: v.audience,
    important: !!v.important,
    by: S.role === 'Admin' ? 'Admin office' : S.role,
    at: stamp(),
  });
  notify(
    v.audience === 'Everyone' ? ['all'] : v.audience === 'Students' ? ['students'] : ['staffAll'],
    v.title,
    { icon: '📢', ref: 'ann:' + id, link: ['Notifications', 'All'] },
  );
  save();
  go('Announcements', 'History');
  toast('Announcement published');
};
PAGES.Settings = () => {
  const st = S.db.settings,
    h = heading('Settings', 'Configure how OURCAMPUS works for your institution.') + tabs();
  if (S.section === 'Institution')
    return (
      h +
      card(
        'Institution',
        formHTML(
          'inst',
          [
            F('institution', 'Institution name', 'text', { value: st.institution }),
            F('academicYear', 'Academic year', 'text', { value: st.academicYear }),
            F('classes', 'Classes (comma separated)', 'text', {
              value: S.db.classes.join(', '),
              full: true,
              hint: 'Removing a class doesn’t delete its students.',
            }),
          ],
          'Save',
        ),
      )
    );
  if (S.section === 'Workflow')
    return (
      h +
      card(
        'Approvals & routing',
        formHTML(
          'flow',
          [
            F('leaveAuthority', 'Leave decisions by', 'select', {
              options: AUTHORITY,
              value: st.leaveAuthority,
            }),
            F('feeAuthority', 'Fee authorization by', 'select', {
              options: AUTHORITY,
              value: st.feeAuthority,
            }),
            F('clearanceRequired', 'Approved leave needs Academic Assistant clearance', 'checkbox', {
              value: st.clearanceRequired,
              full: true,
            }),
            F('labMode', 'Lab passes', 'select', {
              options: [
                ['Approval', 'Students request · Lab Charge approves'],
                ['Instant', 'Students get a pass instantly'],
              ],
              value: st.labMode,
            }),
            `<div class="full"><b>Official request routing</b><div class="tinyhint">Who handles each request type.</div></div>`,
            ...REQUEST_TYPES.map(t =>
              F('route_' + t, t, 'select', { options: HANDLERS, value: st.routing[t] }),
            ),
          ],
          'Save workflow',
        ),
      )
    );
  if (S.section === 'Positions')
    return (
      h +
      `<div class="row2">${card('Built-in positions', BUILTIN_POSITIONS.map(p => itemRow({ title: esc(p), meta: esc(POSITION_INFO[p]), right: `<span class="chip grey">${S.db.staff.filter(s => s.positions.includes(p)).length} staff</span>` })).join(''))}${card('Institution-approved positions', (st.customPositions.length ? st.customPositions.map(p => itemRow({ title: esc(p), meta: 'Title only — adds no extra features or permissions', right: btn('Remove', call('removePosition', p), 'sm danger') })).join('') : '<p class="muted">None yet.</p>') + formHTML('pos', [F('name', 'New position title', 'text', { full: true, ph: 'e.g. Hostel Warden' })], 'Add position'))}</div>`
    );
  return (
    h +
    card(
      'Your data',
      `<p class="muted" style="margin-top:0">All campus data is stored securely in your Supabase database. Download a backup copy any time.</p><div class="actions">${btn('Export backup (JSON)', 'exportJSON()', 'primary')}${btn('Export attendance CSV', call('exportCSV', 'Attendance'))}${btn('Export fees CSV', call('exportCSV', 'Fees'))}</div>`,
    ) +
    card(
      'Sign-in accounts',
      `<p style="margin:0">Students sign in with their ST-… ID and staff with their SF-… ID. Create accounts when you add a student or staff member, and reset passwords with the <b>Password</b> button in Students or Staff Management.</p>`,
      'style="margin-top:16px"',
    )
  );
};
FORMS.inst = v => {
  const cls = [
    ...new Set(
      v.classes
        .split(',')
        .map(x => x.trim())
        .filter(Boolean),
    ),
  ];
  if (!cls.length) return { field: 'classes', msg: 'Add at least one class' };
  Object.assign(S.db.settings, { institution: v.institution, academicYear: v.academicYear });
  S.db.classes = cls;
  commit('Institution settings saved', false);
};
FORMS.flow = v => {
  const st = S.db.settings;
  st.leaveAuthority = v.leaveAuthority;
  st.feeAuthority = v.feeAuthority;
  st.clearanceRequired = !!v.clearanceRequired;
  st.labMode = v.labMode;
  REQUEST_TYPES.forEach(t => (st.routing[t] = v['route_' + t]));
  commit('Workflow saved — new items follow these rules', false);
};
FORMS.pos = v => {
  if (allPositions().some(p => p.toLowerCase() === v.name.toLowerCase()))
    return { field: 'name', msg: 'That position already exists' };
  S.db.settings.customPositions.push(v.name);
  commit('Position added', false);
};
export function removePosition(p) {
  if (S.db.staff.some(s => s.positions.includes(p)))
    return toast('Unassign this position from staff first', 'err');
  S.db.settings.customPositions = S.db.settings.customPositions.filter(x => x !== p);
  commit('Position removed', false);
}
export function exportJSON() {
  download('ourcampus-backup-' + today() + '.json', JSON.stringify(S.db, null, 2), 'application/json');
  toast('Backup downloaded');
}
