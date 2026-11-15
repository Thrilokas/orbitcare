# OrbitCare — SETUP.md

**How to run this project locally, from zero, in about 15 minutes.**

Read this file before running anything. Every command below was tested
against the real files in `orbitspace-code/` on 15 Nov 2026.

## 0. Which project this is — read first, it saves an hour

This SETUP is for the **delivered code folder** (`orbitspace-code/`):

- **Frontend:** plain HTML / CSS / JS — `index.html`, `astronaut.html`,
  `trends.html`, `plan.html`, `how.html`, `css/style.css`, `js/data.js`,
  `js/app.js`. No build step. No framework.
- **Backend:** plain Node.js — `backend/server.js`, `backend/seed.js`,
  `backend/lib/`. One dependency only:
  `@supabase/supabase-js` `^2.45.0` (see `backend/package.json`).
- **Database:** Supabase (hosted Postgres, free tier). No local Postgres,
  no Docker, no migration runner.

`ARCHITECTURE.md` describes a **Next.js 14 target stack**. That is the
target, not what is in this folder. Do **not** run any of these in this
folder — none of them exist here:

- `npm run dev` — does not exist
- `npm run build` — does not exist
- `npm run lint` / `npm run typecheck` — do not exist
- `npm test` — exists, but it is the Node built-in runner for
  `backend/tests/` (M3 scoring tests), not Vitest and not the
  Next.js test commands in ARCHITECTURE.md
- `npx next dev` — there is no Next.js app here, no root `package.json`,
  no `next.config.mjs`, no `tsconfig.json`

The only npm scripts that exist are in `backend/package.json`:

```json
"scripts": {
  "seed": "node seed.js",
  "start": "node server.js",
  "test": "node --test"
}
```

There are two servers to run, in two terminals (see §5):

| Server | Command | URL |
|---|---|---|
| Backend API (Node + Supabase) | `cd backend && npm start` | http://localhost:3000 |
| Frontend (static files) | `python3 -m http.server 8000` in the repo root | http://localhost:8000 |

The frontend pages run their own in-browser copy of the simulated data
(`js/data.js`). They are **not** wired to the Supabase backend yet — so
opening the frontend does not prove the backend works. Check the backend
separately with `curl` (see §6). That is expected, not a bug.

All data is simulated. Decision support only. Not a medical device.

---

## 1. Prerequisites — with versions

Install these first. Versions in the "Tested" column are what was actually
used on 15 Nov 2026; the "Minimum" column is the lowest that will work.

| Tool | Minimum | Tested 15 Nov 2026 | What it is for |
|---|---|---|---|
| **Node.js** | 18 LTS or newer | **v24.22.1** | Backend API + seed script |
| **npm** | ships with Node 18+ | **10.9.4** | Installs the one backend dependency |
| **Python** | 3.8 or newer | **3.12.3** | Serves the static frontend files only |
| **Git** | any recent version | **2.43.0** | Cloning the repo (optional, see §2) |
| **Supabase account** | free account | free tier, project created 15 Nov 2026 | Hosted Postgres database + API keys |
| **A browser** | any modern browser | Chrome (tested) | Opening the frontend + Supabase dashboard |
| **A terminal** | — | bash (Linux) | Every command below runs in a terminal |

**You do NOT need:** local Postgres, Docker, Prisma, TypeScript,
Next.js, Vercel CLI, or a Python web framework. Python is only a static
file server here — it never talks to the database.

Check what you already have before installing anything:

```bash
node -v
npm -v
python3 --version
git --version
```

Expected output on the machine this was tested on:

```
v24.22.1
10.9.4
Python 3.12.3
git version 2.43.0
```

On **Windows**, `python3` may not exist — use `python` instead (see §5.2).
On **Linux / Mac**, `python` may not exist — use `python3` instead.
That is the only Python difference that matters. See error #5 in §7.

### Install links (only if a check above fails)

- Node.js (includes npm): https://nodejs.org — pick the LTS version.
  Close and reopen your terminal after installing, then re-run `node -v`.
