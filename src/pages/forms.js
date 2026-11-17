import { FORMS } from '../app/registry.js';
import { notify } from '../lib/notifications.js';
import { me } from '../lib/permissions.js';
import { esc, nextId, plural, rel, sName, stamp } from '../lib/utils.js';
import { S } from '../state.js';
import { btn, call, calm, card, itemRow, table } from '../ui/components.js';
import { confirmBox, mhead, modal } from '../ui/feedback.js';
import { F, commit, formHTML } from '../ui/forms.js';
/* ---------- forms (inside Attendance) ---------- */
export function formsPage() {
  if (S.role === 'Admin') {
    return (
      `<div class="row2">${card('Create a form', formHTML('newform', [F('title', 'Form title', 'text', { full: true }), F('description', 'Short description', 'text', { full: true }), F('prompt', 'Question students answer', 'text', { full: true, ph: 'e.g. What should be updated?' })], 'Create form'))}${card('Live forms', S.db.forms.length ? S.db.forms.map(f => itemRow({ title: esc(f.title), meta: esc(f.description) + ' · ' + plural(S.db.formSubs.filter(x => x.formId === f.id).length, 'submission'), right: btn('Remove', call('removeForm', f.id), 'sm danger') })).join('') : calm('▤', 'No forms yet'))}</div>` +
      card(
        'Submissions',
        table(
          ['Form', 'Student', 'Response', 'Date'],
          S.db.formSubs
            .slice()
            .reverse()
            .map(x => [esc(x.title), esc(sName(x.studentId)), esc(x.response), esc(rel(x.at))]),
        ),
        'style="margin-top:16px"',
      )
    );
  }
  const s = me(),
    mine = S.db.formSubs.filter(x => x.studentId === s.id).reverse();
  return (
    `<div class="choicegrid">${S.db.forms.map(f => `<button onclick="${call('openForm', f.id)}"><b>▤</b>${esc(f.title)}<div class="tinyhint" style="font-weight:600;margin-top:5px">${esc(f.description)}</div></button>`).join('') || calm('▤', 'No forms available right now')}</div>` +
    card(
      'My submissions',
      mine.length
        ? mine
            .map(x =>
              itemRow({
                title: esc(x.title),
                meta: esc(x.response),
                right: `<span class="muted">${esc(rel(x.at))}</span>`,
              }),
            )
            .join('')
        : '<p class="muted">You haven’t submitted any forms yet.</p>',
      'style="margin-top:16px"',
    )
  );
}
export function openForm(id) {
  const f = S.db.forms.find(x => x.id === id),
    s = me();
  if (!f) return;
  modal(
    mhead(f.title, esc(f.description)) +
      formHTML(
        'formsub',
        [
          `<input type="hidden" name="formId" value="${f.id}">`,
          F('n', 'Name', 'readonly', { value: s.name }),
          F('c', 'Class', 'readonly', { value: s.class + ' · ' + s.roll }),
          F('response', f.prompt || 'Your response', 'textarea', { full: true }),
        ],
        'Submit form',
      ),
  );
}
FORMS.formsub = v => {
  const f = S.db.forms.find(x => x.id == v.formId),
    s = me();
  if (!f) return 'This form was removed';
  if (S.db.formSubs.some(x => x.formId === f.id && x.studentId === s.id && x.response === v.response))
    return 'You already submitted this exact response';
  S.db.formSubs.push({
    id: nextId(S.db.formSubs),
    formId: f.id,
    title: f.title,
    studentId: s.id,
    response: v.response,
    at: stamp(),
  });
  notify('role:Admin', 'New “' + f.title + '” submission from ' + s.name, {
    icon: '▤',
    link: ['Attendance', 'Forms'],
  });
  commit('Form submitted');
};
FORMS.newform = v => {
  if (S.db.forms.some(f => f.title.toLowerCase() === v.title.toLowerCase()))
    return { field: 'title', msg: 'A form with this title already exists' };
  S.db.forms.push({ id: nextId(S.db.forms), ...v });
  commit('Form published to students', false);
};
export function removeForm(id) {
  confirmBox(
    'Remove this form?',
    'Students will no longer see it. Existing submissions are kept.',
    'Remove',
    () => {
      S.db.forms = S.db.forms.filter(f => f.id !== id);
      commit('Form removed');
    },
    true,
  );
}
