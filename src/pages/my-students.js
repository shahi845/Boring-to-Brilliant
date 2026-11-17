import { FORMS, PAGES } from '../app/registry.js';
import { notify } from '../lib/notifications.js';
import { me, myClasses } from '../lib/permissions.js';
import { avatar, esc, fmtDate, nextId, sName, stamp, today } from '../lib/utils.js';
import { att, attPct, classStudents } from './shared.js';
import { S } from '../state.js';
import { btn, call, calm, card, heading, itemRow, tabs, tag } from '../ui/components.js';
import { confirmBox } from '../ui/feedback.js';
import { F, commit, formHTML } from '../ui/forms.js';
/* ==========================================================================
   MY STUDENTS (teacher)
   ========================================================================== */
PAGES['My Students'] = () => {
  const cls = myClasses(),
    studs = S.db.students.filter(s => cls.includes(s.class)),
    h = heading('My students', cls.join(' · ') || 'No classes assigned') + tabs();
  if (S.section === 'Class Roster')
    return (
      h +
      (studs.length
        ? cls
            .map(cl =>
              card(
                cl,
                classStudents(cl)
                  .map(s => {
                    const r = att(s.id, today()),
                      { pct } = attPct(s.id);
                    return itemRow({
                      icon: avatar(s.name, s.id),
                      title: esc(s.name),
                      meta: esc(s.roll) + ' · ' + pct + '% overall',
                      right: tag(r ? r.status : 'Not marked'),
                      onclick: call('studentDetail', s.id),
                    });
                  })
                  .join(''),
                'style="margin-bottom:16px"',
              ),
            )
            .join('')
        : calm('👥', 'No students in your classes'))
    );
  if (S.section === 'Marks') {
    const mine = S.db.marks.filter(m => m.by === me().name).sort((a, b) => b.id - a.id);
    return (
      h +
      `<div class="row2">${card('Enter marks', formHTML('mark', [F('sid', 'Student', 'select', { options: studs.map(s => [s.id, s.name + ' · ' + s.roll]), placeholder: 'Choose a student', full: true }), F('subject', 'Subject / assessment', 'text', { full: true, ph: 'e.g. Sociology – Unit test 2' }), F('marks', 'Marks (out of 100)', 'number', { min: 0, maxv: 100 })], 'Save marks'))}${card(
        'Recently entered',
        mine.length
          ? mine
              .slice(0, 8)
              .map(m =>
                itemRow({
                  title: esc(sName(m.studentId)),
                  meta: esc(m.subject) + ' · ' + fmtDate(m.date),
                  right: `<b>${m.marks}</b>/100 ` + btn('✕', call('removeMark', m.id), 'sm ghost'),
                }),
              )
              .join('')
          : '<p class="muted">No marks entered yet.</p>',
      )}</div>`
    );
  }
  const mine = S.db.followups.filter(f => f.raisedById === me().id).sort((a, b) => b.id - a.id);
  return (
    h +
    `<div class="row2">${card('Raise a follow-up', `<p class="muted" style="margin-top:0">Ask the Academic Assistant to check on a student.</p>` + formHTML('followup', [F('sid', 'Student', 'select', { options: studs.map(s => [s.id, s.name]), placeholder: 'Choose a student', full: true }), F('note', 'What’s the concern?', 'textarea', { full: true })], 'Send to Academic Assistant'))}${card('My follow-ups', mine.length ? mine.map(f => itemRow({ title: esc(sName(f.studentId)), meta: esc(f.resolution || f.note), right: tag(f.status), onclick: call('followupDetail', f.id) })).join('') : '<p class="muted">None yet.</p>')}</div>`
  );
};
FORMS.mark = v => {
  const m = +v.marks;
  if (S.db.marks.some(x => x.studentId === +v.sid && x.subject.toLowerCase() === v.subject.toLowerCase()))
    return { field: 'subject', msg: 'Marks for this assessment are already recorded for this student' };
  S.db.marks.push({
    id: nextId(S.db.marks),
    studentId: +v.sid,
    subject: v.subject,
    marks: m,
    by: me().name,
    date: today(),
  });
  commit('Marks saved', false);
};
export function removeMark(id) {
  confirmBox(
    'Remove these marks?',
    'This can’t be undone.',
    'Remove',
    () => {
      S.db.marks = S.db.marks.filter(m => m.id !== id);
      commit('Marks removed');
    },
    true,
  );
}
FORMS.followup = v => {
  if (S.db.followups.some(f => f.studentId === +v.sid && f.status === 'Open'))
    return 'There is already an open follow-up for this student';
  const id = nextId(S.db.followups);
  S.db.followups.push({
    id,
    studentId: +v.sid,
    note: v.note,
    raisedBy: me().name,
    raisedById: me().id,
    status: 'Open',
    createdAt: stamp(),
  });
  notify('position:Academic Assistant', me().name + ' raised a follow-up for ' + sName(+v.sid), {
    icon: '👀',
    ref: 'fu:' + id,
    action: true,
    link: ['Verification', 'Follow-ups', 'fu:' + id],
  });
  commit('Follow-up sent to the Academic Assistant', false);
};
