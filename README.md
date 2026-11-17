# OURCAMPUS — Boring to Brilliant

A role-based campus management web app: attendance, leave, official requests, fees, computer lab and library, in one calm, friendly interface.
Every person sees only what they need to act on (**task-first home screens**). The database itself enforces who can see and change what.

| Layer | Technology |
|---|---|
| Front end | Vite + vanilla JavaScript ES modules (no framework), CSS |
| API server | Node.js 20+ (`node:http`, zero runtime dependencies) |
| Database & auth | Supabase (PostgreSQL + Row Level Security + Supabase Auth) |
| Tests | `node:test` (unit + API), SQL (Row Level Security) |
| Deploy | Render / Docker (single service) or Netlify / Vercel (static) + any Node host |

**Deploying? Read [START-HERE.md](START-HERE.md) (GitHub + Vercel + Supabase).**

## Quick start

```bash
npm install
cp .env.example .env          # fill in your Supabase URL + keys
# 1. apply the database: Supabase → SQL Editor → paste supabase/migrations/*.sql → Run
#    (or: supabase link && supabase db push)
# 2. create sign-in accounts
npm run accounts:create -- private/accounts.csv
# 3. run
npm run server                # API on http://localhost:8787
npm run dev                   # website on http://localhost:5173 (proxies /api to the server)
```

Sign in as **ADMIN** first. The first Admin sign-in creates the starting campus data.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Front end dev server with hot reload |
| `npm run server` | API server (reads `.env`, restarts on change) |
| `npm run build` | Production build into `dist/` |
| `npm start` | Production: serves `dist/` and the API from one process |
| `npm test` | Unit + API tests |
| `npm run test:db` | Row Level Security tests on a local PostgreSQL |
| `npm run lint` / `format` | Prettier check / fix |
| `npm run accounts:create -- file.csv` | Create sign-in accounts in bulk |

## Project structure

```
├── index.html                 App shell (sign-in screen, layout)
├── public/                    Static assets (favicon)
├── src/
│   ├── main.js                Entry: loads feature modules, starts auth
│   ├── state.js               Shared app state
│   ├── app/                   Router, navigation structure, page registries
│   ├── lib/                   Supabase sync (store), auth, accounts API client,
│   │                          permissions, notifications, utilities, config
│   ├── ui/                    Components, forms + validation, modals/toasts, search, theme
│   ├── pages/                 Features: home, attendance, leave, medical, forms, requests,
│   │                          verification, my-students, library, lab, fees, admin, system
│   ├── data/seed.js           Starting campus data (created on first Admin sign-in)
│   └── styles/                Design tokens, components, light/dark themes
├── api/index.js               Vercel serverless entry (wraps the same API handler)
├── vercel.json                Vercel build, API rewrite, security headers
├── server/
│   ├── index.js / app.js      HTTP server, routing, static hosting, CSP
│   ├── routes/                /api/accounts, /api/stats
│   ├── lib/                   Auth (JWT check), rate limiting, validation, Supabase admin client
│   └── scripts/               create-accounts.mjs
├── supabase/
│   ├── migrations/            Schema, Row Level Security policies, SQL functions
│   └── config.toml            Supabase CLI config (sign-up disabled)
├── tests/
│   ├── unit/                  Domain logic, permissions, seed integrity
│   ├── api/                   API server (auth, roles, validation, CORS, rate limit)
│   └── db/                    Row Level Security tests (31 checks)
├── docs/                      Ideation, architecture, API, security, deployment, scalability, testing
├── Dockerfile · render.yaml   Deployment
└── .github/workflows/ci.yml   Lint + test + build on every push
```

## Roles

| Role | Highlights |
|---|---|
| Student | Today's status, leave application with live tracking, medical, official requests, fees & receipts, lab pass |
| Staff (Usthad) | Mark attendance, outside-campus log, class roster, marks, follow-ups. **Positions** add: Librarian, Lab Charge, Academic Assistant |
| Academic Assistant | Leave clearance, attendance verification, medical checks, corrections, follow-ups |
| Principal / Vice Principal | Leave decisions, fee authorization, announcements |
| Admin | Students, staff & positions, admissions, fees, requests, lab, reports, settings, accounts |

Docs: [Ideation](docs/IDEATION.md) · [Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Security](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md) · [Scalability](docs/SCALABILITY.md) · [Testing](docs/TESTING.md)
