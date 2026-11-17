import { FORMS, PAGES } from '../app/registry.js';
import { go } from '../app/router.js';
import { leaders, notify, resolveRef } from '../lib/notifications.js';
import { actorName, canDecide, isAA, me } from '../lib/permissions.js';
import { save } from '../lib/store.js';
import {
  $,
  addDays,
  avatar,
  daysBetween,
  esc,
  fmtRange,
  nextId,
  plural,
  rel,
  sClass,
  sName,
  stamp,
  today,
} from '../lib/utils.js';
import { setAtt } from './shared.js';
import { S } from '../state.js';
import { btn, call, calm, card, heading, itemRow, stepper, table, tabs, tag } from '../ui/components.js';
import { mhead, modal, toast } from '../ui/feedback.js';
import { F, commit, formHTML } from '../ui/forms.js';
/* ==========================================================================
   LEAVE — apply → decision (Principal/VP) → clearance (Academic Assistant)
   ========================================================================== */
export function leaveSteps(l) {
  const clr =
    ['Awaiting Clearance', 'Cleared'].includes(l.status) ||
    (l.status === 'Pending' && S.db.settings.clearanceRequired);
  const s = [
    { label: 'Submitted', icon: '📝', state: 'done' },
    {
      label: l.status === 'Rejected' ? 'Rejected' : 'Review',
      icon: '🖋️',
      state: l.status === 'Pending' ? 'cur' : l.status === 'Rejected' ? 'bad' : 'done',
    },
  ];
  if (l.status === 'Rejected') return s;
  if (clr)
    s.push({
      label: 'Clearance',
      icon: '🗂️',
      state: l.status === 'Cleared' ? 'done' : l.status === 'Awaiting Clearance' ? 'cur' : '',
    });
  s.push({ label: 'Done', icon: '🏁', state: ['Cleared', 'Approved'].includes(l.status) ? 'done' : '' });
  return s;
}
PAGES['Leave Application'] = () => {
  const s = me();
  if (S.section === 'Apply')
    return (
      heading('Leave application', 'Apply in under a minute and follow every step.') +
      tabs() +
      `<div class="row2">${card('New application', formHTML('leave', [F('type', 'Leave type', 'select', { options: ['Personal', 'Medical', 'Official', 'Other'] }), F('n', 'Student', 'readonly', { value: s.name + ' · ' + s.class }), F('from', 'From', 'date', { value: today() }), F('to', 'To', 'date', { value: today() }), F('reason', 'Reason', 'textarea', { full: true, ph: 'A short, clear reason' })], 'Submit application'))}${card('How it works', `${stepper([{ label: 'You apply', icon: '📝', state: 'done' }, { label: 'Review', icon: '🖋️', state: '' }, ...(S.db.settings.clearanceRequired ? [{ label: 'Clearance', icon: '🗂️', state: '' }] : []), { label: 'Done', icon: '🏁', state: '' }])}<p class="muted">Your application is reviewed by the ${esc(S.db.settings.leaveAuthority.replace(' only', ''))}${S.db.settings.clearanceRequired ? ', then cleared by the Academic Assistant' : ''}. You’ll get a notification at every step.</p><p class="tinyhint">Applying does not change your attendance record — staff record attendance separately.</p>`)}</div>`
    );
  const mine = S.db.leaves.filter(l => l.studentId === s.id).sort((a, b) => b.id - a.id);
  return (
    heading('Leave application', 'Track every application you’ve made.') +
    tabs() +
    (mine.length
      ? `<div class="stack">${mine.map(l => `<div class="card" role="button" tabindex="0" style="cursor:pointer" onclick="${call('leaveDetail', l.id)}" onkeydown="if(event.key==='Enter')this.click()"><div class="play-panel-head"><div><b style="font-size:16px">${fmtRange(l.from, l.to)} · ${esc(l.type)}</b><div class="muted" style="font-size:13px">${esc(l.reason)}</div></div>${tag(l.status)}</div>${stepper(leaveSteps(l))}${l.decisionNote ? `<p class="tinyhint">🖋️ ${esc(l.decidedBy)}: ${esc(l.decisionNote)}</p>` : ''}</div>`).join('')}</div>`
      : calm(
          '🌙',
          'No leave applications yet',
          'When you apply, you can follow its progress here.',
          btn('Apply for leave', "go('Leave Application','Apply')", 'primary'),
        ))
  );
};
FORMS.leave = v => {
  const s = me();
  if (v.to < v.from) return { field: 'to', msg: 'End date can’t be before start date' };
  if (v.from < addDays(today(), -7))
    return { field: 'from', msg: 'Start date can’t be more than 7 days in the past' };
  const clash = S.db.leaves.find(
    l => l.studentId === s.id && !['Rejected'].includes(l.status) && l.from <= v.to && l.to >= v.from,
  );
  if (clash)
    return (
      'You already have a ' +
      clash.status.toLowerCase() +
      ' application for ' +
      fmtRange(clash.from, clash.to)
    );
  const id = nextId(S.db.leaves);
  S.db.leaves.push({
    id,
    studentId: s.id,
    type: v.type,
    from: v.from,
    to: v.to,
    reason: v.reason,
    status: 'Pending',
    createdAt: stamp(),
    history: [{ status: 'Submitted', by: s.name, at: stamp(), note: '' }],
  });
  notify(leaders('leaveAuthority'), 'Leave request from ' + s.name + ' is awaiting review', {
    icon: '📨',
    ref: 'leave:' + id,
    action: true,
    link: ['Leave Decisions', 'Pending', 'leave:' + id],
  });
  save();
  go('Leave Application', 'My Applications');
  toast('Application submitted — we’ll notify you of every update');
};
export function leaveDetail(id) {
  const l = S.db.leaves.find(x => x.id === id);
  if (!l) return toast('This application no longer exists', 'err');
  const canD = canDecide('leaveAuthority') && l.status === 'Pending',
    canC = isAA() && l.status === 'Awaiting Clearance';
  modal(
    mhead('Leave · ' + sName(l.studentId), esc(sClass(l.studentId)) + ' · ' + tag(l.status)) +
      stepper(leaveSteps(l)) +
      `<dl class="kv"><dt>Type</dt><dd>${esc(l.type)}</dd><dt>Dates</dt><dd>${fmtRange(l.from, l.to)} (${plural(daysBetween(l.from, l.to), 'day')})</dd><dt>Reason</dt><dd>${esc(l.reason)}</dd>${l.decisionNote ? `<dt>Decision note</dt><dd>${esc(l.decisionNote)}</dd>` : ''}${l.clearNote ? `<dt>Clearance note</dt><dd>${esc(l.clearNote)}</dd>` : ''}</dl>` +
      `<div class="log">${(l.history || []).map(h => `<div><b>${esc(h.status)}</b> · ${esc(h.by)} · <span class="muted">${esc(rel(h.at))}</span>${h.note ? `<br><span class="muted">${esc(h.note)}</span>` : ''}</div>`).join('')}</div>` +
      (canD
        ? `<label style="font-weight:700;display:block;margin-top:16px">Note to student <span class="muted">(optional for approval, required to reject)</span><textarea class="field" id="dnote" style="width:100%;margin-top:6px"></textarea></label><div class="formactions">${btn('Approve', call('decideLeave', id, 'Approved'), 'primary')}${btn('Reject', call('decideLeave', id, 'Rejected'), 'danger')}</div>`
        : '') +
      (canC
        ? `<div style="margin-top:16px"><label style="display:flex;gap:9px;align-items:center;font-weight:700"><input type="checkbox" id="crec"> Also record ${fmtRange(l.from, l.to)} as “On Leave” in attendance</label><label style="font-weight:700;display:block;margin-top:10px">Clearance note <span class="muted">(optional)</span><textarea class="field" id="cnote" style="width:100%;margin-top:6px"></textarea></label><div class="formactions">${btn('Record clearance', call('clearLeave', id), 'primary')}</div></div>`
        : '') +
      (l.status === 'Pending' && (S.role === 'Principal' || S.role === 'Vice Principal') && !canD
        ? `<div class="softinfo">Leave decisions are currently configured for: ${esc(S.db.settings.leaveAuthority)}.</div>`
        : ''),
    'wide',
  );
}
export function decideLeave(id, st) {
  const l = S.db.leaves.find(x => x.id === id),
    note = ($('dnote')?.value || '').trim();
  if (!l || l.status !== 'Pending' || !canDecide('leaveAuthority')) return;
  if (st === 'Rejected' && !note) {
    $('dnote').classList.add('invalid');
    return toast('Please add a short reason for the student', 'err');
  }
  const clr = st === 'Approved' && S.db.settings.clearanceRequired;
  Object.assign(l, {
    status: st === 'Approved' ? (clr ? 'Awaiting Clearance' : 'Approved') : 'Rejected',
    decidedBy: S.role,
    decidedAt: stamp(),
    decisionNote: note,
  });
  l.history.push({ status: st, by: S.role, at: stamp(), note });
  resolveRef('leave:' + id);
  notify(
    'student:' + l.studentId,
    st === 'Approved'
      ? 'Your leave for ' + fmtRange(l.from, l.to) + ' was approved 🎉'
      : 'Your leave for ' + fmtRange(l.from, l.to) + ' was not approved',
    {
      icon: st === 'Approved' ? '🎉' : '📨',
      kind: st === 'Approved' ? 'celebrate' : '',
      link: ['Leave Application', 'My Applications', 'leave:' + id],
    },
  );
  if (clr)
    notify('position:Academic Assistant', sName(l.studentId) + '’s approved leave needs clearance', {
      icon: '🗂️',
      ref: 'clear:' + id,
      action: true,
      link: ['Leave Clearance', 'Awaiting Clearance', 'leave:' + id],
    });
  commit(
    st === 'Approved'
      ? 'Approved' + (clr ? ' — sent to Academic Assistant for clearance' : '')
      : 'Application rejected',
  );
}
export function clearLeave(id) {
  const l = S.db.leaves.find(x => x.id === id);
  if (!l || l.status !== 'Awaiting Clearance' || !isAA()) return;
  const note = ($('cnote')?.value || '').trim(),
    rec = $('crec')?.checked;
  Object.assign(l, { status: 'Cleared', clearedBy: actorName(), clearedAt: stamp(), clearNote: note });
  l.history.push({ status: 'Cleared', by: actorName(), at: stamp(), note });
  resolveRef('clear:' + id);
  if (rec) {
    let d = l.from,
      n = 0;
    while (d <= l.to && n < 60) {
      setAtt(l.studentId, d, 'On Leave', { note: 'Leave cleared' });
      d = addDays(d, 1);
      n++;
    }
  }
  notify('student:' + l.studentId, 'Your leave for ' + fmtRange(l.from, l.to) + ' is fully cleared ✓', {
    icon: '🗂️',
    link: ['Leave Application', 'My Applications', 'leave:' + id],
  });
  commit('Clearance recorded' + (rec ? ' and attendance updated' : ''));
}
PAGES['Leave Decisions'] = () => {
  const can = canDecide('leaveAuthority');
  if (S.section === 'Pending') {
    const list = S.db.leaves.filter(l => l.status === 'Pending').sort((a, b) => a.from.localeCompare(b.from));
    return (
      heading('Leave decisions', 'Review each application and decide in one tap.') +
      tabs() +
      (!can
        ? `<div class="banner">ℹ️ Leave decisions are configured for: ${esc(S.db.settings.leaveAuthority)}. You can view but not decide.</div>`
        : '') +
      (list.length
        ? card(
            '',
            list
              .map(l =>
                itemRow({
                  icon: avatar(sName(l.studentId), l.studentId),
                  title:
                    esc(sName(l.studentId)) +
                    ` <span class="muted" style="font-weight:650">· ${esc(sClass(l.studentId))}</span>`,
                  meta: `${fmtRange(l.from, l.to)} · ${plural(daysBetween(l.from, l.to), 'day')} · ${esc(l.type)} · ${esc(l.reason)}`,
                  onclick: call('leaveDetail', l.id),
                  right: can ? btn('Review', call('leaveDetail', l.id), 'sm primary') : tag('Pending'),
                }),
              )
              .join(''),
          )
        : calm('🌿', 'No pending applications', 'New ones appear here and on your home screen.'))
    );
  }
  const list = S.db.leaves
    .filter(l => l.status !== 'Pending')
    .sort((a, b) => (b.decidedAt || '').localeCompare(a.decidedAt || ''));
  return (
    heading('Leave decisions', 'Every decision, newest first.') +
    tabs() +
    card(
      '',
      table(
        ['Student', 'Dates', 'Decision by', 'Status', ''],
        list.map(l => [
          esc(sName(l.studentId)),
          fmtRange(l.from, l.to),
          esc(l.decidedBy || '—') + ' <span class="muted">' + esc(rel(l.decidedAt)) + '</span>',
          tag(l.status),
          btn('Open', call('leaveDetail', l.id), 'sm'),
        ]),
        'No decisions yet',
      ),
    )
  );
};
PAGES['Leave Clearance'] = () => {
  const aw = S.section === 'Awaiting Clearance',
    list = S.db.leaves
      .filter(l => (aw ? l.status === 'Awaiting Clearance' : l.status === 'Cleared'))
      .sort((a, b) =>
        aw ? a.from.localeCompare(b.from) : (b.clearedAt || '').localeCompare(a.clearedAt || ''),
      );
  return (
    heading('Leave clearance', 'Approved applications move here for clearance.') +
    tabs() +
    (list.length
      ? card(
          '',
          list
            .map(l =>
              itemRow({
                icon: avatar(sName(l.studentId), l.studentId),
                title:
                  esc(sName(l.studentId)) +
                  ` <span class="muted" style="font-weight:650">· ${esc(sClass(l.studentId))}</span>`,
                meta: `${fmtRange(l.from, l.to)} · approved by ${esc(l.decidedBy)}${l.clearedBy ? ' · cleared by ' + esc(l.clearedBy) + ' ' + esc(rel(l.clearedAt)) : ''}`,
                onclick: call('leaveDetail', l.id),
                right: aw ? btn('Clear', call('leaveDetail', l.id), 'sm primary') : tag('Cleared'),
              }),
            )
            .join(''),
        )
      : calm('🌿', aw ? 'Nothing awaiting clearance' : 'No cleared applications yet'))
  );
};
