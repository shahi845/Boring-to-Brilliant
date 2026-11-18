/* ==========================================================================
   ONLINE FEE PAYMENTS
   - Razorpay Checkout: UPI, debit/credit cards, net banking, wallets.
     The server creates the order and verifies Razorpay's signature, then
     marks the fee Paid (students can never mark their own fees paid).
   - Direct UPI: a real UPI QR / app link to the college's own UPI ID.
     The student sends the UTR; the Admin confirms it against the bank.
   - Every payment is saved in Supabase ("payments") and can be downloaded
     as a CSV backup.
   ========================================================================== */
import qrcode from 'qrcode-generator';
import { FORMS } from '../app/registry.js';
import { go, render } from '../app/router.js';
import { apiFetch } from '../lib/accounts.js';
import { notify, resolveRef } from '../lib/notifications.js';
import { actorName, me } from '../lib/permissions.js';
import { refresh } from '../lib/store.js';
import { esc, fmtDate, money, plural, sClass, sName, stamp, today } from '../lib/utils.js';
import { S } from '../state.js';
import { btn, call, calm, card, table, tag } from '../ui/components.js';
import { closeModal, mhead, modal, toast } from '../ui/feedback.js';
import { F, commit, formHTML } from '../ui/forms.js';

export const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;
const upiCfg = () => S.db.settings.payments || {};
export const upiReady = () => UPI_RE.test(upiCfg().upiId || '') && !!(upiCfg().payee || '').trim();

/** Standard UPI payment link (NPCI "upi://pay"), understood by every UPI app. */
export function upiLink(fee, student) {
  const c = upiCfg(),
    note = `${fee.category} ${student?.roll || ''}`
      .replace(/[^\w .\-/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);
  // the UPI ID is validated (letters, digits, . _ - and one @) so it goes in as-is — some apps reject %40
  return (
    `upi://pay?pa=${c.upiId.trim()}` +
    `&pn=${encodeURIComponent(c.payee.trim().slice(0, 50))}` +
    `&am=${(+fee.amount).toFixed(2)}&cu=INR` +
    `&tn=${encodeURIComponent(note)}&tr=OC${fee.id}`
  );
}
/** Real, scannable QR code as inline SVG. */
export function qrSVG(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

let payCfg = null;
export async function paymentConfig(force = false) {
  if (!payCfg || force) {
    try {
      const { data } = await apiFetch('/api/payments/config');
      payCfg = data || { razorpay: false, mode: 'off' };
    } catch {
      payCfg = { razorpay: false, mode: 'off' };
    }
  }
  return payCfg;
}

const pendingUpi = feeId =>
  S.db.payments.find(p => +p.feeId === +feeId && p.method === 'UPI' && p.status === 'Pending');
export const feePaymentPending = pendingUpi;

/* ---------------- student: pay a fee ---------------- */
export function payNow(feeId) {
  const f = S.db.fees.find(x => x.id === +feeId),
    s = me();
  if (!f || f.status === 'Paid') return toast('This fee is already paid', 'info');
  const upi = upiReady();
  modal(
    `<div class="paysheet">
<div class="pay-head"><div><div class="hero-eyebrow">💳 PAY FEE</div><h2>${money(f.amount)}</h2><p>${esc(f.category)} · due ${fmtDate(f.due)}</p></div><div class="pay-to"><span>Paying</span><b>${esc(S.db.settings.institution || 'OURCAMPUS')}</b><small>${esc(s?.name || '')} · ${esc(s?.roll || '')}</small></div></div>
<div class="pay-method" id="payRzp"><div class="pay-mhead"><span class="pay-ico">⚡</span><div><b>UPI, card or net banking</b><div class="muted">Google Pay · PhonePe · Paytm · BHIM · Visa · Mastercard · RuPay · all major banks</div></div></div><div class="pay-rzp-body"><div class="spinner small"></div></div></div>
${
  upi
    ? `<div class="pay-method"><div class="pay-mhead"><span class="pay-ico">📱</span><div><b>Scan &amp; pay with any UPI app</b><div class="muted">Pays the college directly · no extra charges</div></div></div>
<div class="pay-upi"><div class="pay-qr" role="img" aria-label="UPI QR code for ${money(f.amount)} to ${esc(upiCfg().upiId)}">${qrSVG(upiLink(f, s))}</div>
<div class="pay-upi-side"><ol><li>Scan the QR, or tap <b>Open UPI app</b> on your phone.</li><li>Check the amount is <b>${money(f.amount)}</b> and the name is <b>${esc(upiCfg().payee)}</b>.</li><li>After paying, enter the 12-digit <b>UTR / UPI reference</b> below.</li></ol>
<div class="pay-upiid"><span>UPI ID</span><b>${esc(upiCfg().upiId)}</b>${btn('Copy', call('copyUpi', upiCfg().upiId), 'sm')}</div>
<a class="btn primary pay-open" href="${esc(upiLink(f, s))}">Open UPI app</a></div></div>
<form class="pay-utr" onsubmit="event.preventDefault();upiClaim(${f.id})"><label>UPI reference (UTR)<input class="field" id="utr" inputmode="numeric" autocomplete="off" maxlength="22" placeholder="e.g. 412345678901"></label><button class="btn" type="submit" id="utrbtn">I’ve paid — send to office</button></form></div>`
    : ''
}
<div class="pay-office">🏫 You can also pay cash at the office. Your receipt appears under <b>Fees → Receipts</b>.</div>
<div class="formactions" style="margin-top:6px">${btn('Close', 'closeModal()')}</div></div>`,
  );
  paymentConfig().then(c => {
    const el = document.querySelector('#payRzp .pay-rzp-body');
    if (!el) return;
    el.innerHTML = c.razorpay
      ? `<button type="button" class="btn primary pay-big" onclick="${call('startRazorpay', f.id)}">Pay ${money(f.amount)} securely</button><div class="pay-secure">🔒 Secured by Razorpay · your card and bank details are never seen or stored by OURCAMPUS${c.mode === 'test' ? ' · <span class="chip" style="background:#fff3c4;color:#8a5a00">TEST MODE — no real money</span>' : ''}</div>`
      : `<div class="muted">Card and net-banking payments aren’t switched on yet${upi ? ' — use UPI below, or pay at the office.' : '. Pay at the office for now.'}</div>`;
  });
}
export function copyUpi(id) {
  navigator.clipboard?.writeText(id).then(
    () => toast('UPI ID copied'),
    () => toast(id, 'info'),
  );
}

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise(res => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => res(true);
    s.onerror = () => res(false);
    document.head.appendChild(s);
  });
}

