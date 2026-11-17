/**
 * OURCAMPUS API server (Node.js, no third-party dependencies).
 *  - /api/health          liveness / readiness
 *  - /api/accounts…       account administration (Admin)
 *  - /api/stats           headline numbers (Admin, Principal, Vice Principal)
 *  - everything else      the built front end from dist/ (single-page app)
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { HttpError, SECURITY_HEADERS, send } from './lib/http.js';
import { createRateLimiter } from './lib/rateLimit.js';
import { createSupabaseAdmin } from './lib/supabase.js';
import { accountsRoute } from './routes/accounts.js';
import { statsRoute } from './routes/stats.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

/** Request handler shared by the standalone server (createApp) and the Vercel function (api/index.js). */
export function createHandler(cfg, { fetchImpl = fetch, log = console } = {}) {
  const admin = createSupabaseAdmin({ ...cfg, fetchImpl });
  const limiter = createRateLimiter(cfg.rateLimit);
  const audit = (action, ctx, target) =>
    log.info?.(JSON.stringify({ t: new Date().toISOString(), action, by: ctx.profile.login_id, target }));
  const csp = [
    "default-src 'self'",
    `connect-src 'self' ${cfg.supabaseUrl} ${cfg.supabaseUrl.replace('https://', 'wss://')}`,
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'", // inline handlers in templates — see docs/SECURITY.md
    "frame-ancestors 'none'",
  ].join('; ');

  function cors(req, res) {
    const origin = req.headers.origin;
    if (origin && cfg.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }
  }

  function serveStatic(req, res, pathname) {
    const root = path.resolve(cfg.staticDir);
    let file = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root)) return send(res, 400, { error: 'Bad path' });
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(root, 'index.html'); // SPA fallback
    if (!existsSync(file)) return send(res, 404, { error: 'Front end not built — run npm run build' });
    const ext = path.extname(file);
    const immutable = file.includes(`${path.sep}assets${path.sep}`);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      ...(ext === '.html' ? { 'Content-Security-Policy': csp } : {}),
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  }

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const started = Date.now();
    try {
      cors(req, res);
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
        return serveStatic(req, res, url.pathname);
      }
      if (req.method === 'OPTIONS') return send(res, 204, {});
      if (url.pathname === '/api/health')
        return send(res, 200, { ok: true, configured: cfg.ready, uptime: Math.round(process.uptime()) });

      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
      const rl = limiter(ip);
      res.setHeader('RateLimit-Remaining', String(rl.remaining));
      if (!rl.allowed) throw new HttpError(429, 'Too many requests — please wait a minute');
      if (!cfg.ready)
        throw new HttpError(503, 'Server is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');

      const [, , resource, ...parts] = url.pathname.split('/');
      const ctx = { admin, cfg, parts, audit };
      if (resource === 'accounts') return await accountsRoute(req, res, ctx);
      if (resource === 'stats' && req.method === 'GET' && !parts.length)
        return await statsRoute(req, res, ctx);
      throw new HttpError(404, 'Not found');
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status >= 500) log.error?.(e);
      if (!res.headersSent)
        send(res, status, {
          error: status >= 500 && !(e instanceof HttpError) ? 'Internal server error' : e.message,
        });
    } finally {
      if (url.pathname.startsWith('/api/'))
        log.info?.(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
    }
  };
}

export function createApp(cfg, opts) {
  return http.createServer(createHandler(cfg, opts));
}
