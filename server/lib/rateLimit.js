/**
 * Fixed-window rate limiter keyed by client IP (in memory).
 * For several server instances, move the counters to a shared store (e.g. Redis) — see docs/SCALABILITY.md.
 */
export function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs);
  timer.unref?.();
  return function check(key) {
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    return { allowed: entry.count <= max, remaining: Math.max(0, max - entry.count), reset: entry.reset };
  };
}