let paying = false;
export async function startRazorpay(feeId) {
  if (paying) return;
  const f = S.db.fees.find(x => x.id === +feeId),
    s = me();
  if (!f) return;
  paying = true;
  const b = document.querySelector('.pay-big');
  if (b) ((b.disabled = true), (b.textContent = 'Opening secure checkout…'));
  try {
    const ok = await loadCheckout();
    if (!ok) return toast('Couldn’t load the payment window — check your internet and try again', 'err');
    const { data, error } = await apiFetch('/api/payments/order', {
      method: 'POST',
      body: JSON.stringify({ feeId: f.id }),
    });
    if (error) return toast(error.message, 'err');
    const rzp = new window.Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: 'INR',
      order_id: data.orderId,
      name: S.db.settings.institution || 'OURCAMPUS',
      description: f.category,
      prefill: { name: s?.name || '', email: s?.email || '' },
      notes: { feeId: String(f.id) },
      theme: { color: '#0e9f9a' },
      handler: r => verifyPayment(r, f),
      modal: { ondismiss: () => toast('Payment window closed — nothing was charged', 'info') },
    });
    rzp.on('payment.failed', r =>
      toast('Payment failed: ' + (r?.error?.description || 'please try again'), 'err'),
    );
    closeModal();
    rzp.open();
  } finally {
    paying = false;
    if (b?.isConnected) ((b.disabled = false), (b.textContent = 'Pay ' + money(f.amount) + ' securely'));
  }
}

async function verifyPayment(r, f) {
  modal(
    `<div class="calm" style="padding:30px"><div class="spinner"></div><b style="margin-top:12px">Confirming your payment…</b><div>Please don’t close this page.</div></div>`,
  );
  const { data, error } = await apiFetch('/api/payments/verify', {
    method: 'POST',
    body: JSON.stringify({
      orderId: r.razorpay_order_id,
      paymentId: r.razorpay_payment_id,
      signature: r.razorpay_signature,
    }),
  });
  if (error) {
    closeModal();
    return toast(error.message, 'err');
  }
  await refresh(true);
  paidModal(f, data.receipt, r.razorpay_payment_id);
}

