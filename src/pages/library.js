import { FORMS, PAGES } from '../app/registry.js';
import { actorName } from '../lib/permissions.js';
import { avatar, esc, fmtDate, sName, today } from '../lib/utils.js';
import { requestQueue } from './requests.js';
import { S } from '../state.js';
import { btn, call, card, heading, itemRow, tabs, tag } from '../ui/components.js';
import { mhead, modal } from '../ui/feedback.js';
import { F, commit, formHTML } from '../ui/forms.js';
/* ==========================================================================
   LIBRARY (staff holding the Librarian position)
   ========================================================================== */
PAGES.Library = () => {
  const h = heading('Library', 'Your Librarian responsibilities.') + tabs();
  if (S.section === 'Clearance Requests')
    return (
      h +
      requestQueue(r => S.db.settings.routing[r.type] === 'Librarian') +
      `<h2 class="play-heading">Completed</h2>` +
      requestQueue(r => S.db.settings.routing[r.type] === 'Librarian', true)
    );
  return (
    h +
    card(
      'Student library status',
      `<div class="toolbar"><input class="field" placeholder="Search students…" oninput="filterItems(this,'#libl')"></div><div id="libl">${S.db.students
        .map(s => {
          const l = S.db.libStatus[s.id];
          return itemRow({
            icon: avatar(s.name, s.id),
            title: esc(s.name) + ` <span class="muted" style="font-weight:650">· ${esc(s.class)}</span>`,
            meta: l
              ? esc([l.note, 'updated ' + fmtDate(l.at) + ' by ' + l.by].filter(Boolean).join(' · '))
              : '',
            right: tag(l?.status || 'Not checked') + ' ' + btn('Update', call('libModal', s.id), 'sm'),
          });
        })
        .join('')}</div>`,
    )
  );
};
export function libModal(sid) {
  const l = S.db.libStatus[sid] || {};
  modal(
    mhead('Library status', esc(sName(sid))) +
      formHTML(
        'lib',
        [
          `<input type="hidden" name="sid" value="${sid}">`,
          F('status', 'Status', 'select', {
            options: ['Cleared', 'On Hold', 'Not checked'],
            value: l.status || 'Not checked',
          }),
          F('note', 'Note', 'text', {
            value: l.note || '',
            required: false,
            ph: 'e.g. 1 book overdue',
            full: true,
          }),
        ],
        'Save',
      ),
  );
}
FORMS.lib = v => {
  if (v.status === 'On Hold' && !v.note) return { field: 'note', msg: 'Add a note so the student knows why' };
  S.db.libStatus[+v.sid] = { status: v.status, note: v.note, by: actorName(), at: today() };
  commit('Library status updated');
};
export function filterItems(inp, sel) {
  const q = inp.value.toLowerCase();
  document
    .querySelectorAll(sel + ' .item')
    .forEach(r => (r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none'));
}
