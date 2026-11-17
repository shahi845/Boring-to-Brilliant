// API server tests against an in-memory fake of the Supabase Auth Admin + REST endpoints.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../../server/app.js';
import { createAccounts, parseCsv } from '../../server/scripts/create-accounts.mjs';

function fakeSupabase() {
  const users = new Map(); // id -> {email,password}
  const tokens = new Map(); // token -> userId
  const profiles = [];
  let n = 0;
  const json = (status, body, headers = {}) =>
    new Response(body == null ? '' : JSON.stringify(body), { status, headers });
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    if (u.pathname === '/auth/v1/user') {
      const id = tokens.get((opts.headers.Authorization || '').slice(7));
      return id ? json(200, { id }) : json(401, { msg: 'invalid JWT' });
    }
    if (u.pathname === '/auth/v1/admin/users' && method === 'POST') {
      if ([...users.values()].some(x => x.email === body.email))
        return json(422, { msg: 'User already registered' });
      const id = 'u' + ++n;
      users.set(id, { email: body.email, password: body.password });
      return json(200, { id });
    }
    const m = u.pathname.match(/^\/auth\/v1\/admin\/users\/(.+)$/);
    if (m && method === 'PUT')
      return users.has(m[1])
        ? ((users.get(m[1]).password = body.password), json(200, { id: m[1] }))
        : json(404, { msg: 'no user' });
    if (m && method === 'DELETE') {
      users.delete(m[1]);
      profiles.splice(
        profiles.findIndex(p => p.user_id === m[1]),
        1,
      );
      return json(200, {});
    }
    if (u.pathname === '/rest/v1/profiles' && method === 'GET') {
      const [k, v] = [...u.searchParams].find(([key]) => key !== 'select');
      return json(
        200,
        profiles.filter(p => String(p[k]) === v.replace(/^eq\./, '')),
      );
    }
    if (u.pathname === '/rest/v1/profiles' && method === 'POST') {
      if (profiles.some(p => p.login_id === body.login_id)) return json(409, { message: 'duplicate' });
      profiles.push(body);
      return json(201, null);
    }
    if (u.pathname === '/rest/v1/records' && method === 'HEAD')
      return new Response(null, { status: 200, headers: { 'content-range': '0-0/7' } });
    return json(404, { message: 'not faked: ' + method + ' ' + u.pathname });
  };
  const addUser = (login, role) => {
    const id = 'u' + ++n;
    users.set(id, { email: login.toLowerCase() + '@ourcampus.app', password: 'x' });
    profiles.push({ user_id: id, login_id: login, role, person_id: 1, display_name: login });
    tokens.set('tok-' + login, id);
    return 'tok-' + login;
  };
  return { fetchImpl, users, profiles, addUser };
}

const silent = { info() {}, error() {} };
let fake, server, base, adminTok, studentTok;
const req = (p, { method = 'GET', token, body, headers = {} } = {}) =>
  fetch(base + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

before(async () => {
  fake = fakeSupabase();
  adminTok = fake.addUser('ADMIN', 'Admin');
  studentTok = fake.addUser('ST-1001', 'Student');
  const staticDir = mkdtempSync(path.join(tmpdir(), 'oc-'));
  writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>OURCAMPUS</title>');
  const cfg = {
    port: 0,
    supabaseUrl: 'https://fake.supabase.co',
    serviceKey: 'service',
    allowedOrigins: ['https://app.example'],
    staticDir,
    loginDomain: 'ourcampus.app',
    rateLimit: { windowMs: 60000, max: 40 },
    ready: true,
  };
  server = createApp(cfg, { fetchImpl: fake.fetchImpl, log: silent });
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

describe('health & static', () => {
  test('health endpoint', async () => {
    const r = await req('/api/health');
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ok, true);
  });
  test('serves the SPA with security headers and CSP', async () => {
    const r = await req('/attendance/anything');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /OURCAMPUS/);
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  });
  test('blocks path traversal', async () => {
    const r = await req('/..%2f..%2fetc%2fpasswd');
    assert.ok([200, 400].includes(r.status));
    assert.doesNotMatch(await r.text(), /root:/);
  });
  test('unknown API route is 404', async () =>
    assert.equal((await req('/api/nope', { token: adminTok })).status, 404));
});

describe('authentication & authorization', () => {
  test('rejects requests without a token', async () => {
    const r = await req('/api/accounts', { method: 'POST', body: {} });
    assert.equal(r.status, 401);
  });
  test('rejects invalid tokens', async () =>
    assert.equal((await req('/api/stats', { token: 'forged' })).status, 401));
  test('students cannot manage accounts', async () => {
    const r = await req('/api/accounts', {
      method: 'POST',
      token: studentTok,
      body: { login: 'ST-9', password: 'password1', role: 'Student', personId: 9, name: 'X' },
    });
    assert.equal(r.status, 403);
  });
  test('stats are for leadership only', async () => {
    assert.equal((await req('/api/stats', { token: studentTok })).status, 403);
    const r = await req('/api/stats', { token: adminTok });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).students, 7);
  });
});

