# OrbitCare — Orbitspace

**OrbitCare (working build name: Orbitspace) — an offline-first astronaut health dashboard for a 180-day simulated mission.**

When Earth is 20 minutes away by radio and there is no hospital, astronauts need software that spots health changes early — against their own baseline — and tells them what to do next, even offline.

Built by **Team Alpha** for the **NASA Space Apps Challenge 2026, Harohalli Local Event** — challenge: *Create Health Monitoring Software for Astronauts on Space Missions* (Intermediate).

> **Simulated data only. Decision support only. Not a medical device.**

## Screenshots

Screenshots are not in the repo yet. Add them under `docs/screenshots/` and they will show here:

![Crew View — worst-first](docs/screenshots/crew-view.png)
![Astronaut Dashboard — vitals vs baseline](docs/screenshots/astronaut-dashboard.png)
![Trends — 30-day drift vs normal band](docs/screenshots/trends.png)
![Action Plan + crew report](docs/screenshots/action-plan.png)

## Key features

What is in this repo, as delivered (see `PRD.md` for the full spec):

- **Crew View, worst-first** — all 3 crew on one screen, sorted by worst status (Alert → Watch → Nominal). One tap opens that astronaut.
- **Astronaut Dashboard** — current vitals shown against that person's own Days 1–21 baseline, 4 domain scores (Heart, Bone & Muscle, Sleep & Mind, Immune / Radiation), and active flags.
- **Personal-baseline anomaly detection** — direction-aware z-scores (lower sleep = worse, higher BP = worse), 3-day smoothed domain scores, Watch ≥ 1, Alert ≥ 2.
- **Plain-language flags + action plans** — every flag says what was seen, why it matters, what to do now, and when to contact the flight surgeon. No unexplained alerts.
- **Trends** — 180-day SVG trend charts (heart rate, HRV, sleep, bone) with the person's normal band, plus a mission-day slider with Play to replay the mission.
- **Daily self-check** — log sleep, mood, stress and symptoms in under a minute. Saved on the device (`localStorage`) and shown in the report.
- **Crew report download** — in the delivered frontend this is a plain-text report (`.txt`), not the PDF in the PRD. The 4-page PDF is the target in `PRD.md` / `ARCHITECTURE.md` (`@react-pdf/renderer`), not yet built in this folder.
- **Offline-first frontend** — the 5 HTML pages work with no backend and no connection. The backend is optional (see below).
- **Optional Supabase backend** — the same simulated mission in Postgres, with 7 HTTP endpoints (see "Backend API" below). The frontend pages currently run their own in-browser copy and are not yet wired to this backend.

**Not in this repo (PRD V2 / Later — do not expect them here):** the one-tap Emergency Guide, radiation shelter alert, health forecast, medicine stock countdown, exercise prescription, real wearables, diagnosis, doctor chat, mobile app, or auth. The Emergency Guide exists in the separate Orbitspace artifact, not in these code files.

## Demo story — Day 63

1. Open `index.html`, set the slider to **Day 63**. Kenji flags Priority #1 in **Watch** (resting heart rate elevated, HRV low).
2. Open his **Astronaut** page for vitals vs baseline, then **Trends** for the drift.
3. Open **Action Plan** for the day's plan and the crew report download.
4. Jump to **Day 90** — Kenji has recovered to Nominal. Amara dips during the Day 118–131 schedule shift; Elena's bone density declines slowly all mission.

## Tech stack

### As delivered in this repo

| Layer | Choice |
|---|---|
| Frontend | Plain HTML, CSS, JavaScript — no build step, no framework. SVG charts drawn in `js/app.js`. |
| Styling | `css/style.css` — deep blue + black theme from `DESIGN.md` (background `#020612`, surface `#081630`, primary `#2E7FFF`). Inter / system fonts. |
| Data + scoring | `js/data.js` — simulated 180-day data (3 crew × 180 days = 540 readings), baselines, direction-aware z-scores, domain scores, flags. |
| Backend (optional) | Node.js, no web framework — `backend/server.js` using the built-in HTTP module, plus `@supabase/supabase-js` `^2.45.0` (the only dependency in `backend/package.json`). |
| Database (optional) | Supabase (Postgres, free tier). Schema in `backend/supabase/schema.sql`: `crew`, `baselines`, `daily_readings`, `self_checks`. |
| Hosting | Static site (GitHub Pages or Vercel, Framework Preset: Other, no build command). Backend deploys separately — see the existing deploy notes in "Backend (optional)" below. |

