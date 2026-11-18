/**
 * Online fee payments.
 *   GET  /api/payments/config      which payment methods are switched on (public key only)
 *   POST /api/payments/order       student starts a Razorpay payment for one of their fees
 *   POST /api/payments/verify      Razorpay signature check → fee marked Paid, receipt issued
 *   POST /api/payments/upi-claim   student paid by direct UPI → Admin confirms with the UTR
 * Every step is saved in Supabase (collection "payments"), so there is a full record.
 * Amounts always come from the fee in the database, never from the browser.
 */
import { authenticate } from '../lib/auth.js';
import { HttpError, readJson, send } from '../lib/http.js';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const stamp = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date())
      .map(x => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
};
const newId = () => Date.now() * 10 + Math.floor(Math.random() * 10);
const money = n => '₹' + Number(n).toLocaleString('en-IN');

async function ownUnpaidFee(admin, ctx, feeId) {
  if (ctx.profile.role !== 'Student') throw new HttpError(403, 'Only students pay fees online');
  const fee = await admin.getRecord('fees', String(feeId));
  if (!fee || +fee.studentId !== +ctx.profile.person_id) throw new HttpError(404, 'Fee not found');
  if (fee.status === 'Paid') throw new HttpError(409, 'This fee is already paid');
  if (!(+fee.amount > 0)) throw new HttpError(400, 'Nothing to pay for this fee');
  return fee;
}

async function nextReceipt(admin) {
  const fees = await admin.listRecords('fees');
  const n = Math.max(1100, ...fees.map(f => +String(f.receipt || '').replace(/\D/g, '') || 0)) + 1;
  return 'R-' + n;
}

/** Mark a fee paid and tell the student and the office. Used by Razorpay verify. */
export async function settleFee(admin, { fee, method, payRef, studentName }) {
  const receipt = await nextReceipt(admin);
  const paid = { ...fee, status: 'Paid', paidAt: today(), method, payRef, receipt };
  await admin.upsertRecord({
    collection: 'fees',
    key: String(fee.id),
    student_id: fee.studentId,
    data: paid,
  });
  await admin.insertNotifications([
    {
      audience: ['student:' + fee.studentId],
      data: {
        text: `Payment received for ${fee.category} · ${money(fee.amount)} · receipt ${receipt}`,
        icon: '🧾',
        link: ['Fees', 'Receipts'],
      },
    },
    {
      audience: ['role:Admin'],
      data: {
        text: `${studentName} paid ${fee.category} online · ${money(fee.amount)} · ${receipt}`,
        icon: '💳',
        link: ['Fees', 'Online Payments'],
      },
    },
  ]);
  return paid;
}

export async function paymentsRoute(req, res, { admin, razorpay, cfg, parts, audit }) {
  const action = parts[0] || '';
  if (req.method === 'GET' && action === 'config') {
    await authenticate(req, admin);
    return send(res, 200, {
      razorpay: razorpay.ready,
      keyId: razorpay.ready ? razorpay.keyId : '',
      mode: razorpay.mode,
    });
  }
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const ctx = await authenticate(req, admin);
  const body = await readJson(req);

  if (action === 'order') {
    const fee = await ownUnpaidFee(admin, ctx, body.feeId);
    const amount = Math.round(+fee.amount * 100);
    const order = await razorpay.createOrder({
      amount,
      receipt: 'fee_' + fee.id,
      notes: {
        feeId: String(fee.id),
        studentId: String(fee.studentId),
        fee: String(fee.category).slice(0, 200),
      },
    });
    await admin.upsertRecord({
      collection: 'payments',
      key: order.id,
      student_id: fee.studentId,
      data: {
        id: order.id,
        orderId: order.id,
        feeId: fee.id,
        studentId: fee.studentId,
        category: fee.category,
        amount: +fee.amount,
        method: 'Razorpay',
        status: 'Started',
        createdAt: stamp(),
        mode: razorpay.mode,
      },
    });
    audit('payment.order', ctx, order.id);
    return send(res, 201, {
      orderId: order.id,
      amount,
      currency: 'INR',
      keyId: razorpay.keyId,
      mode: razorpay.mode,
      name: ctx.profile.display_name || '',
    });
  }

  if (action === 'verify') {
    const { orderId, paymentId, signature } = body;
    const p = await admin.getRecord('payments', String(orderId || ''));
    if (!p || +p.studentId !== +ctx.profile.person_id) throw new HttpError(404, 'Payment not found');
    if (!razorpay.verify(orderId, paymentId, signature)) {
      await admin.upsertRecord({
        collection: 'payments',
        key: p.id,
        student_id: p.studentId,
        data: { ...p, status: 'Failed', note: 'Signature did not match', updatedAt: stamp() },
      });
      throw new HttpError(
        400,
        'Payment could not be verified — no money was recorded. If your account was debited, contact the office with this ID: ' +
          paymentId,
      );
    }
    if (p.status === 'Paid') return send(res, 200, { receipt: p.receipt, already: true });
    const fee = await admin.getRecord('fees', String(p.feeId));
    if (!fee) throw new HttpError(404, 'Fee not found');
    const paid =
      fee.status === 'Paid'
        ? fee
        : await settleFee(admin, {
            fee,
            method: 'Online · Razorpay',
            payRef: paymentId,
            studentName: ctx.profile.display_name || 'A student',
          });
    await admin.upsertRecord({
      collection: 'payments',
      key: p.id,
      student_id: p.studentId,
      data: { ...p, status: 'Paid', paymentId, receipt: paid.receipt, paidAt: stamp() },
    });
    audit('payment.paid', ctx, paymentId);
    return send(res, 200, { receipt: paid.receipt });
  }

  if (action === 'upi-claim') {
    const fee = await ownUnpaidFee(admin, ctx, body.feeId);
    const utr = String(body.utr || '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9]{10,22}$/.test(utr))
      throw new HttpError(400, 'Enter the 12-digit UPI reference (UTR) from your payment app');
    const all = await admin.listRecords('payments');
    if (all.some(x => x.utr === utr && x.status !== 'Rejected'))
      throw new HttpError(409, 'This UPI reference was already submitted');
    if (all.some(x => x.feeId === fee.id && x.method === 'UPI' && x.status === 'Pending'))
      throw new HttpError(409, 'A UPI payment for this fee is already waiting for the office to confirm');
    const id = 'upi_' + newId();
    const rec = {
      id,
      feeId: fee.id,
      studentId: fee.studentId,
      category: fee.category,
      amount: +fee.amount,
      method: 'UPI',
      utr,
      status: 'Pending',
      createdAt: stamp(),
    };
    await admin.upsertRecord({ collection: 'payments', key: id, student_id: fee.studentId, data: rec });
    await admin.insertNotifications([
      {
        audience: ['role:Admin'],
        data: {
          text: `${ctx.profile.display_name || 'A student'} paid ${fee.category} by UPI · ${money(fee.amount)} · UTR ${utr} — please confirm`,
          icon: '💳',
          link: ['Fees', 'Online Payments'],
          action: true,
          ref: 'pay:' + id,
        },
      },
    ]);
    audit('payment.upi-claim', ctx, id);
    return send(res, 201, { id });
  }

  throw new HttpError(404, 'Not found');
}
