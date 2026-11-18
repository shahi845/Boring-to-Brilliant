/** Server configuration from environment variables (never commit real values). */
export function loadConfig(env = process.env) {
  const cfg = {
    port: Number(env.PORT || 8787),
    supabaseUrl: (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    allowedOrigins: (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    staticDir: env.STATIC_DIR || new URL('../dist/', import.meta.url).pathname,
    loginDomain: env.LOGIN_EMAIL_DOMAIN || 'ourcampus.app',
    rateLimit: { windowMs: 60_000, max: Number(env.RATE_LIMIT_PER_MIN || 60) },
    // Razorpay (online fee payments). Test keys start with rzp_test_, live keys with rzp_live_.
    razorpayKeyId: (env.RAZORPAY_KEY_ID || '').trim(),
    razorpayKeySecret: (env.RAZORPAY_KEY_SECRET || '').trim(),
  };
  cfg.ready = Boolean(cfg.supabaseUrl && cfg.serviceKey);
  return cfg;
}
