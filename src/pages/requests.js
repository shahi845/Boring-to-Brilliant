import { FORMS, PAGES } from '../app/registry.js';
import { go, render } from '../app/router.js';
import { REQUEST_TYPES, REQ_ICON } from '../lib/constants.js';
import { handlerKey, handlerLink, notify, resolveRef } from '../lib/notifications.js';
import { actorName, canHandleRequest, me } from '../lib/permissions.js';
import { save } from '../lib/store.js';
import { $, esc, nextId, rel, sClass, sName, stamp, today } from '../lib/utils.js';
import { S } from '../state.js';
import { btn, call, calm, card, heading, itemRow, stepper, tabs, tag } from '../ui/components.js';
import { mhead, modal, toast } from '../ui/feedback.js';
import { F, commit, formHTML } from '../ui/forms.js';
import { Choice, wizardHTML } from '../ui/wizard.js';
/* ==========================================================================
   OFFICIAL REQUESTS — routed by type (Admin office / Academic Assistant / Librarian)
   ========================================================================== */
export let reqType = '';
export function startRequest(t) {
  reqType = t;
  go('Official Requests', 'New Request');
}
export function reqSteps(r) {
  return [
    { label: 'Submitted', icon: '📝', state: 'done' },
    {
      label: 'In progress',
      icon: '⚙️',
      state: r.status === 'Submitted' ? '' : r.status === 'In Progress' ? 'cur' : 'done',
    },
    {
      label: r.status === 'Rejected' ? 'Rejected' : 'Completed',
      icon: '🏁',
      state: r.status === 'Completed' ? 'done' : r.status === 'Rejected' ? 'bad' : '',
    },
  ];
}
export const REQ_HINT = {
  'Bonafide Certificate': 'Purpose, e.g. scholarship or bank account',
  'Study Certificate': 'Purpose, e.g. passport application',
  'Permission Letter': 'What you need permission for, and the date',
  'Attendance Correction': 'Which date, and what should it be?',
  'Library Clearance': 'Why you need library clearance',
  Other: 'Tell us what you need',
};
PAGES['Official Requests'] = () => {
  if (S.role === 'Student') {
    const s = me();
    if (S.section === 'New Request') {
      const pick = REQUEST_TYPES.includes(reqType) ? reqType : '';
      return (
        heading(
          'Official requests',
          'Certificates, letters and corrections — tracked from start to finish.',
        ) +
        tabs() +
        card(
          '',
          wizardHTML(
            'request',
            [
              {
                icon: '📄',
                title: 'What do you need?',
                hint: 'Tap one to continue.',
                fields: [
                  Choice(
                    'type',
                    'Request type',
                    REQUEST_TYPES.map(t => ({
                      value: t,
                      label: t,
                      icon: REQ_ICON[t],
                      hint: 'Handled by ' + S.db.settings.routing[t],
                      ph: REQ_HINT[t],
                    })),
                    pick,
                  ),
                ],
              },
              {
                icon: '💬',
                title: 'A few details',
                hint: 'Tell the office exactly what you need it for.',
                fields: [
                  F('n', 'Name', 'readonly', { value: s.name }),
                  F('c', 'Class & roll no.', 'readonly', { value: s.class + ' · ' + s.roll }),
                  F('details', 'Details', 'textarea', {
                    full: true,
                    ph: REQ_HINT[pick] || 'Tell us what you need',
                    phFrom: 'type',
                  }),
                ],
              },
            ],
            'Submit request',
            { start: pick ? 1 : 0 },
          ),
        )
      );
    }
    const mine = S.db.requests.filter(r => r.studentId === s.id).sort((a, b) => b.id - a.id);
    return (
      heading('Official requests', 'Follow each request until it’s done.') +
      tabs() +
      (mine.length
        ? `<div class="stack">${mine.map(r => `<div class="card" role="button" tabindex="0" style="cursor:pointer" onclick="${call('requestDetail', r.id)}" onkeydown="if(event.key==='Enter')this.click()"><div class="play-panel-head"><div><b style="font-size:16px">${REQ_ICON[r.type] || '📝'} ${esc(r.type)}</b><div class="muted" style="font-size:13px">${esc(r.details)}</div></div>${tag(r.status)}</div>${stepper(reqSteps(r))}${r.note ? `<p class="tinyhint">💬 ${esc(r.note)}</p>` : ''}</div>`).join('')}</div>`
        : calm(
            '📄',
            'No requests yet',
            '',
            btn('Make a request', "go('Official Requests','New Request')", 'primary'),
          ))
    );
  }
  const done = S.section === 'Completed';
  return (
    heading(
      'Official requests',
      'Requests routed to the Admin office. Others go to the Academic Assistant or Librarian as configured.',
    ) +
    tabs() +
    requestQueue(r => (S.db.settings.routing[r.type] || 'Admin office') === 'Admin office', done)
  );
};
export function pickReq(t) {
  reqType = t;
  render();
  if (t)
    setTimeout(
      () => document.querySelector('#content form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      60,
    );
}
FORMS.request = v => {
  const s = me();
  if (
    S.db.requests.some(
      r => r.studentId === s.id && r.type === v.type && ['Submitted', 'In Progress'].includes(r.status),
    )
  )
    return 'You already have an open ' + v.type + ' request — track it under Tracking';
  const id = nextId(S.db.requests);
  S.db.requests.push({
    id,
    studentId: s.id,
    type: v.type,
    details: v.details,
    status: 'Submitted',
    createdAt: stamp(),
    history: [{ status: 'Submitted', by: s.name, at: stamp(), note: '' }],
  });
  notify(handlerKey(v.type), v.type + ' request from ' + s.name, {
    icon: REQ_ICON[v.type] || '📄',
    ref: 'req:' + id,
    action: true,
    link: handlerLink(v.type, 'req:' + id),
  });
  reqType = '';
  save();
  go('Official Requests', 'Tracking');
  toast('Request submitted to ' + S.db.settings.routing[v.type]);
};
export function requestQueue(filter, done = false) {
  const list = S.db.requests
    .filter(
      r =>
        filter(r) &&
        (done
          ? ['Completed', 'Rejected'].includes(r.status)
          : ['Submitted', 'In Progress'].includes(r.status)),
    )
    .sort((a, b) => (done ? b.id - a.id : a.id - b.id));
  return list.length
    ? card(
        '',
        list
          .map(r =>
            itemRow({
              icon: `<span class="taskicon t-blue" style="width:40px;height:40px;font-size:19px">${REQ_ICON[r.type] || '📝'}</span>`,
              title: esc(r.type) + ' · ' + esc(sName(r.studentId)),
              meta: esc(r.details) + ' · ' + esc(rel(r.createdAt)),
              onclick: call('requestDetail', r.id),
              right: done
                ? tag(r.status)
                : tag(r.status) + ' ' + btn('Open', call('requestDetail', r.id), 'sm primary'),
            }),
          )
          .join(''),
      )
    : calm(
        '🌿',
        done ? 'Nothing completed yet' : 'Queue is clear',
        'New requests appear here automatically.',
      );
}
export function requestDetail(id) {
  const r = S.db.requests.find(x => x.id === id);
  if (!r) return toast('This request no longer exists', 'err');
  const can = canHandleRequest(r) && ['Submitted', 'In Progress'].includes(r.status);
  modal(
    mhead(
      (REQ_ICON[r.type] || '') + ' ' + r.type,
      esc(sName(r.studentId)) +
        ' · ' +
        esc(sClass(r.studentId)) +
        ' · handled by ' +
        esc(S.db.settings.routing[r.type]),
    ) +
      stepper(reqSteps(r)) +
      `<dl class="kv"><dt>Details</dt><dd>${esc(r.details)}</dd><dt>Status</dt><dd>${tag(r.status)}</dd>${r.note ? `<dt>Note</dt><dd>${esc(r.note)}</dd>` : ''}</dl><div class="log">${(r.history || []).map(h => `<div><b>${esc(h.status)}</b> · ${esc(h.by)} · <span class="muted">${esc(rel(h.at))}</span>${h.note ? `<br><span class="muted">${esc(h.note)}</span>` : ''}</div>`).join('')}</div>` +
      (can
        ? `<label style="font-weight:700;display:block;margin-top:16px">Note to student <span class="muted">(required to complete or reject)</span><textarea class="field" id="rnote" style="width:100%;margin-top:6px" placeholder="${r.type === 'Library Clearance' ? 'e.g. No dues — cleared' : r.type === 'Book Issue' ? 'e.g. Issued — return within 14 days' : 'e.g. Ready for collection at the office'}"></textarea></label><div class="formactions">${r.status === 'Submitted' ? btn('Start processing', call('setRequest', id, 'In Progress'), 'blue') : ''}${btn(r.type === 'Library Clearance' ? 'Mark cleared' : r.type === 'Book Issue' ? 'Mark issued' : 'Mark completed', call('setRequest', id, 'Completed'), 'primary')}${btn(r.type === 'Library Clearance' ? 'Put on hold' : r.type === 'Book Issue' ? 'Not available' : 'Reject', call('setRequest', id, 'Rejected'), 'danger')}</div>`
        : ''),
    'wide',
  );
}
export function setRequest(id, st) {
  const r = S.db.requests.find(x => x.id === id);
  if (!r || !canHandleRequest(r)) return;
  const note = ($('rnote')?.value || '').trim();
  if (st !== 'In Progress' && !note) {
    $('rnote').classList.add('invalid');
    return toast('Add a short note for the student', 'err');
  }
  r.status = st;
  if (note) r.note = note;
  r.history.push({ status: st, by: actorName(), at: stamp(), note });
  if (st !== 'In Progress') resolveRef('req:' + id);
  if (r.type === 'Library Clearance' && st !== 'In Progress')
    S.db.libStatus[r.studentId] = {
      status: st === 'Completed' ? 'Cleared' : 'On Hold',
      note,
      by: actorName(),
      at: today(),
    };
  notify(
    'student:' + r.studentId,
    `Your ${r.type} request is ${st === 'In Progress' ? 'being processed' : st === 'Completed' ? 'completed ✓' : 'not approved — see the note'}`,
    { icon: REQ_ICON[r.type] || '📄', link: ['Official Requests', 'Tracking', 'req:' + id] },
  );
  commit('Request ' + (st === 'In Progress' ? 'marked in progress' : st.toLowerCase()), st !== 'In Progress');
  if (st === 'In Progress') requestDetail(id);
}
