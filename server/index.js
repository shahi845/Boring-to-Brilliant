import { createApp } from './app.js';
import { loadConfig } from './config.js';

const cfg = loadConfig();
if (!cfg.ready)
  console.warn('⚠  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — /api/accounts will return 503');
const server = createApp(cfg);
server.listen(cfg.port, () => console.log(`OURCAMPUS server on http://localhost:${cfg.port}`));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