describe('account administration', () => {
  test('validates input', async () => {
    const bad = [
      { login: 'x', password: 'password1', role: 'Student', personId: 5, name: 'A' },
      { login: 'ST-1050', password: 'short', role: 'Student', personId: 5, name: 'A' },
      { login: 'ST-1050', password: 'password1', role: 'Admin', personId: 5, name: 'A' },
      { login: 'ST-1050', password: 'password1', role: 'Student', personId: -1, name: 'A' },
    ];
    for (const b of bad)
      assert.equal(
        (await req('/api/accounts', { method: 'POST', token: adminTok, body: b })).status,
        400,
        JSON.stringify(b),
      );
    assert.equal(
      (await req('/api/accounts', { method: 'POST', token: adminTok, body: 'not json' })).status,
      400,
    );
  });
  test('creates, resets and deletes an account', async () => {
    const body = {
      login: 'st-1050',
      password: 'Password-123',
      role: 'Student',
      personId: 50,
      name: 'New Student',
    };
    const c = await req('/api/accounts', { method: 'POST', token: adminTok, body });
    assert.equal(c.status, 201);
    assert.equal((await c.json()).login, 'ST-1050');
    assert.ok(
      fake.profiles.some(p => p.login_id === 'ST-1050' && p.role === 'Student' && p.person_id === 50),
    );
    assert.equal((await req('/api/accounts', { method: 'POST', token: adminTok, body })).status, 409);
    const p = await req('/api/accounts/ST-1050/password', {
      method: 'POST',
      token: adminTok,
      body: { password: 'Another-456' },
    });
    assert.equal(p.status, 200);
    assert.ok(
      [...fake.users.values()].some(u => u.email === 'st-1050@ourcampus.app' && u.password === 'Another-456'),
    );
    assert.equal((await req('/api/accounts/ST-1050', { method: 'DELETE', token: adminTok })).status, 200);
    assert.equal((await req('/api/accounts/ST-1050', { method: 'DELETE', token: adminTok })).status, 404);
  });
  test('admin cannot delete their own account', async () => {
    assert.equal((await req('/api/accounts/ADMIN', { method: 'DELETE', token: adminTok })).status, 400);
  });
  test('rejects oversized bodies', async () => {
    const r = await req('/api/accounts', {
      method: 'POST',
      token: adminTok,
      body: { name: 'x'.repeat(20000) },
    });
    assert.equal(r.status, 413);
  });
});

describe('CORS & rate limiting', () => {
  test('only allow-listed origins get CORS headers', async () => {
    const ok = await req('/api/health', { headers: { Origin: 'https://app.example' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://app.example');
    const bad = await req('/api/health', { headers: { Origin: 'https://evil.example' } });
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  });
  test('throttles bursts with 429', async () => {
    let last;
    for (let i = 0; i < 45; i++) last = await req('/api/stats', { token: adminTok });
    assert.equal(last.status, 429);
  });
});

describe('create-accounts script', () => {
  test('parses CSV and skips existing accounts', async () => {
    const rows = parseCsv(
      'Campus ID,Password,Role,Name,PersonId\nPRINCIPAL,Secret-1234,Principal,Principal,\nST-2001,Secret-5678,Student,A B,2001\n',
    );
    assert.equal(rows[1].personId, 2001);
    const cfg = { supabaseUrl: 'https://fake.supabase.co', serviceKey: 's', loginDomain: 'ourcampus.app' };
    const r1 = await createAccounts(rows, cfg, { fetchImpl: fake.fetchImpl, log: { log() {} } });
    assert.deepEqual(r1.created, ['PRINCIPAL', 'ST-2001']);
    const r2 = await createAccounts(rows, cfg, { fetchImpl: fake.fetchImpl, log: { log() {} } });
    assert.deepEqual(r2.skipped, ['PRINCIPAL', 'ST-2001']);
  });
  test('rejects unknown roles and weak passwords', () => {
    assert.throws(() => parseCsv('Campus ID,Password,Role,Name,PersonId\nX-1,Secret-1234,Hacker,A,\n'));
    assert.throws(() => parseCsv('Campus ID,Password,Role,Name,PersonId\nST-3,short,Student,A,3\n'));
  });
});

describe('vercel entry', () => {
  test('restores the original API path from the rewrite', async () => {
    process.env.SUPABASE_URL ||= 'https://fake.supabase.co';
    const { restoreUrl } = await import('../../api/index.js');
    assert.equal(restoreUrl('/api?__path=accounts/ST-1/password'), '/api/accounts/ST-1/password');
    assert.equal(restoreUrl('/api?__path=health&x=1'), '/api/health?x=1');
    assert.equal(restoreUrl('/api'), '/api/health');
    assert.equal(restoreUrl('/api/stats'), '/api/stats');
  });
});
