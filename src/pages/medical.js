import { FORMS } from '../app/registry.js';
import { notify, resolveRef } from '../lib/notifications.js';
import { actorName, isAA, me } from '../lib/permissions.js';
import { $, avatar, esc, fmtRange, nextId, rel, sClass, sName, stamp, today } from '../lib/utils.js';
import { S } from '../state.js';
import { btn, call, calm, card, itemRow, tag } from '../ui/components.js';
import { mhead, modal, toast } from '../ui/feedback.js';
import { F, commit, formHTML } from '../ui/forms.js';
import { Chips, wizardHTML } from '../ui/wizard.js';
import { addDays } from '../lib/utils.js';
/* ---------- medical (inside Attendance) ---------- */
function medicalWizard() {
  const t = today();
  return wizardHTML(
    'medical',
    [
      {
        icon: '📅',
        title: 'When were you unwell?',
        hint: 'Pick a quick option or choose the dates.',
        fields: [
          Chips([
            { label: 'Today', set: { from: t, to: t } },
            { label: 'Yesterday', set: { from: addDays(t, -1), to: addDays(t, -1) } },
            { label: 'Last 2 days', set: { from: addDays(t, -1), to: t } },
            { label: 'Last 3 days', set: { from: addDays(t, -2), to: t } },
          ]),
          F('from', 'From', 'date', { value: t }),
          F('to', 'To', 'date', { value: t, after: 'from' }),
        ],
      },
      {
        icon: '🩺',
        title: 'A short, general reason',
        hint: 'Keep it general — please don’t share detailed health information.',
        fields: [
          Chips([
            { label: 'Fever', set: { note: 'Fever, rested at home' } },
            { label: 'Cold / cough', set: { note: 'Cold and cough, rested at home' } },
            { label: 'Doctor visit', set: { note: 'Unwell, visited the doctor' } },
            { label: 'Stomach upset', set: { note: 'Stomach upset, rested at home' } },
          ]),
          F('note', 'Reason', 'text', { full: true, ph: 'e.g. Unwell, rested at home' }),
        ],
      },
    ],
    'Submit request',
  );
}
export function medicalPage() {
  if (S.role === 'Student') {
    const s = me(),
      mine = S.db.medical.filter(m => m.studentId === s.id).sort((a, b) => b.id - a.id);
    return `<div class="row2">${card('New medical request', `<p class="muted" style="margin-top:0">For days you were unwell. The Academic Assistant verifies it. Please don’t share detailed health information here.</p>` + medicalWizard())}${card('My medical requests', mine.length ? mine.map(m => itemRow({ title: fmtRange(m.from, m.to), meta: esc(m.note) + (m.reviewNote ? ' · ' + esc(m.reviewNote) : ''), right: tag(m.status), onclick: call('medicalDetail', m.id) })).join('') : calm('✚', 'No medical requests'))}</div>`;
  }
  const list = S.db.medical.slice().sort((a, b) => b.id - a.id);
  return card(
    'Medical requests',
    `<p class="muted" style="margin-top:0">Verified by the Academic Assistant. Shown here for reference.</p>` +
      (list.length
        ? list
            .map(m =>
              itemRow({
                icon: avatar(sName(m.studentId), m.studentId),
                title: esc(sName(m.studentId)),
                meta: fmtRange(m.from, m.to) + ' · ' + esc(m.note),
                right: tag(m.status),
                onclick: call('medicalDetail', m.id),
              }),
            )
            .join('')
        : calm('✚', 'No medical requests')),
  );
}
FORMS.medical = v => {
  if (v.to < v.from) return { field: 'to', msg: 'End date can’t be before start date' };
  const s = me();
  if (S.db.medical.some(m => m.studentId === s.id && m.status === 'Pending' && m.from === v.from))
    return 'You already have a pending request for this date';
  const id = nextId(S.db.medical);
  S.db.medical.push({
    id,
    studentId: s.id,
    from: v.from,
    to: v.to,
    note: v.note,
    status: 'Pending',
    createdAt: stamp(),
  });
  notify('position:Academic Assistant', 'Medical request from ' + s.name + ' needs verification', {
    icon: '✚',
    ref: 'med:' + id,
    action: true,
    link: ['Verification', 'Medical Requests', 'med:' + id],
  });
  commit('Medical request sent for verification');
};
export function medicalDetail(id) {
  const m = S.db.medical.find(x => x.id === id);
  if (!m) return toast('This request no longer exists', 'err');
  modal(
    mhead('Medical request', esc(sName(m.studentId)) + ' · ' + esc(sClass(m.studentId))) +
      `<dl class="kv"><dt>Dates</dt><dd>${fmtRange(m.from, m.to)}</dd><dt>Reason</dt><dd>${esc(m.note)}</dd><dt>Status</dt><dd>${tag(m.status)}</dd>${m.reviewedBy ? `<dt>Reviewed by</dt><dd>${esc(m.reviewedBy)} · ${esc(rel(m.reviewedAt))}</dd>` : ''}${m.reviewNote ? `<dt>Note</dt><dd>${esc(m.reviewNote)}</dd>` : ''}</dl>` +
      (isAA() && m.status === 'Pending'
        ? `<label style="font-weight:700">Note to student (required when returning)<textarea class="field" id="mnote" style="width:100%;margin-top:6px"></textarea></label><div class="formactions">${btn('Verify', call('reviewMedical', id, 'Verified'), 'primary')}${btn('Return to student', call('reviewMedical', id, 'Returned'), 'danger')}</div>`
        : ''),
  );
}
export function reviewMedical(id, st) {
  const m = S.db.medical.find(x => x.id === id),
    note = ($('mnote')?.value || '').trim();
  if (!m || m.status !== 'Pending') return;
  if (st === 'Returned' && !note) {
    $('mnote').classList.add('invalid');
    return toast('Add a short note so the student knows what to fix', 'err');
  }
  Object.assign(m, { status: st, reviewedBy: actorName(), reviewedAt: stamp(), reviewNote: note });
  resolveRef('med:' + id);
  notify(
    'student:' + m.studentId,
    'Your medical request for ' +
      fmtRange(m.from, m.to) +
      (st === 'Verified' ? ' was verified ✓' : ' was returned — please check the note'),
    { icon: '✚', link: ['Attendance', 'Medical', 'med:' + id] },
  );
  commit('Medical request ' + st.toLowerCase());
}
