import { FORMS, PAGES } from '../app/registry.js';
import { go, render } from '../app/router.js';
import { leaders, notify, resolveRef } from '../lib/notifications.js';
import { canDecide, me } from '../lib/permissions.js';
import {
  $,
  addDays,
  esc,
  fmtDate,
  money,
  nextId,
  plural,
  rel,
  sClass,
  sName,
  stamp,
  today,
} from '../lib/utils.js';
import { classStudents, feeStatus } from './shared.js';
import { download } from './system.js';
import { S } from '../state.js';
import { btn, call, calm, card, heading, itemRow, table, tabs, tag } from '../ui/components.js';
import { mhead, modal, toast } from '../ui/feedback.js';
import { F, commit, formHTML } from '../ui/forms.js';
/* ==========================================================================
   FEES — students see status; Principal/VP authorize adjustments
   ========================================================================== */
export let feeFilter = 'All';
export function feeFilterGo(f) {
  feeFilter = f;
  go('Fees', 'Records');
}
PAGES.Fees = () => {
  if (S.role === 'Student') {
    const s = me(),
      mine = S.db.fees.filter(f => f.studentId === s.id);
    if (S.section === 'Status') {
      const open = mine.filter(f => f.status !== 'Paid'),
        due = open.reduce((a, f) => a + +f.amount, 0);
      return (
        heading('Fees', 'Your fee status at a glance.') +
        tabs() +
        `<div class="play-hero" style="margin-bottom:16px"><div class="hero-copy"><div class="hero-eyebrow">💳 OUTSTANDING</div><h2>${money(due)}</h2><p>${open.length ? plural(open.length, 'fee') + ' to pay. Pay at the office; your receipt appears here.' : 'You’re fully paid up. 🎉'}</p></div></div>` +
        (open.length
          ? card(
              'To pay',
              open
                .map(f => {
                  const st = feeStatus(f),
                    task = S.db.feeTasks.find(x => x.feeId === f.id && x.status === 'Pending');
                  return itemRow({
                    icon: `<span class="taskicon t-${st === 'Overdue' ? 'red' : 'orange'}" style="width:40px;height:40px;font-size:19px">💳</span>`,
                    title: esc(f.category) + ' · ' + money(f.amount),
                    meta:
                      (st === 'Overdue' ? 'Was due ' : 'Due ') +
                      fmtDate(f.due) +
                      (f.concession ? ' · concession ' + money(f.concession) + ' applied' : '') +
                      (task ? ' · ' + task.kind.toLowerCase() + ' request under review' : ''),
                    right: tag(st) + (task ? '' : ' ' + btn('Need more time?', call('extModal', f.id), 'sm')),
                  });
                })
                .join(''),
            )
          : '')
      );
    }
    const paid = mine.filter(f => f.status === 'Paid');
    return (
      heading('Fees', 'Your receipts.') +
      tabs() +
      (paid.length
        ? card(
            '',
            paid
              .map(f =>
                itemRow({
                  title: esc(f.category) + ' · ' + money(f.amount),
                  meta: 'Paid ' + fmtDate(f.paidAt) + ' · ' + esc(f.receipt),
                  right: btn('View receipt', call('receiptModal', f.id), 'sm'),
                }),
              )
              .join(''),
          )
        : calm('🧾', 'No receipts yet'))
    );
  }
  if (S.section === 'Records') {
    const rows = S.db.fees
      .filter(f => feeFilter === 'All' || feeStatus(f) === feeFilter)
      .sort((a, b) => (a.due || '').localeCompare(b.due || ''));
    return (
      heading('Fees', 'Record payments and keep fee status up to date.') +
      tabs() +
      `<div class="toolbar">${['All', 'Pending', 'Overdue', 'Paid'].map(x => `<button class="btn sm ${feeFilter === x ? 'primary' : ''}" onclick="${call('setFeeFilter', x)}">${x} (${S.db.fees.filter(f => x === 'All' || feeStatus(f) === x).length})</button>`).join('')}<input class="field" placeholder="Search student…" oninput="filterRows(this.value)"></div>` +
      card(
        '',
        table(
          ['Student', 'Fee', 'Amount', 'Due', 'Status', ''],
          rows.map(f => [
            esc(sName(f.studentId)) + ' <span class="muted">' + esc(sClass(f.studentId)) + '</span>',
            esc(f.category),
            money(f.amount) + (f.concession ? ` <span class="muted">(−${money(f.concession)})</span>` : ''),
            fmtDate(f.due),
            tag(feeStatus(f)),
            f.status === 'Paid'
              ? btn('Receipt', call('receiptModal', f.id), 'sm')
              : btn('Record payment', call('payModal', f.id), 'sm primary'),
          ]),
          'No fees match this filter',
        ),
      )
    );
  }
  if (S.section === 'Assign Fee')
    return (
      heading('Fees', 'Assign a fee to one student or a whole class.') +
      tabs() +
      card(
        'Assign fee',
        formHTML(
          'fee',
          [
            F('target', 'Assign to', 'select', {
              options: [
                ...S.db.classes.map(c => ['class:' + c, 'Whole class · ' + c]),
                ...S.db.students.map(s => ['student:' + s.id, s.name + ' · ' + s.class]),
              ],
              placeholder: 'Choose class or student',
              full: true,
            }),
            F('category', 'Fee name', 'text', { ph: 'e.g. Tuition – Semester 2' }),
            F('amount', 'Amount (₹)', 'number', { min: 1 }),
            F('due', 'Due date', 'date', { value: addDays(today(), 14) }),
          ],
          'Assign fee',
        ),
      )
    );
  const tasks = S.db.feeTasks.slice().sort((a, b) => b.id - a.id),
    open = S.db.fees.filter(f => f.status !== 'Paid');
  return (
    heading(
      'Fees',
      'Concessions and extensions need authorization from the ' +
        S.db.settings.feeAuthority.replace(' only', '') +
        '.',
    ) +
    tabs() +
    `<div class="row2">${card('Propose an adjustment', open.length ? formHTML('feeadj', [F('feeId', 'Fee', 'select', { options: open.map(f => [f.id, sName(f.studentId) + ' · ' + f.category + ' · ' + money(f.amount)]), placeholder: 'Choose a fee', full: true }), F('kind', 'Type', 'select', { options: ['Concession', 'Extension'] }), F('amount', 'Concession amount (₹)', 'number', { min: 1, required: false, hint: 'For concessions' }), F('newDue', 'New due date', 'date', { required: false, hint: 'For extensions' }), F('detail', 'Reason', 'text', { full: true })], 'Send for authorization') : '<p class="muted">No unpaid fees.</p>')}${card('Adjustments', tasks.length ? tasks.map(t => itemRow({ title: esc(t.kind) + ' · ' + esc(sName(t.studentId)), meta: (t.kind === 'Concession' ? money(t.amount) : 'to ' + fmtDate(t.newDue)) + ' · ' + esc(t.requestedBy), right: tag(t.status), onclick: call('feeTaskDetail', t.id) })).join('') : '<p class="muted">None yet.</p>')}</div>`
  );
};
export function setFeeFilter(x) {
  feeFilter = x;
  render();
}
export function filterRows(q) {
  document
    .querySelectorAll('.table tbody tr')
    .forEach(r => (r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none'));
}
FORMS.fee = v => {
  const amt = +v.amount;
  const ids = v.target.startsWith('class:')
    ? classStudents(v.target.slice(6)).map(s => s.id)
    : [+v.target.split(':')[1]];
  if (!ids.length) return { field: 'target', msg: 'No students in that class' };
  const dup = ids.filter(id =>
    S.db.fees.some(f => f.studentId === id && f.category.toLowerCase() === v.category.toLowerCase()),
  );
  if (dup.length === ids.length) return { field: 'category', msg: 'This fee is already assigned' };
  ids
    .filter(id => !dup.includes(id))
    .forEach(id => {
      S.db.fees.push({
        id: nextId(S.db.fees),
        studentId: id,
        category: v.category,
        amount: amt,
        due: v.due,
        status: 'Pending',
      });
      notify('student:' + id, 'New fee: ' + v.category + ' · ' + money(amt) + ' due ' + fmtDate(v.due), {
        icon: '💳',
        link: ['Fees', 'Status'],
      });
    });
  commit(
    'Fee assigned to ' +
      plural(ids.length - dup.length, 'student') +
      (dup.length ? ' (' + dup.length + ' already had it)' : ''),
    false,
  );
};
FORMS.feeadj = v => {
  const f = S.db.fees.find(x => x.id === +v.feeId);
  if (!f) return 'Fee not found';
  if (v.kind === 'Concession' && !(+v.amount > 0 && +v.amount <= +f.amount))
    return { field: 'amount', msg: 'Enter an amount up to ' + money(f.amount) };
  if (v.kind === 'Extension' && !(v.newDue > f.due))
    return { field: 'newDue', msg: 'Pick a date after the current due date (' + fmtDate(f.due) + ')' };
  if (S.db.feeTasks.some(t => t.feeId === f.id && t.status === 'Pending'))
    return 'This fee already has an adjustment waiting for authorization';
  const id = nextId(S.db.feeTasks);
  S.db.feeTasks.push({
    id,
    feeId: f.id,
    studentId: f.studentId,
    kind: v.kind,
    detail: v.detail,
    amount: v.kind === 'Concession' ? +v.amount : 0,
    newDue: v.kind === 'Extension' ? v.newDue : '',
    status: 'Pending',
    requestedBy: 'Admin office',
    createdAt: stamp(),
  });
  notify(leaders('feeAuthority'), 'Fee ' + v.kind.toLowerCase() + ' proposed for ' + sName(f.studentId), {
    icon: '🧾',
    ref: 'fee:' + id,
    action: true,
    link: ['Fee Authorization', 'Pending', 'fee:' + id],
  });
  commit('Sent for authorization', false);
};
export function extModal(fid) {
  const f = S.db.fees.find(x => x.id === fid);
  modal(
    mhead('Request more time', esc(f.category) + ' · ' + money(f.amount) + ' · due ' + fmtDate(f.due)) +
      formHTML(
        'ext',
        [
          `<input type="hidden" name="fid" value="${fid}">`,
          F('newDue', 'Pay by', 'date', { value: addDays(f.due > today() ? f.due : today(), 14) }),
          F('detail', 'Reason', 'text', { full: true, ph: 'e.g. Scholarship expected next month' }),
        ],
        'Send request',
      ),
  );
}
FORMS.ext = v => {
  const f = S.db.fees.find(x => x.id === +v.fid);
  if (!(v.newDue > f.due) || v.newDue < today())
    return { field: 'newDue', msg: 'Pick a future date after ' + fmtDate(f.due) };
  if (S.db.feeTasks.some(t => t.feeId === f.id && t.status === 'Pending'))
    return 'A request for this fee is already under review';
  const id = nextId(S.db.feeTasks);
  S.db.feeTasks.push({
    id,
    feeId: f.id,
    studentId: f.studentId,
    kind: 'Extension',
    detail: v.detail,
    newDue: v.newDue,
    amount: 0,
    status: 'Pending',
    requestedBy: me().name + ' (student)',
    createdAt: stamp(),
  });
  notify(leaders('feeAuthority'), 'Fee extension requested for ' + me().name, {
    icon: '🧾',
    ref: 'fee:' + id,
    action: true,
    link: ['Fee Authorization', 'Pending', 'fee:' + id],
  });
  commit('Request sent — you’ll be notified of the decision');
};
export function payModal(fid) {
  const f = S.db.fees.find(x => x.id === fid);
  modal(
    mhead('Record payment', esc(sName(f.studentId)) + ' · ' + esc(f.category)) +
      formHTML(
        'pay',
        [
          `<input type="hidden" name="fid" value="${fid}">`,
          F('a', 'Amount', 'readonly', { value: money(f.amount) }),
          F('method', 'Method', 'select', { options: ['Cash', 'UPI', 'Bank transfer', 'Cheque'] }),
          F('ref', 'Reference (optional)', 'text', { required: false, full: true }),
        ],
        'Mark as paid',
      ),
  );
}
FORMS.pay = v => {
  const f = S.db.fees.find(x => x.id === +v.fid);
  if (!f || f.status === 'Paid') return 'Already paid';
  const n = 1 + Math.max(1100, ...S.db.fees.map(x => +String(x.receipt || '').replace(/\D/g, '') || 0));
  Object.assign(f, { status: 'Paid', paidAt: today(), method: v.method, payRef: v.ref, receipt: 'R-' + n });
  S.db.feeTasks
    .filter(t => t.feeId === f.id && t.status === 'Pending')
    .forEach(t => {
      t.status = 'Withdrawn';
      resolveRef('fee:' + t.id);
    });
  notify('student:' + f.studentId, 'Payment received for ' + f.category + ' · receipt R-' + n, {
    icon: '🧾',
    link: ['Fees', 'Receipts'],
  });
  commit('Payment recorded · receipt R-' + n);
};
export function receiptModal(fid) {
  const f = S.db.fees.find(x => x.id === fid);
  if (!f) return;
  modal(
    mhead('Receipt ' + f.receipt, esc(S.db.settings.institution)) +
      `<dl class="kv"><dt>Student</dt><dd>${esc(sName(f.studentId))} · ${esc(sClass(f.studentId))}</dd><dt>Fee</dt><dd>${esc(f.category)}</dd><dt>Amount</dt><dd>${money(f.amount)}</dd><dt>Paid on</dt><dd>${fmtDate(f.paidAt)}${f.method ? ' · ' + esc(f.method) : ''}</dd></dl><div class="softinfo">Computer-generated receipt from OURCAMPUS.</div><div class="formactions">${btn('Download', call('downloadReceipt', fid), 'primary')}</div>`,
  );
}
export function downloadReceipt(fid) {
  const f = S.db.fees.find(x => x.id === fid);
  download(
    f.receipt + '.txt',
    `${S.db.settings.institution}\nRECEIPT ${f.receipt}\n\nStudent: ${sName(f.studentId)} (${sClass(f.studentId)})\nFee: ${f.category}\nAmount: Rs ${f.amount}\nPaid on: ${f.paidAt}${f.method ? ' via ' + f.method : ''}\n\nComputer-generated receipt from OURCAMPUS.`,
    'text/plain',
  );
}
PAGES['Fee Authorization'] = () => {
  const can = canDecide('feeAuthority'),
    pend = S.section === 'Pending',
    list = S.db.feeTasks
      .filter(t => (pend ? t.status === 'Pending' : t.status !== 'Pending'))
      .sort((a, b) => b.id - a.id);
  return (
    heading('Fee authorization', 'Concessions and extensions waiting for your decision.') +
    tabs() +
    (!can
      ? `<div class="banner">ℹ️ Fee authorization is configured for: ${esc(S.db.settings.feeAuthority)}.</div>`
      : '') +
    (list.length
      ? card(
          '',
          list
            .map(t => {
              const f = S.db.fees.find(x => x.id === t.feeId);
              return itemRow({
                icon: `<span class="taskicon t-purple" style="width:40px;height:40px;font-size:19px">🧾</span>`,
                title: esc(t.kind) + ' · ' + esc(sName(t.studentId)),
                meta:
                  (f ? esc(f.category) + ' · ' : '') +
                  (t.kind === 'Concession'
                    ? 'reduce by ' + money(t.amount)
                    : 'extend to ' + fmtDate(t.newDue)) +
                  ' · ' +
                  esc(t.detail),
                onclick: call('feeTaskDetail', t.id),
                right: pend && can ? btn('Review', call('feeTaskDetail', t.id), 'sm primary') : tag(t.status),
              });
            })
            .join(''),
        )
      : calm('🌿', pend ? 'Nothing waiting for authorization' : 'No decisions yet'))
  );
};
export function feeTaskDetail(id) {
  const t = S.db.feeTasks.find(x => x.id === id);
  if (!t) return toast('This item no longer exists', 'err');
  const f = S.db.fees.find(x => x.id === t.feeId),
    can = canDecide('feeAuthority') && t.status === 'Pending';
  modal(
    mhead(
      'Fee ' + t.kind.toLowerCase(),
      esc(sName(t.studentId)) + ' · ' + esc(sClass(t.studentId)) + ' · ' + tag(t.status),
    ) +
      `<dl class="kv"><dt>Fee</dt><dd>${f ? esc(f.category) + ' · ' + money(f.amount) + ' · due ' + fmtDate(f.due) : '—'}</dd><dt>Requested</dt><dd>${t.kind === 'Concession' ? 'Reduce by ' + money(t.amount) : 'Extend due date to ' + fmtDate(t.newDue)}</dd><dt>Reason</dt><dd>${esc(t.detail)}</dd><dt>Requested by</dt><dd>${esc(t.requestedBy)} · ${esc(rel(t.createdAt))}</dd>${t.decidedBy ? `<dt>Decided</dt><dd>${esc(t.decidedBy)} · ${esc(rel(t.decidedAt))}${t.note ? ' — ' + esc(t.note) : ''}</dd>` : ''}</dl>` +
      (can
        ? `<label style="font-weight:700;display:block">Note <span class="muted">(required to reject)</span><textarea class="field" id="fnote2" style="width:100%;margin-top:6px"></textarea></label><div class="formactions">${btn('Authorize', call('decideFee', id, 'Approved'), 'primary')}${btn('Reject', call('decideFee', id, 'Rejected'), 'danger')}</div>`
        : ''),
  );
}
export function decideFee(id, st) {
  const t = S.db.feeTasks.find(x => x.id === id),
    note = ($('fnote2')?.value || '').trim();
  if (!t || t.status !== 'Pending' || !canDecide('feeAuthority')) return;
  if (st === 'Rejected' && !note) {
    $('fnote2').classList.add('invalid');
    return toast('Add a short reason', 'err');
  }
  const f = S.db.fees.find(x => x.id === t.feeId);
  Object.assign(t, { status: st, decidedBy: S.role, decidedAt: stamp(), note });
  if (st === 'Approved' && f) {
    if (t.kind === 'Concession') {
      f.amount = Math.max(0, f.amount - t.amount);
      f.concession = (f.concession || 0) + t.amount;
    } else f.due = t.newDue;
  }
  resolveRef('fee:' + id);
  notify(
    'student:' + t.studentId,
    `Your fee ${t.kind.toLowerCase()} was ${st === 'Approved' ? 'approved ✓' : 'not approved'}`,
    { icon: '🧾', link: ['Fees', 'Status'] },
  );
  notify(
    'role:Admin',
    `${S.role} ${st === 'Approved' ? 'authorized' : 'rejected'} a fee ${t.kind.toLowerCase()} for ${sName(t.studentId)}`,
    { icon: '🧾', link: ['Fees', 'Adjustments'] },
  );
  commit(st === 'Approved' ? 'Authorized — fee updated' : 'Rejected');
}