function paidModal(f, receipt, ref) {
  modal(
    `<div class="paid-ok"><div class="paid-tick">✓</div><h2>Payment successful!</h2><p>${esc(f.category)} · <b>${money(f.amount)}</b></p>
<dl class="kv" style="text-align:left;margin:14px auto;max-width:320px"><dt>Receipt</dt><dd>${esc(receipt)}</dd><dt>Payment ID</dt><dd style="overflow-wrap:anywhere">${esc(ref)}</dd><dt>Date</dt><dd>${fmtDate(today())}</dd></dl>
<div class="formactions" style="justify-content:center">${btn('View receipt', "closeModal();go('Fees','Receipts')", 'primary')}${btn('Done', 'closeModal()')}</div></div>`,
  );
}

export async function upiClaim(feeId) {
  const i = document.getElementById('utr'),
    b = document.getElementById('utrbtn'),
    utr = (i?.value || '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9]{10,22}$/.test(utr)) {
    i?.classList.add('invalid');
    return toast('Enter the 12-digit UPI reference (UTR) from your payment app', 'err');
  }
  if (b) b.disabled = true;
  const { error } = await apiFetch('/api/payments/upi-claim', {
    method: 'POST',
    body: JSON.stringify({ feeId: +feeId, utr }),
  });
  if (b) b.disabled = false;
  if (error) return toast(error.message, 'err');
  await refresh(true);
  modal(
    `<div class="paid-ok"><div class="paid-tick" style="background:#1cb0f6">⏳</div><h2>Sent to the office</h2><p>The office checks UPI reference <b>${esc(utr)}</b> with the bank and confirms your payment. You’ll get a notification and your receipt.</p><div class="formactions" style="justify-content:center">${btn('OK', 'closeModal()', 'primary')}</div></div>`,
  );
}

