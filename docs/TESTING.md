# Testing

| Suite | Command | Covers |
|---|---|---|
| Unit | `npm test` | Date/time helpers, HTML escaping (XSS), id generation, seed integrity, role & position permissions, navigation per role, fee overdue rules, leave coverage |
| API | `npm test` | Health, SPA static hosting + security headers + CSP, path traversal, missing/forged tokens (401), role checks (403), validation (400), body limit (413), create → duplicate (409) → reset → delete, self-delete blocked, CORS allow-list, rate limiting (429), bulk account script |
| Database (RLS) | `npm run test:db` | 31 checks: student isolation, status rules, cross-student writes, lab double booking, notification audience, position-based staff powers, principal/admin limits, signed-out access |
| End-to-end (manual / scripted) | browser | Sign in per role → apply leave → Principal approves from notification → Academic Assistant clears → student sees status; lab request → Lab Charge approves; attendance submit; password change; Admin creates an account and the new user signs in |

`npm run test:db` needs a local PostgreSQL 15+ (`PGHOST`, `PGPORT`, `PGUSER` env vars). It loads a minimal Supabase stand-in (`tests/db/supabase_stub.sql`) and the real migration.

CI runs lint, unit + API tests and a production build on every push.
