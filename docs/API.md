# API

Base URL: same origin as the website (`/api`), or `VITE_API_URL`.
Auth: `Authorization: Bearer <Supabase access token>` (the signed-in user's session token).
Errors: `{ "error": "message" }` with status 400 / 401 / 403 / 404 / 409 / 413 / 429 / 503.

| Method | Path | Role | Body | Success |
|---|---|---|---|---|
| GET | `/api/health` | public | — | `200 {ok, configured, uptime}` |
| POST | `/api/accounts` | Admin | `{login, password, role: "Student"\|"Staff", personId, name}` | `201 {login}` |
| POST | `/api/accounts/:login/password` | Admin | `{password}` | `200 {login}` |
| DELETE | `/api/accounts/:login` | Admin | — | `200 {login}` |
| GET | `/api/stats` | Admin, Principal, Vice Principal | — | `200 {students, staff, pendingLeave, openRequests, at}` |

Validation: Campus ID `^[A-Z][A-Z0-9-]{2,23}$`, password 8–72 characters, body ≤ 16 KB, JSON object only.
Rate limit: 60 requests / minute / IP (configurable via `RATE_LIMIT_PER_MIN`). A `RateLimit-Remaining` header is returned.

## Data API (Supabase, from the browser)
The front end talks to Supabase directly with the user's JWT. Row Level Security decides what each call may read or write.

| Call | Used for |
|---|---|
| `from('records').select()` | load everything the user may see |
| `from('records').insert/update/delete` | save changes (diffed) |
| `from('notifications').insert` | notify reviewers |
| `rpc('mark_read', {ids})` / `rpc('mark_handled', {ids})` | notification state |
| `rpc('lab_seats', {d})` | seat occupancy without names |
