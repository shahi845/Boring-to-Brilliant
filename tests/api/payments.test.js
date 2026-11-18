// Online payment API tests: fake Supabase (auth, profiles, records, notifications) + fake Razorpay.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../../server/app.js';

const SECRET = 'test_secret_123';
function fakes() {
  const records = new Map(); // "collection|key" -> row
  const notes = [];
  const orders = [];
  const tokens = { 'tok-student': 'u1', 'tok-other': 'u2', 'tok-admin': 'u3' };
  const profiles = [
    { user_id: 'u1', login_id: 'ST-1001', role: 'Student', person_id: 1, display_name: 'Ahmed Rashid' },
    { user_id: 'u2', login_id: 'ST-1002', role: 'Student', person_id: 2, display_name: 'Amina Rahman' },
    { user_id: 'u3', login_id: 'ADMIN', role: 'Admin', person_id: null, display_name: 'Admin office' },
  ];
  const put = (c, k, sid, data) => records.set(c + '|' + k, { collection: c, key: k, student_id: sid, data });
  put('fees', '7', 1, {
    id: 7,
    studentId: 1,
    category: 'Trip fee',
    amount: 20,
    due: '2026-12-01',
    status: 'Pending',
  });
  put('fees', '8', 1, {
    id: 8,
    studentId: 1,
    category: 'Exam fee',
    amount: 350,
    due: '2026-12-01',
    status: 'Pending',
  });
  put('fees', '1', 2, {
    id: 1,
    studentId: 2,
    category: 'Old fee',
    amount: 100,
    status: 'Paid',
    receipt: 'R-1200',
  });
  const json = (status, body) => new Response(body == null ? '' : JSON.stringify(body), { status });
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    if (u.hostname === 'api.razorpay.com') {
      assert.equal(
        opts.headers.Authorization,
        'Basic ' + Buffer.from('rzp_test_abc:' + SECRET).toString('base64'),
      );
      const o = { id: 'order_' + (orders.length + 1), ...body, status: 'created' };
      orders.push(o);
      return json(200, o);
    }
    if (u.pathname === '/auth/v1/user') {
      const id = tokens[(opts.headers.Authorization || '').slice(7)];
      return id ? json(200, { id }) : json(401, { msg: 'bad token' });
    }
    if (u.pathname === '/rest/v1/profiles') {
      const uid = (u.searchParams.get('user_id') || '').replace('eq.', '');
      return json(
        200,
        profiles.filter(p => p.user_id === uid),
      );
    }
    if (u.pathname === '/rest/v1/records') {
      const c = (u.searchParams.get('collection') || '').replace('eq.', ''),
        k = (u.searchParams.get('key') || '').replace('eq.', '');
      if (method === 'POST') {
        put(body.collection, body.key, body.student_id, body.data);
        return json(201, null);
      }
      return json(
        200,
        [...records.values()]
          .filter(r => r.collection === c && (!k || r.key === k))
          .map(r => ({ data: r.data })),
      );
    }
    if (u.pathname === '/rest/v1/notifications' && method === 'POST') {
      notes.push(...body);
      return json(201, null);
    }
    return json(404, { msg: 'unhandled ' + u.pathname });
  };
  return { fetchImpl, records, notes, orders };
}

let server, base, F;
const call = (path, token, body) =>
  fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ status: r.status, body: await r.json() }));
const sign = (o, p) => createHmac('sha256', SECRET).update(`${o}|${p}`).digest('hex');

describe('online payments API', () => {
  before(async () => {
    F = fakes();
    const cfg = {
      supabaseUrl: 'https://fake.supabase.co',
      serviceKey: 'svc',
      ready: true,
      allowedOrigins: [],
      staticDir: '.',
      loginDomain: 'ourcampus.app',
      rateLimit: { windowMs: 60000, max: 1000 },
      razorpayKeyId: 'rzp_test_abc',
      razorpayKeySecret: SECRET,
    };
    server = createApp(cfg, { fetchImpl: F.fetchImpl, log: {} });
    await new Promise(r => server.listen(0, r));
    base = 'http://127.0.0.1:' + server.address().port;
  });
  after(() => server.close());

  test('config shows Razorpay in test mode without exposing the secret', async () => {
    const r = await call('/api/payments/config', 'tok-student');
    assert.deepEqual(r.body, { razorpay: true, keyId: 'rzp_test_abc', mode: 'test' });
  });

  test('order uses the amount from the database, in paise', async () => {
    const r = await call('/api/payments/order', 'tok-student', { feeId: 7, amount: 1 });
    assert.equal(r.status, 201);
    assert.equal(r.body.amount, 2000);
    assert.equal(F.orders[0].amount, 2000);
    assert.equal(F.records.get('payments|' + r.body.orderId).data.status, 'Started');
  });

  test('students cannot pay someone else’s fee or a paid fee', async () => {
    assert.equal((await call('/api/payments/order', 'tok-other', { feeId: 7 })).status, 404);
    assert.equal((await call('/api/payments/order', 'tok-other', { feeId: 1 })).status, 409);
    assert.equal((await call('/api/payments/order', 'tok-admin', { feeId: 7 })).status, 403);
    assert.equal((await call('/api/payments/order', '', { feeId: 7 })).status, 401);
  });

  test('a forged signature is refused and nothing is marked paid', async () => {
    const o = (await call('/api/payments/order', 'tok-student', { feeId: 8 })).body.orderId;
    const r = await call('/api/payments/verify', 'tok-student', {
      orderId: o,
      paymentId: 'pay_x',
      signature: 'deadbeef',
    });
    assert.equal(r.status, 400);
    assert.equal(F.records.get('fees|8').data.status, 'Pending');
    assert.equal(F.records.get('payments|' + o).data.status, 'Failed');
  });

  test('a genuine Razorpay payment marks the fee paid with a receipt and notifies', async () => {
    const o = F.orders[0].id;
    const r = await call('/api/payments/verify', 'tok-student', {
      orderId: o,
      paymentId: 'pay_ok1',
      signature: sign(o, 'pay_ok1'),
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.receipt, 'R-1201');
    const fee = F.records.get('fees|7').data;
    assert.equal(fee.status, 'Paid');
    assert.equal(fee.payRef, 'pay_ok1');
    assert.equal(F.records.get('payments|' + o).data.status, 'Paid');
    assert.ok(F.notes.some(n => n.audience[0] === 'student:1' && /R-1201/.test(n.data.text)));
    assert.ok(F.notes.some(n => n.audience[0] === 'role:Admin'));
    const again = await call('/api/payments/verify', 'tok-student', {
      orderId: o,
      paymentId: 'pay_ok1',
      signature: sign(o, 'pay_ok1'),
    });
    assert.equal(again.body.already, true);
  });

  test('UPI claim is saved for the office and duplicates are refused', async () => {
    assert.equal((await call('/api/payments/upi-claim', 'tok-student', { feeId: 8, utr: '12' })).status, 400);
    const r = await call('/api/payments/upi-claim', 'tok-student', { feeId: 8, utr: '412345678901' });
    assert.equal(r.status, 201);
    const p = F.records.get('payments|' + r.body.id).data;
    assert.equal(p.status, 'Pending');
    assert.equal(p.amount, 350);
    assert.equal(F.records.get('fees|8').data.status, 'Pending');
    assert.ok(F.notes.some(n => n.data.ref === 'pay:' + r.body.id && n.data.action));
    assert.equal(
      (await call('/api/payments/upi-claim', 'tok-student', { feeId: 8, utr: '412345678901' })).status,
      409,
    );
  });
});