/* ---------------- admin: online payments ---------------- */
let payFilter = 'To confirm';
export function setPayFilter(f) {
  payFilter = f;
  render();
}
function nextReceipt() {
  return 'R-' + (1 + Math.max(1100, ...S.db.fees.map(x => +String(x.receipt || '').replace(/\D/g, '') || 0)));
}
export function paymentsAdminHTML() {
  const all = S.db.payments
    .filter(p => p.status !== 'Started')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const toConfirm = all.filter(p => p.status === 'Pending'),
    paid = all.filter(p => p.status === 'Paid'),
    month = today().slice(0, 7),
    monthSum = paid
      .filter(p => String(p.paidAt || p.createdAt).startsWith(month))
      .reduce((a, p) => a + +p.amount, 0);
  const rows = payFilter === 'To confirm' ? toConfirm : payFilter === 'Paid' ? paid : all;
  const setup = `<div class="softinfo pay-setup" id="paySetup">${upiReady() ? `📱 Direct UPI: <b>${esc(upiCfg().upiId)}</b> (${esc(upiCfg().payee)})` : '📱 Direct UPI is off — add the college UPI ID in <a href="#/Settings/Payments">Settings → Payments</a>.'}<br><span id="rzpState">⚡ Checking Razorpay…</span></div>`;
  setTimeout(() =>
    paymentConfig(true).then(c => {
      const el = document.getElementById('rzpState');
      if (el)
        el.innerHTML = c.razorpay
          ? `⚡ Razorpay connected · <b>${c.mode === 'live' ? 'LIVE — real money' : 'TEST mode — no real money'}</b>`
          : '⚡ Razorpay not connected — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel (see Settings → Payments).';
    }),
  );
  return (
    setup +
    `<div class="cards" style="margin:14px 0">${[
      ['⏳', 'To confirm', toConfirm.length, 'UPI payments waiting'],
      ['✅', 'Paid online', paid.length, 'all time'],
      ['💰', 'This month', money(monthSum), 'received'],
    ]
      .map(
        ([i, l, v, m]) =>
          `<div class="card statcard"><div class="muted">${i} ${l}</div><b style="font-size:26px">${v}</b><div class="tinyhint">${m}</div></div>`,
      )
      .join('')}</div>` +
    `<div class="toolbar">${['To confirm', 'Paid', 'All']
      .map(
        x =>
          `<button class="btn sm ${payFilter === x ? 'primary' : ''}" onclick="${call('setPayFilter', x)}">${x}</button>`,
      )
      .join(
        '',
      )}<span style="flex:1"></span>${btn('⬇ Payments backup (CSV)', 'downloadPaymentsCSV()', 'sm')}${btn('⬇ Fees backup (CSV)', 'downloadFeesCSV()', 'sm')}</div>` +
    card(
      '',
      table(
        ['Student', 'Fee', 'Amount', 'Method', 'Reference', 'Date', 'Status', ''],
        rows.map(p => [
          esc(sName(p.studentId)) + ' <span class="muted">' + esc(sClass(p.studentId)) + '</span>',
          esc(p.category || ''),
          money(p.amount),
          esc(p.method) + (p.mode === 'test' ? ' <span class="chip grey">test</span>' : ''),
          `<code>${esc(p.utr || p.paymentId || p.payRef || '—')}</code>`,
          esc(p.paidAt || p.createdAt || ''),
          tag(p.status === 'Pending' ? 'To confirm' : p.status) +
            (p.receipt ? ' <span class="muted">' + esc(p.receipt) + '</span>' : ''),
          p.status === 'Pending' && p.method === 'UPI'
            ? btn('Confirm', call('confirmUpi', p.id), 'sm primary') +
              ' ' +
              btn('Reject', call('rejectUpiModal', p.id), 'sm danger')
            : '',
        ]),
        payFilter === 'To confirm' ? 'Nothing to confirm 🎉' : 'No payments yet',
      ),
    ) +
    `<p class="tinyhint">Before confirming a UPI payment, check the UTR and amount in the college bank account or UPI app. Razorpay payments are confirmed automatically.</p>`
  );
}
export function confirmUpi(id) {
  const p = S.db.payments.find(x => x.id === id);
  if (!p || p.status !== 'Pending') return;
  const f = S.db.fees.find(x => x.id === +p.feeId);
  const receipt = f && f.status !== 'Paid' ? nextReceipt() : f?.receipt || '';
  if (f && f.status !== 'Paid')
    Object.assign(f, { status: 'Paid', paidAt: today(), method: 'UPI', payRef: p.utr, receipt });
  Object.assign(p, { status: 'Paid', receipt, paidAt: stamp(), confirmedBy: actorName() });
  resolveRef('pay:' + id);
  notify(
    'student:' + p.studentId,
    `UPI payment confirmed for ${p.category} · ${money(p.amount)} · receipt ${receipt}`,
    {
      icon: '🧾',
      link: ['Fees', 'Receipts'],
    },
  );
  commit('Payment confirmed · receipt ' + receipt, false);
}
export function rejectUpiModal(id) {
  const p = S.db.payments.find(x => x.id === id);
  if (!p) return;
  modal(
    mhead('Reject UPI payment', esc(sName(p.studentId)) + ' · ' + money(p.amount) + ' · UTR ' + esc(p.utr)) +
      formHTML(
        'rejectupi',
        [
          `<input type="hidden" name="id" value="${esc(id)}">`,
          F('reason', 'Reason for the student', 'text', {
            full: true,
            ph: 'e.g. No payment with this UTR found in the bank statement',
          }),
        ],
        'Reject payment',
      ),
  );
}
FORMS.rejectupi = v => {
  const p = S.db.payments.find(x => x.id === v.id);
  if (!p) return 'Payment not found';
  Object.assign(p, { status: 'Rejected', note: v.reason, confirmedBy: actorName(), updatedAt: stamp() });
  resolveRef('pay:' + p.id);
  notify(
    'student:' + p.studentId,
    `Your UPI payment for ${p.category} (UTR ${p.utr}) couldn’t be confirmed: ${v.reason}`,
    {
      icon: '⚠️',
      link: ['Fees', 'Status'],
    },
  );
  commit('Payment rejected — the student was told why');
};