- Python: https://www.python.org/downloads — on Windows, tick
  **"Add Python to PATH"** during install, or `python` will not be found.
- Git: https://git-scm.com/downloads
- Supabase account: https://supabase.com — sign up, no card needed
  for the free tier.

---

## 2. Get the code

### Option A — from the zip (fastest for the hackathon)

1. Unzip `orbitspace-code.zip` anywhere, for example your Desktop.
2. Open a terminal in the unzipped folder. You should see this:

```bash
ls
```

```
AGENTS.md  API.md  ARCHITECTURE.md  DATABASE.md  DESIGN.md
PLAN.md  PRD.md  README.md  SETUP.md
astronaut.html  backend  css  how.html  index.html
js  plan.html  trends.html
```

If you see that list, you are in the right folder. The rest of this file
assumes your terminal is in that folder (the repo root).

### Option B — from Git

> There is no OrbitCare GitHub repo URL to paste here yet — the code has
> not been pushed to a repo for this project. Do not guess a URL.
> Once the team pushes it, use the real URL from GitHub:

```bash
git clone <your-repo-url>
cd orbitspace-code
```

After cloning, continue from §3 exactly as below. The folder layout is
the same either way.

### What is in the folder (so you know what you are running)

```
orbitspace-code/
├── index.html  astronaut.html  trends.html  plan.html  how.html
├── css/style.css
├── js/data.js  js/app.js        # simulated data + scoring/rendering
├── backend/
│   ├── package.json              # scripts: seed, start, test
│   ├── package-lock.json         # created by npm install
│   ├── server.js                 # the API (7 endpoints, see §5.3)
│   ├── seed.js                   # seed script (3 crew, 540 readings)
│   ├── .env.example              # placeholders ONLY — never real keys
│   ├── .env                      # YOU create this in §3 — never commit it
│   ├── lib/supabase.js           # reads .env, builds the Supabase client
│   ├── lib/simulation.js         # generates the 180-day simulated data
│   └── supabase/schema.sql       # the 4 tables + RLS policies
├── PRD.md  DESIGN.md  ARCHITECTURE.md  DATABASE.md  API.md
├── AGENTS.md  README.md  PLAN.md  SETUP.md   # docs — read, don't run
└── .gitignore                    # ignores node_modules/ and backend/.env
```

---

## 3. Install dependencies + create `.env`