### Target stack (in `ARCHITECTURE.md` — planned, not yet built in this folder)

Next.js 14 (App Router) + React 18 + TypeScript, Tailwind CSS, Recharts, `@react-pdf/renderer`, Supabase, Vercel. Do not mix the two stacks: pick one (ARCHITECTURE.md §1.1), lock it, and do not rebuild mid-hackathon just to switch.

## Quick start — 5 steps or fewer

**Frontend only (no keys, no install):**

```bash
# 1. Open this folder
cd orbitspace-code

# 2. Serve it (the self-check uses localStorage, so serve it — do not just double-click index.html)
python3 -m http.server 8000

# 3. Open http://localhost:8000/ and set the slider to Day 63 — Kenji should be worst-first, Watch
```

**Backend (optional — Supabase):**

```bash
# 4. In Supabase: create a free project, run backend/supabase/schema.sql in the SQL Editor,
#    then copy the Project URL + anon key + service-role key into backend/.env
cd backend
cp .env.example .env   # fill in the real values — never commit .env
npm install
npm run seed           # inserts 3 crew, 3 baselines, 540 daily readings
npm start              # API on http://localhost:3000
npm test               # M3 + M4 tests — 48 tests, Node built-in runner, all passing

# 5. Check it: curl http://localhost:3000/api/crew-status?day=63
```

You can also seed over HTTP once the server is running: `curl -X POST http://localhost:3000/api/seed`. Re-running seed is safe — it upserts crew/baselines and replaces the 540 readings. Without keys, the API returns a 503 with setup instructions instead of silently falling back to local data.

## Environment variables

### Actually used by the delivered backend (`backend/.env.example`)

| Name | Purpose | Example value |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | `https://your-project-ref.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon (public) key — reads only | `your-anon-public-key-here` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key — server only, for seed + self-check writes. **Never expose in the browser or commit it.** | `your-service-role-key-here` |
| `PORT` | Backend port | `3000` |

All example values above are the placeholders from `backend/.env.example` — they are not real keys. Get the real values from Supabase: Dashboard → Project Settings → API. `.env` is git-ignored (see `.gitignore`).

### Planned for the Next.js version (`ARCHITECTURE.md` §7 — not used by the delivered backend)

| Name | Purpose | Example value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, visible to the browser | `https://your-project-ref.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key, visible to the browser | `your-anon-public-key-here` |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL (share links / PDF footer) | `https://your-app.vercel.app` |

Do not set the `NEXT_PUBLIC_*` variables for the delivered plain-HTML backend — it reads `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` instead.

## Folder structure overview

This is the actual structure in this repo — not the Next.js target tree in `ARCHITECTURE.md` §2 (that tree is the plan for the Next.js version).

```
orbitspace-code/
├── README.md                 # this file
├── PRD.md                    # source of truth — what to build, what to cut, what to demo
├── DESIGN.md                 # source of truth — colours, fonts, components, accessibility
├── ARCHITECTURE.md           # source of truth — target stack, data flow, state, errors
├── DATABASE.md               # source of truth — full Postgres design (13 tables, ER diagram, RLS)
├── API.md                    # source of truth — /api/v1 contract (34 endpoints, error format)
├── AGENTS.md                 # rulebook for AI coding assistants working in this repo
├── index.html                # Overview — Crew View, worst-first
├── astronaut.html            # Per-astronaut vitals vs baseline, domain scores, flags
├── trends.html               # 180-day SVG trend charts (HR, HRV, sleep, bone)
├── plan.html                 # Flags, rule-based action plan, self-check, crew report
├── how.html                  # How it works + the Day-63 demo story
├── css/
│   └── style.css             # Deep blue + black theme
├── js/
│   ├── data.js               # Simulated 180-day data + baselines + scoring
│   └── app.js                # Shared logic: slider/Play, crew switching, charts, flags, plans, self-check, report
└── backend/                  # Optional Node API backed by Supabase (Postgres)
    ├── package.json          # Only dependency: @supabase/supabase-js ^2.45.0
    ├── server.js             # API (see "Backend API" below)
    ├── seed.js               # Seed: 3 crew, 3 baselines, 540 daily readings
    ├── lib/
    │   ├── simulation.js     # Same scoring as the frontend
    │   └── supabase.js       # Supabase client setup
    ├── supabase/
    │   └── schema.sql        # Tables: crew, baselines, daily_readings, self_checks
    └── .env.example          # Placeholder keys only — copy to .env, never commit real keys
```

