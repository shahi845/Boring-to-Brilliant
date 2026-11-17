/**
 * Creates sign-in accounts from a CSV file using the Supabase Admin API.
 *   npm run accounts:create -- private/accounts.csv
 * CSV columns: Campus ID,Password,Role,Name,PersonId
 * Existing Campus IDs are skipped, so the script is safe to run again.
 */
import { readFileSync } from 'node:fs';
import { loadConfig } from '../config.js';
import { createSupabaseAdmin } from '../lib/supabase.js';
import { checkPassword, normaliseLogin } from '../lib/validate.js';

const ROLES = ['Student', 'Staff', 'Admin', 'Principal', 'Vice Principal'];

export function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = header.split(',').map(h => h.trim().toLowerCase());
  const idx = n => cols.indexOf(n);
  return lines.filter(Boolean).map(line => {
    const c = line.split(',').map(v => v.trim());
    const role = c[idx('role')];
    if (!ROLES.includes(role)) throw new Error(`Unknown role "${role}" in line: ${line}`);
    const pid = c[idx('personid')];
    return {
      login: normaliseLogin(c[idx('campus id')]),
      password: checkPassword(c[idx('password')]),
      role,
      name: c[idx('name')],
      personId: pid ? Number(pid) : null,
    };
  });
}

export async function createAccounts(rows, cfg, { fetchImpl = fetch, log = console } = {}) {
  const admin = createSupabaseAdmin({ ...cfg, fetchImpl });
  const result = { created: [], skipped: [] };
  for (const r of rows) {
    if (await admin.getProfileByLogin(r.login)) {
      result.skipped.push(r.login);
      continue;
    }
    const user = await admin.createUser(`${r.login.toLowerCase()}@${cfg.loginDomain}`, r.password, r.name);
    await admin.insertProfile({ user_id: user.id, login_id: r.login, role: r.role, person_id: r.personId, display_name: r.name });
    result.created.push(r.login);
    log.log(`✓ ${r.login} (${r.role}) ${r.name}`);
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const cfg = loadConfig();
  if (!file || !cfg.ready) {
    console.error('Usage: npm run accounts:create -- <file.csv>   (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env)');
    process.exit(1);
  }
  const res = await createAccounts(parseCsv(readFileSync(file, 'utf8')), cfg);
  console.log(`Done: ${res.created.length} created, ${res.skipped.length} already existed.`);
}