/* ---------------- CSV backups ---------------- */
function csv(rows) {
  return rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 500);
}
export function downloadPaymentsCSV() {
  const head = [
    'Payment ID',
    'Student',
    'Class',
    'Roll',
    'Fee',
    'Amount (INR)',
    'Method',
    'UTR / Payment ref',
    'Status',
    'Receipt',
    'Started',
    'Paid / updated',
    'Confirmed by',
    'Mode',
  ];
  const rows = S.db.payments.map(p => {
    const s = S.db.students.find(x => x.id === +p.studentId);
    return [
      p.id,
      s?.name,
      s?.class,
      s?.roll,
      p.category,
      p.amount,
      p.method,
      p.utr || p.paymentId || p.payRef || '',
      p.status,
      p.receipt || '',
      p.createdAt,
      p.paidAt || p.updatedAt || '',
      p.confirmedBy || '',
      p.mode || '',
    ];
  });
  download(`ourcampus-payments-${today()}.csv`, csv([head, ...rows]));
  toast(plural(rows.length, 'payment') + ' exported');
}
export function downloadFeesCSV() {
  const head = [
    'Fee ID',
    'Student',
    'Class',
    'Roll',
    'Fee',
    'Amount (INR)',
    'Due',
    'Status',
    'Paid on',
    'Method',
    'Reference',
    'Receipt',
  ];
  const rows = S.db.fees.map(f => {
    const s = S.db.students.find(x => x.id === +f.studentId);
    return [
      f.id,
      s?.name,
      s?.class,
      s?.roll,
      f.category,
      f.amount,
      f.due,
      f.status,
      f.paidAt || '',
      f.method || '',
      f.payRef || '',
      f.receipt || '',
    ];
  });
  download(`ourcampus-fees-${today()}.csv`, csv([head, ...rows]));
  toast(plural(rows.length, 'fee') + ' exported');
}

/* ---------------- settings: payment details ---------------- */
export function paymentSettingsHTML() {
  const c = upiCfg();
  setTimeout(() =>
    paymentConfig(true).then(r => {
      const el = document.getElementById('rzpSetting');
      if (el)
        el.innerHTML = r.razorpay
          ? `✅ Connected · <b>${r.mode === 'live' ? 'LIVE mode — real money' : 'TEST mode — no real money'}</b> · key ${esc(r.keyId)}`
          : `Not connected yet. In Vercel → Settings → Environment Variables add <code>RAZORPAY_KEY_ID</code> (Config) and <code>RAZORPAY_KEY_SECRET</code> (Secret) from <b>dashboard.razorpay.com → Account &amp; Settings → API Keys</b>, then redeploy. Start with <code>rzp_test_…</code> keys.`;
    }),
  );
  return `<div class="row2">${card(
    'Direct UPI (college account)',
    `<p class="muted" style="margin-top:0">Students see a real UPI QR code and an “Open UPI app” button that pays this UPI ID. Payments go straight to the college — no fees. The office confirms each one with its UTR.</p>` +
      formHTML(
        'paysettings',
        [
          F('upiId', 'College UPI ID', 'text', {
            value: c.upiId || '',
            ph: 'e.g. ourcampus@okhdfcbank',
            required: false,
            hint: 'Exactly as shown in the college’s UPI / bank app.',
          }),
          F('payee', 'Account name shown to students', 'text', {
            value: c.payee || '',
            ph: 'e.g. MDIA College',
            required: false,
          }),
        ],
        'Save UPI details',
      ) +
      (upiReady()
        ? `<div class="pay-preview"><div class="pay-qr small">${qrSVG(upiLink({ id: 0, amount: 1, category: 'Test payment' }, { roll: '' }))}</div><div class="tinyhint">Test this QR with ₹1 from your own phone before sharing it. It should show <b>${esc(c.payee)}</b>.</div></div>`
        : ''),
  )}${card(
    'Cards, UPI & net banking (Razorpay)',
    `<p class="muted" style="margin-top:0">Razorpay’s official checkout handles UPI, all debit/credit cards (Visa, Mastercard, RuPay), net banking and wallets. Paid fees are marked automatically and a receipt is issued.</p><div class="softinfo" id="rzpSetting">Checking…</div><p class="tinyhint">Razorpay charges about 2% per payment. Keys are kept on the server — the secret key is never sent to browsers.</p>`,
  )}</div>`;
}
FORMS.paysettings = v => {
  const upiId = v.upiId.trim(),
    payee = v.payee.trim();
  if (upiId && !UPI_RE.test(upiId))
    return { field: 'upiId', msg: 'That doesn’t look like a UPI ID (name@bank)' };
  if (upiId && !payee) return { field: 'payee', msg: 'Add the account name students should see' };
  S.db.settings.payments = { upiId, payee };
  commit(upiId ? 'UPI details saved — students can now pay by UPI' : 'Direct UPI turned off', false);
};