Do these in order. Do not skip the `.env` step — the backend refuses
to start without it (see error #1 in §7).

### 3.1 Install the backend dependency

```bash
cd backend
npm install
```

What this does: reads `backend/package.json`, installs the one
dependency `@supabase/supabase-js` `^2.45.0`, creates `node_modules/`
and `package-lock.json`. Tested output:

```
added 9 packages in 2s
```

Same command on Windows, Mac and Linux. No flags needed.
Do **not** run `npm install` in the repo root — there is no
`package.json` there, and npm will error (see error #4 in §7).

Stay in the `backend/` folder for the next step.

### 3.2 Create `.env` from `.env.example`

```bash
cp .env.example .env
```

Windows (Command Prompt / PowerShell):

```cmd
copy .env.example .env
```

This copies the placeholder file. `.env` is already in `.gitignore`
(both the root `.gitignore` and `backend/.gitignore` list
`backend/.env`), so it will never be committed if you use Git.
**Never** rename `.env.example` itself, and never edit
`.env.example` to hold real keys — it ships in the repo.

### 3.3 Fill in `.env` — the 4 values that matter

Open `backend/.env` in a text editor. It looks like this (placeholders):

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
PORT=3000
```

Replace the three placeholder values with your own, from your Supabase
project. Get them at **supabase.com/dashboard** → open your project →
left sidebar **Settings (gear)** → **API**:

| `.env` variable | Supabase dashboard name | Where to copy it from |
|---|---|---|
| `SUPABASE_URL` | Project URL | Settings → API → Project URL, e.g. `https://abcdefgh.supabase.co` |
| `SUPABASE_ANON_KEY` | **Publishable key** | Settings → API → Publishable key (starts with `sb_publishable_…`). This is the old `anon` / public key under its new name. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret key** | Settings → API → Secret key (starts with `sb_secret_…`). This is the old `service_role` key under its new name. Server only. |
| `PORT` | — | Leave as `3000`. |

Rules for the file itself:

- No quotes around values. No spaces around `=`.
  Correct: `SUPABASE_URL=https://abcdefgh.supabase.co`
  Wrong: `SUPABASE_URL = "https://abcdefgh.supabase.co"`
- One variable per line, exactly the names above. The backend reads
  them with `backend/lib/supabase.js`, which looks for
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  in `backend/.env` (or `backend/.env.local`).
- **Never** put the Secret key in the browser, in any HTML/JS file,
  in a screenshot, or in GitHub. If the Secret key ever leaks, go to
  Supabase Settings → API → **Rotate** the keys and update `.env`.
- The Publishable key is public by design (it is protected by
  row-level security in the database), but still do not paste it into
  public places unnecessarily.
- Do **not** send the keys to anyone else to "put them in for you"
  unless you trust them with full write access to your database —
  the Secret key can read and write every table.

A finished `.env` (with fake values — yours will differ) looks like:

```
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxxxxxx
PORT=3000
```

---

## 4. Database setup, migrations and seed

There is **no local database to install and no migration runner**.
The database is the hosted Supabase Postgres project, and the
"migration" is one SQL file you run once in the Supabase dashboard.

### 4.1 Create the Supabase project (once — skip if it exists)

1. Go to https://supabase.com/dashboard and sign in.
2. Click **New organization** if asked (name it anything, e.g.
   `Team Alpha`, Type **Personal**, Plan **Free — $0/month**), then
   **Create organization**.
3. Click **New project**, fill in:
   - **Project name:** `orbitcare`
   - **Database password:** click **Generate a password** and save it
     somewhere safe — you will not see it again.
   - **Region:** leave on **Auto** (or pick the closest: Singapore /
     Mumbai for India).
   - Leave **Enable Data API** ticked. Leave **Enable automatic RLS**
     unticked — `schema.sql` turns RLS on itself.
4. Click **Create project** and wait 1–2 minutes until the project
   page shows **Status: Healthy**.

> Do **not** use `dashboard.supabase.com` — that address does not
> exist and gives `DNS_PROBE_FINISHED_NXDOMAIN`. The dashboard is at
> `supabase.com/dashboard`.

### 4.2 Run the schema — this is the migration

1. In Supabase, open the **SQL Editor** (left sidebar) → **New query**.
2. Open `backend/supabase/schema.sql` in the code folder, select all,
   copy it, and paste it into the SQL Editor.
3. Click **Run**.

Expected result:

```
Success. No rows returned
```

"No rows returned" is correct — this script creates tables, it does
not fetch data. It creates 4 tables, all in one run:

| Table | What it holds |
|---|---|
| `crew` | 3 astronauts (kenji, amara, elena) |
| `baselines` | Each astronaut's Days 1–21 baseline (mean + SD per vital) |
| `daily_readings` | 540 rows after seeding (3 crew × 180 days) |
| `self_checks` | Daily self-checks (energy / mood / stress, 1–5) |

It also turns on row-level security (RLS) on all 4 tables and creates
the policies: anyone can **read** the simulated data and **insert**
a self-check; only the Secret (service-role) key can write the other
tables. That is why the seed needs the Secret key (see §4.3).

Verify it worked: open **Table Editor** (left sidebar). You should
see all 4 tables listed: `baselines`, `crew`, `daily_readings`,
`self_checks`.

The script is safe to run twice — every `CREATE TABLE` uses
`IF NOT EXISTS` and every policy is dropped before it is recreated.
If you change the schema later, update `DATABASE.md` first, then
write a **new** migration file — never edit `schema.sql` after it
has already run on a shared project (see `AGENTS.md`).

### 4.3 Seed the data

In a terminal, in the `backend/` folder (you should still be there
from §3):

```bash
npm run seed
```

What it does: `seed.js` generates the simulated 180-day mission
(3 crew, Day-63 infection event for Kenji) and writes it to Supabase
with the Secret key — upserting crew + baselines and replacing
`daily_readings`. Safe to re-run: re-seeding never duplicates rows.

Expected output (verified live on 15 Nov 2026):

```
Seeded Supabase: 3 crew, 3 baselines, 540 daily readings.
```

> Note: the first seed run on 15 Nov 2026 failed once with
> `Seed failed: seed clear daily_readings: TypeError: fetch failed`
> — a transient network hiccup. Re-running the exact same command
> immediately succeeded. If you see `fetch failed`, just run
> `npm run seed` again before changing anything (see error #2 in §7).

You can also seed through the API instead (see §5.3), but
`npm run seed` is the way to do it the first time.

---

## 5. Start the dev servers + what URL to open

You need **two terminals** (or two tabs): one for the backend, one
for the frontend. Keep both running while you work.

### 5.1 Terminal 1 — backend API

```bash
cd backend
npm start
```

Expected output:

```
Orbitspace backend (Supabase) listening on http://localhost:3000
```

The backend is now at **http://localhost:3000**.
Leave this terminal running. Stop it with `Ctrl+C`.
To run it on a different port, set `PORT` in `backend/.env`
(e.g. `PORT=4000`) and restart — the log line will show the new port.

Backend endpoints (all from `backend/server.js` — these are the
**delivered** endpoints, not the `/api/v1/` target in `API.md`):

| Method + path | What it does |
|---|---|
| `GET /api/health` | Health check — `{"ok":true,"storage":"supabase","dailyReadings":540,"seeded":true}` |
| `POST /api/seed` | Seeds Supabase through the API (same data as `npm run seed`) |
| `GET /api/crew-status?day=63` | All 3 crew for a day, worst-first, with scores + flags + plan |
| `GET /api/astronaut/kenji?day=63` | One astronaut (`kenji` / `amara` / `elena`) |
| `GET /api/trends/kenji` | All 180 daily readings for one astronaut + baselines |
| `GET /api/report?day=63` | Plain-text crew report for a day |
| `POST /api/self-check` | Save a self-check (see §6.3) |

### 5.2 Terminal 2 — frontend (static files)

In a **new** terminal, in the **repo root** (`orbitspace-code/`,
not `backend/`):

Linux / Mac:

```bash
python3 -m http.server 8000
```

Windows (Command Prompt / PowerShell):

```cmd
python -m http.server 8000
```

Expected output:

```
Serving HTTP on :: port 8000 (http://[::]:8000/) ...
```

The frontend is now at **http://localhost:8000**.
Leave this terminal running. Stop it with `Ctrl+C`.

### 5.3 What URL to open

Open this in your browser:

```
http://localhost:8000/index.html
```

You should see the **Orbitspace — Overview** page: Crew View
worst-first, the mission-day slider (Day 1 of 180), and the
**Day 63** jump chip. Click **Day 63** — Kenji should be first,
in Watch (see §6 for the exact numbers to expect).

Other pages, all at the same address:

- `http://localhost:8000/astronaut.html` — Astronaut dashboard
- `http://localhost:8000/trends.html` — Trends
- `http://localhost:8000/plan.html` — Action Plan
- `http://localhost:8000/how.html` — How It Works

And check the backend in the browser or with `curl`:

```
http://localhost:3000/api/health
```

Expected (after seeding):

```json
{"ok":true,"storage":"supabase","dailyReadings":540,"seeded":true}
```

---

## 6. How to run tests

**There is now one automated test file in this folder:**
`backend/tests/scoring.test.js` (M3 scoring, 31 tests) and
`backend/tests/domains.test.js` (M4 domain scores, 17 tests), run with
`cd backend && npm test` (48 tests, all passing 15 Nov 2026). There is
still no Vitest, no E2E suite, and no test runner for the
frontend — those belong to the Next.js target (TESTING.md).

- `backend/package.json` has **no** `dev`, `build`, `lint`
  or `typecheck` script — only `seed`, `start`, and `test` (`node --test`,
  M3 + M4 scoring tests in `backend/tests/`, 48 tests, all passing 15 Nov 2026).
- The test files are `backend/tests/scoring.test.js` (M3, 31 tests)
  and `backend/tests/domains.test.js` (M4, 17 tests) — 48 tests total,
  all passing 15 Nov 2026. No other `*.test.js` files exist yet.
- `ARCHITECTURE.md` §2 lists `src/tests/scoring.test.ts`,
  `flags.test.ts`, `smoke.test.ts` — those belong to the **Next.js
  target** stack. They do not exist in the delivered folder.
  Do not invent them. `npm test` works in `backend/` (Node
  built-in runner) — it runs only the M3 scoring tests, not the
  Next.js target tests.

So "running the tests" here means `npm test` first, then the
manual smoke checks below. Run them in order after §4–§5. Every expected value below
was verified live against the real Supabase project on 15 Nov 2026.

### 6.1 Smoke check 1 — backend health

```bash
curl http://localhost:3000/api/health
```

Windows PowerShell (curl is `curl.exe` there):

```powershell
curl.exe http://localhost:3000/api/health
```

Expected:

```json
{"ok":true,"storage":"supabase","dailyReadings":540,"seeded":true}
```

- `ok:false` or `dailyReadings:0` → the seed did not run, or ran
  against a different project. Re-run §4.3.
- `503 {"error":"Supabase is not configured"}` → `.env` is missing
  or empty. See error #1 in §7.

### 6.2 Smoke check 2 — Day 63 (the demo day)

```bash
curl "http://localhost:3000/api/crew-status?day=63"
```

Expected, in order: **Kenji first, overall 79, level `watch`**,
with flags for HRV, resting heart rate and sleep.
Then Elena (90, nominal) and Amara (98, nominal).

```bash
curl "http://localhost:3000/api/crew-status?day=90"
```

Expected: **Kenji 95, level `nominal`** — recovered. (Elena is
first that day at 88, Watch, because of bone-density drift —
that is the data working as designed, not a failure.)

If the frontend disagrees with the API on Day 63, the API wins —
the frontend runs its own in-browser copy (`js/data.js`), so
check the API result first.

### 6.3 Smoke check 3 — self-check write + report

```bash
curl -X POST http://localhost:3000/api/self-check \
  -H "Content-Type: application/json" \
  -d '{"astronautId":"kenji","day":63,"energy":3,"mood":4,"stress":2}'
```

Expected: `{"ok":true,"storage":"supabase", …}` with the saved
row echoed back. Energy / mood / stress must each be 1–5;
anything outside is clamped to 1–5 by `server.js`.

```bash
curl "http://localhost:3000/api/report?day=63"
```

Expected: a plain-text crew report for Day 63 (crew at a glance,
scores, flags, action plan). In the delivered frontend the report
download is a **`.txt` file, not a PDF** — the PDF is the PRD
target, not what this folder does. Do not report it as a PDF bug.

### 6.4 Smoke check 4 — frontend pages load

```bash
curl -o /dev/null -w "%{http_code}\n" http://localhost:8000/index.html
curl -o /dev/null -w "%{http_code}\n" http://localhost:8000/astronaut.html
curl -o /dev/null -w "%{http_code}\n" http://localhost:8000/trends.html
curl -o /dev/null -w "%{http_code}\n" http://localhost:8000/plan.html
curl -o /dev/null -w "%{http_code}\n" http://localhost:8000/how.html
```

Expected: `200` for every line. (Verified 15 Nov 2026.)

Or just open each page in the browser and check the slider, the
Day-63 chip and the crew cards render — no console errors.

### 6.5 Smoke check 5 — tables in Supabase

In Supabase → **Table Editor**, confirm the 4 tables exist and
have rows after seeding:

| Table | Rows after seeding |
|---|---|
| `crew` | 3 |
| `baselines` | 3 |
| `daily_readings` | 540 |
| `self_checks` | 0 until someone submits one (§6.3) |

### Pass / fail summary

| Check | Pass looks like |
|---|---|
| Health | `ok:true`, `dailyReadings:540`, `seeded:true` |
| Day 63 | Kenji first, 79, Watch |
| Day 90 | Kenji 95, Nominal |
| Self-check POST | `ok:true`, row echoed back |
| Frontend pages | HTTP 200 on all 5 pages |
| Tables | 4 tables, counts above |

If all six pass, setup is done. If any fails, go to §7 — do not
start changing code first.

---

## 7. Common setup errors and their fixes

Ten errors, each with the exact message, the cause, and the fix.
All of them were either hit during testing on 15 Nov 2026 or
follow directly from the real files — none are invented.

### 1. `503 {"error":"Supabase is not configured"}`

**When:** `GET /api/health` (or any API call) with the backend running.
**Cause:** `backend/.env` does not exist, is empty, or the server was
started before `.env` was created. `backend/lib/supabase.js`
(`isConfigured()`) requires `SUPABASE_URL` plus at least one key.
**Fix:**

```bash
cd backend
ls -la .env
```

If there is no `.env`, create it (§3.2–§3.3) and **restart**
`npm start` — the server only reads `.env` at startup, so editing
the file while it runs changes nothing until you restart.

### 2. `Seed failed: … TypeError: fetch failed` / `GET /api/health` → `500 {"ok":false,"error":"TypeError: fetch failed"}`

**When:** `npm run seed`, or `/api/health` with placeholder keys.
**Cause:** the backend cannot reach Supabase at all — either the
URL / keys in `.env` are wrong (the classic case is copying the
placeholder `https://your-project-ref.supabase.co` from
`.env.example` without replacing it), or a one-off network hiccup.
This exact error was seen twice on 15 Nov 2026: once with
placeholder keys, and once transiently on a real project.
**Fix:**

1. Open `backend/.env` and check `SUPABASE_URL` is your real
   project URL — it must match Supabase Settings → API → Project
   URL exactly, no trailing slash, no spaces.
2. Re-run the seed. It is safe to re-run (§4.3). On 15 Nov 2026
   the transient case succeeded on the second run with no other
   change.

```bash
npm run seed
```

3. If it still fails, check the project is **Healthy** in the
   Supabase dashboard and that your internet connection works:
   `curl -I https://supabase.com` should return `200`.

### 3. Seed fails with a row-level security error

**Exact text looks like:** `seed crew: new row violates row-level
security policy for table "crew"` (or the same for `baselines` /
`daily_readings`).
**Cause:** the seed is running with the Publishable (anon) key
instead of the Secret (service-role) key. `schema.sql` only allows
anon to **read** those tables and to **insert** self-checks — it
cannot insert crew, baselines or readings.
**Fix:** in `backend/.env`, the **Secret** key goes in
`SUPABASE_SERVICE_ROLE_KEY`, and the **Publishable** key goes in
`SUPABASE_ANON_KEY`. Do not swap them. If you only have the
Publishable key, get the Secret key from Supabase Settings → API
(Secret key, starts with `sb_secret_…`) and restart the backend
/ re-run the seed.

```bash
npm run seed
```

### 4. `npm error Missing script: "dev"` / `"test"` / `"build"`

**When:** running `npm run dev`, `npm test`, `npm run build`,
`npm run lint` or `npm run typecheck` anywhere in this folder.
**Cause:** those scripts do not exist. `backend/package.json`
has only `seed`, `start`, and `test`. The Next.js scripts in
`ARCHITECTURE.md` belong to the target stack, not this folder.
**Fix:** use the real commands — `npm run seed` and `npm start`
in `backend/`, and the manual smoke checks in §6 instead of
`npm test`.

```bash
cd backend
npm run seed
npm start
```

### 5. `python: command not found` (Linux / Mac) or `python3` is not recognized (Windows)

**When:** starting the frontend server in §5.2.
**Cause:** the Python command name differs by OS. On Linux and
Mac the command is usually `python3` (plain `python` does not
exist — verified on the Linux VM used for testing, where
`python --version` fails and `python3 --version` prints
`Python 3.12.3`). On Windows it is usually `python`.
**Fix:** use the name that works on your machine:

Linux / Mac:

```bash
python3 -m http.server 8000
```

Windows:

```cmd
python -m http.server 8000
```

If neither works, Python is not installed — install it (§1) and
on Windows tick **"Add Python to PATH"**, then reopen the terminal.

### 6. `Error: listen EADDRINUSE: address already in use :::3000` (or `:::8000`)

**When:** `npm start` or `python3 -m http.server 8000`.
**Cause:** something is already using that port — usually a
previous backend/frontend server that was never stopped, or
another app.
**Fix:** stop the old server, or use a different port.

Find and stop it (Linux / Mac):

```bash
lsof -i :3000
kill <PID>
```

Or, quickest for this project — run the backend on another port
by changing `PORT` in `backend/.env` (e.g. `PORT=4000`),
restarting, and opening `http://localhost:4000/api/health`
instead. For the frontend, just pick another port:

```bash
python3 -m http.server 8001
```

Then open `http://localhost:8001/index.html`.

### 7. `npm install` fails, or `node: command not found`

**When:** §3.1.
**Cause:** Node.js is not installed, is too old, or the terminal
was opened before Node was installed (so it is not on `PATH` yet).
`@supabase/supabase-js` `^2.45.0` needs Node 18+.
**Fix:**

```bash
node -v
npm -v
```

- If `node: command not found`, install Node LTS from
  https://nodejs.org, close and reopen the terminal, and re-run
  `node -v`. You should see `v18` or newer (tested: `v24.22.1`).
- If `node -v` prints something below `v18`, upgrade Node —
  do not try to force the install on an old version.
- If `npm install` fails with a network error, check your
  connection and try again; `npm install` does not need any
  flags here.

### 8. `.env` is in the wrong place, or is named `.env.txt`

**When:** the backend still says "Supabase is not configured"
even though you filled in the keys (error #1 will not go away).
**Cause:** the file is not `orbitspace-code/backend/.env`.
Common cases: it was created in the repo root instead of in
`backend/`; or on Windows, Notepad saved it as `.env.txt`
(because "Save as type" was left on Text Documents); or it was
named `.env.local` in the wrong folder.
**Fix:**

```bash
ls -la backend/.env
cat backend/.env
```

- The file must be at `backend/.env`, exactly that name, no `.txt`.
  On Windows, save it with "Save as type: All Files" and the
  filename `.env`, or create it from the terminal with
  `copy .env.example .env` (§3.2) and edit that copy.
- `backend/lib/supabase.js` only looks in `backend/.env`,
  `backend/.env.local`, and the repo-root `.env.local`. A `.env`
  anywhere else is ignored.
- After fixing the file, restart `npm start` (§5.1).

### 9. `relation "crew" does not exist` / tables missing after seeding

**When:** `npm run seed` or any API call, after a fresh project.
**Cause:** `schema.sql` was never run (or was run on a different
Supabase project than the one in `.env`). The seed and the API
expect the 4 tables to already exist — they never create them.
**Fix:**

1. Check Supabase → **Table Editor**: if the 4 tables are missing,
   run `backend/supabase/schema.sql` in the SQL Editor (§4.2).
2. Check `SUPABASE_URL` in `backend/.env` matches the project
   where you ran the SQL. If you have two Supabase projects, it
   is easy to run the schema in one and point `.env` at the other.
3. Re-run the seed:

```bash
npm run seed
```

### 10. The Secret key was committed to GitHub (or pasted somewhere public)

**When:** you realise `.env` (or a key) went into a commit, a
screenshot, or a shared message.
**Cause:** `.env` was committed despite `.gitignore`, or the key
was pasted into the repo / a chat / a screenshot.
**Fix — do this immediately, in this order:**

1. **Rotate the keys first** in Supabase: Settings → API → rotate
   / create a new Secret key. The old key stops working, so
   anything holding it is harmless after this step.
2. Remove the file from Git and from history. Deleting the file
   from the working folder is not enough if it is already in a
   commit — ask a teammate before rewriting shared history, and
   treat the rotation in step 1 as the real fix.
3. Update `backend/.env` with the new Secret key and restart the
   backend, then re-run the smoke checks in §6.

To stop it happening again: never run a Git `add .` without
checking `git status` first, and never edit `.env.example` to
hold real keys.

---

## 8. Stopping, restarting, and re-seeding

```bash
# Stop a server: Ctrl+C in its terminal.

# Restart the backend after editing .env or code:
cd backend
npm start

# Restart the frontend after editing HTML/CSS/JS:
# just refresh the browser — python3 -m http.server serves files
# live, no restart needed.

# Re-seed from scratch (safe — upserts crew/baselines, replaces readings):
cd backend
npm run seed

# Start over completely (new Supabase project or cleared tables):
# 1. Run backend/supabase/schema.sql again in the SQL Editor.
# 2. npm run seed
# 3. Re-run §6.
```

## 9. What this file does NOT cover

- **Deploying to Vercel / GitHub Pages.** This folder is not deployed
  yet — there is no Vercel project or live link for the code version.
  Deploying is a separate step; do not treat `npm start` as a deploy.
- **The Next.js target in `ARCHITECTURE.md`.** If the team moves to
  Next.js, this file needs a new version for that stack — the commands
  here will not apply.
- **Wiring the frontend to Supabase.** The frontend still runs its
  own in-browser data (`js/data.js`). The API in §5 is checked
  separately. Wiring them together is a build task (see `PLAN.md`),
  not a setup step.
- **Auth.** There is no login in the MVP (`ARCHITECTURE.md` §1:
  "No auth in the MVP"). The Supabase keys above are the only
  credentials this project uses.

## 10. Quick reference — copy-paste the whole setup

Run these in order, in a terminal in the repo root. Replace the
`.env` values with your own (see §3.3). This block is a summary —
if anything fails, the sections above explain why.

```bash
# 0. Check tools
node -v && npm -v && python3 --version && git --version

# 1. Backend dependencies
cd backend
npm install

# 2. Config (Linux/Mac — Windows: copy .env.example .env)
cp .env.example .env
# ... now edit backend/.env: SUPABASE_URL, SUPABASE_ANON_KEY,
#     SUPABASE_SERVICE_ROLE_KEY, PORT=3000 ...

# 3. Database: run backend/supabase/schema.sql in the Supabase
#    SQL Editor first (see §4.2), then:
npm run seed
#    Expected: Seeded Supabase: 3 crew, 3 baselines, 540 daily readings.

# 4. Start the backend (Terminal 1)
npm start
#    Expected: Orbitspace backend (Supabase) listening on http://localhost:3000

# 5. Start the frontend (Terminal 2, in the repo root)
cd ..
python3 -m http.server 8000
#    Windows: python -m http.server 8000

# 6. Open + verify
#    Frontend: http://localhost:8000/index.html  (click Day 63)
#    Backend:  curl http://localhost:3000/api/health
#              curl "http://localhost:3000/api/crew-status?day=63"
#    Pass = Day 63 Kenji first, 79 Watch; Day 90 Kenji 95 Nominal.
```

---

*SETUP.md v1.0 — 15 Nov 2026. Verified against the real files:
`backend/package.json` (scripts `seed`, `start`, `test`, dependency
`@supabase/supabase-js ^2.45.0`), `backend/server.js` (7 endpoints,
port 3000), `backend/.env.example` (4 variables), `backend/supabase/
schema.sql` (4 tables + RLS), Node v24.22.1 / npm 10.9.4 / Python
3.12.3 / Git 2.43.0. Live checks on 15 Nov 2026: seed printed
`Seeded Supabase: 3 crew, 3 baselines, 540 daily readings.`; health
returned `{"ok":true,"storage":"supabase","dailyReadings":540,
"seeded":true}`; Day 63 Kenji 79 Watch, Day 90 Kenji 95 Nominal;
frontend pages returned HTTP 200. Source of truth: `PRD.md` >
`DESIGN.md` > `ARCHITECTURE.md` > `DATABASE.md` > `API.md`.
If this file conflicts with one of those, that file wins.*
