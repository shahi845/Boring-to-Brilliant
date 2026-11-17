# Deployment

## 1. Supabase
1. Create a project (region close to users, e.g. Mumbai).
2. Apply `supabase/migrations/20261117000000_init.sql`: SQL Editor → paste → Run, or `supabase link --project-ref <ref> && supabase db push`.
3. Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
4. Project Settings → API: copy the URL, the anon (publishable) key and the service-role key into `.env`.
5. `npm run accounts:create -- private/accounts.csv`

## 2. Vercel (front end + API functions)
Import the GitHub repo. `vercel.json` sets Vite, `dist/` output and rewrites `/api/*` to the serverless function `api/index.js`. Add the four env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) and redeploy. Step-by-step: see `START-HERE.md`.

## 2a. One service: Render
`render.yaml` is included. New → Blueprint → select the repo → fill in the four secret env vars.
Build: `npm ci && npm run build` · Start: `npm start` · Health check: `/api/health`.
The Node server serves the built site and the API on the same origin (no CORS needed).

## 2b. Docker (any VPS / Cloud Run / Fly.io)
```bash
docker build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... -t ourcampus .
docker run -p 8787:8787 -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... ourcampus
```

## 2c. Split: static front end + API elsewhere
- Front end on Netlify/Vercel: build `npm run build`, publish `dist/`, set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_API_URL=https://your-api`.
- API on Render/Railway: `npm start`, with `ALLOWED_ORIGINS=https://your-site`.

## CI
`.github/workflows/ci.yml` runs lint, unit + API tests and a production build on every push and pull request.

## First run
Sign in as `ADMIN`. The starting campus data is created automatically. Rename the institution and classes in Settings, then replace the sample students and staff with real ones (accounts are created as you add them).
