/**
 * Vercel serverless entry for the API.
 * vercel.json rewrites /api/<path> → /api?__path=<path>; we restore the original URL
 * and hand the request to the same handler the standalone Node server uses.
 */
import { createHandler } from '../server/app.js';
import { loadConfig } from '../server/config.js';

const handle = createHandler(loadConfig());

export function restoreUrl(url) {
  const u = new URL(url, 'http://localhost');
  const p = u.searchParams.get('__path');
  if (p === null) return u.pathname === '/api' ? '/api/health' : url;
  u.searchParams.delete('__path');
  const qs = u.searchParams.toString();
  return '/api/' + p.replace(/^\/+/, '') + (qs ? '?' + qs : '');
}

export default function handler(req, res) {
  req.url = restoreUrl(req.url);
  return handle(req, res);
}