## Backend API

The delivered backend uses **unversioned** `/api/` paths (not the `/api/v1/` paths in `API.md` — those are the target contract for the Next.js version).

| Method + URL | Purpose |
|---|---|
| `GET /api/health` | Supabase connection + reading count |
| `POST /api/seed` | Generate and store 3 crew / 3 baselines / 540 readings |
| `GET /api/crew-status?day=63` | Crew sorted worst-first |
| `GET /api/astronaut/kenji?day=63` | One astronaut, one day |
| `GET /api/trends/kenji` | 180-day readings for one astronaut |
| `GET /api/report?day=63` | Plain-text crew report |
| `POST /api/self-check` | Save a self-check — body `{ astronautId, day, energy, mood, stress }` (saved in Supabase `self_checks`, feeds the Sleep & Mind score). Note: this field shape differs from the `POST /api/v1/crew-members/{slug}/self-checks` shape in `API.md` — follow `API.md` for the Next.js version, and this table for the delivered backend. |

## Available scripts

There is **no root `package.json` and no `dev`, `build`, or `lint` script in this repo**. Do not invent them — if they are needed for the Next.js version, add them (and a root `package.json`) first, then update this section.

The only scripts that exist are in `backend/package.json`:

| Script | Command | What it does |
|---|---|---|
| `seed` | `npm run seed` (in `backend/`) | `node seed.js` — inserts 3 crew, 3 baselines, 540 daily readings into Supabase |
| `start` | `npm start` (in `backend/`) | `node server.js` — starts the API on `http://localhost:3000` (or `$PORT`) |
| `test` | `npm test` (in `backend/`) | `node --test` — M3 + M4 tests in `backend/tests/` (48 tests, all passing 15 Nov 2026) |

The frontend has no build step and no script: `python3 -m http.server 8000` (or any static server) is the run command.

## How to contribute

1. Read the source-of-truth files first, in priority order: `PRD.md` → `DESIGN.md` → `ARCHITECTURE.md` → `DATABASE.md` → `API.md`. Read `AGENTS.md` — it is the rulebook for anyone (human or AI) working in this repo.
2. Plan first, then code, then explain what changed in a short summary with how to check it (AGENTS.md workflow).
3. Work on a branch named `feat/<short-name>` (e.g. `feat/crew-view`), one feature per branch. Do not push directly to `main`.
4. Follow the DO / DO NOT rules in `AGENTS.md`: follow the folder structure, reuse existing components, write small focused functions, handle errors and loading states, do not change the tech stack, do not add a library without asking, do not change the database schema without updating `DATABASE.md` first, do not delete or rewrite working code unless asked, do not hard-code secrets.
5. If a request conflicts with any source-of-truth file, stop and ask the user before proceeding — do not work around it quietly.
6. There is no CI file (`.github/workflows/ci.yml`) in this repo yet — the CI step in `ARCHITECTURE.md` (typecheck + lint + build + test on every push) is planned for the Next.js version, not present here. Until then, check manually: Day 63 shows Kenji worst-first in Watch, Day 90 shows him Nominal, and the app still works with wifi off.

## AI disclosure

AI tools were used to help write boilerplate and organise this codebase during the hackathon. All challenge-specific logic, data simulation, and demo data were written and checked by the team during the hackathon. The full AI-use disclosure for the submission (every AI tool used, and what it helped with) belongs in the Project Tab submission — keep this section in sync with it.

## License

**No license file is included in this repo yet.** Add a `LICENSE` file before publishing or sharing the repo publicly — do not assume a license. Until one is added, the code is not licensed for reuse by others.

## Disclaimer

All data is simulated. Decision support only — **not a medical device**. Scores are risk signals, not clinical findings. Never present them as a diagnosis.
