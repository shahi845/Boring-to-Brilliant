# Scalability

**Target:** a college of a few thousand students on the Supabase free/pro tier, growing to multiple campuses.

| Area | Now | When it grows |
|---|---|---|
| Reads | Each user loads only rows RLS allows (a student: hundreds of rows). Paged in 1,000-row pages. | Load per page or section (e.g. attendance by month); add `created_at` indexes; archive past academic years into `records_archive`. |
| Writes | Diffed: only changed rows are sent. | Batch attendance submissions through an RPC for one round trip per class. |
| Staff / admin views | Load all rows for their scope. | Server-side aggregation (`/api/stats` pattern) and paginated queries instead of full loads. |
| Real-time | 60-second refresh + refresh on focus. | Supabase Realtime subscriptions on `notifications` and `records` filtered by collection. |
| API server | Stateless except the in-memory rate limiter. Single process. | Run N instances behind a load balancer; move rate limits to Redis/Upstash; keep JWT checks (already stateless). |
| Static assets | Hashed files with `immutable` cache headers. | CDN (Netlify / Cloudflare) in front. |
| Database | Indexed `(collection,key)`, `collection`, `student_id`, GIN on `audience`. Unique partial indexes for invariants. | Supabase read replicas, connection pooling (Supavisor), partition `records` by collection or academic year. |
| Multi-campus | Single institution. | Add `campus_id` to `records`/`profiles` and to every policy. |
