# Security

## Threat model
| Threat | Mitigation |
|---|---|
| Student approves own leave, edits marks or fees by calling Supabase directly | **Row Level Security** on every table; `can_write()` checks role, ownership, positions and allowed status values (e.g. students may only insert `Pending` leave). Tested in `tests/db`. |
| Reading other students' data | `records_read` policy: students see only rows where `student_id` = their own, plus public collections (staff list, forms, announcements, settings). Staff can't read fees. |
| Forged notifications to everyone | Students may only notify staff-side queues (`role:*`, `position:*`). |
| Lab double booking / race conditions | Unique partial indexes on `(date, seat)` and `(date, student_id)` for active passes. |
| Account takeover / mass sign-up | Public sign-up disabled. Accounts are created only by Admin via the API (service key stays on the server). Passwords are bcrypt-hashed by Supabase Auth, minimum 8 characters. |
| Leaked service key | Never prefixed `VITE_`, so it's never in the bundle. Used only in `server/`. `.env` and `private/` are git-ignored. |
| XSS | All user text goes through `esc()` before entering HTML (unit-tested). CSP restricts scripts to same origin and connections to Supabase. `X-Frame-Options: DENY`, `nosniff`. |
| Brute force / abuse of API | Per-IP rate limit (429), 16 KB body limit, strict input validation. |
| Privilege escalation via API | Every API call re-verifies the JWT with Supabase and reloads the role from `profiles`. The role is never taken from the request. |
| Admin deletes self | Blocked by the API. |

## Known trade-offs
- Templates use inline `onclick` handlers, so the CSP allows `'unsafe-inline'` scripts. All interpolated data is escaped. The next hardening step is moving to delegated `data-action` listeners and dropping `'unsafe-inline'`.
- The rate limiter is in-memory (per instance). Use a shared store when running several instances (see SCALABILITY.md).
- Medical requests ask for a short, general reason only, so no detailed health data is stored.

## Operational checklist
- [ ] Authentication → disable "Allow new users to sign up"
- [ ] Service-role key only in the server's environment
- [ ] Change the starting passwords after first sign-in
- [ ] Set `ALLOWED_ORIGINS` if the front end is on a different domain
- [ ] Enable Supabase Point-in-Time Recovery / daily backups for production
