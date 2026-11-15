# OrbitCare — Architecture (ARCHITECTURE.md)

**Version:** 1.0 — 15 Nov 2026
**Sources of truth:** `PRD.md` v1.0 and `DESIGN.md` v1.0 (both 15 Nov 2026). If this file conflicts with either, PRD wins on what to build, DESIGN wins on how it looks.
**Product:** OrbitCare (working build name: Orbitspace) — offline-first astronaut health dashboard, 180-day simulated mission, 3 crew, personal-baseline anomaly detection, decision support only. Simulated data only. Not a medical device.
**Rule:** Prefer simple, popular, well-documented tools. Avoid over-engineering. Do not write application code yet — this file is the plan, not the implementation.

---

## 1. Recommended stack

One stack only. Do not run two stacks in parallel. The stack below is the target for the code version; the existing plain-HTML `orbitspace-code/` folder is the same product in a simpler form (see §1.2).

### Frontend
| Choice | One-line reason |
|---|---|
| **Next.js 14 (App Router) + React 18 + TypeScript** | One framework for pages, routing and API routes — no separate frontend server to deploy or debug. |
| **Tailwind CSS** | Design tokens from DESIGN.md map directly to utility classes; fast, consistent styling with no custom CSS sprawl. |
| **Recharts** | The only chart library in DESIGN.md; line charts + normal bands are built-in, well documented. |
| **Inter + IBM Plex Mono (bundled, self-hosted)** | The only fonts in DESIGN.md; bundling them means the app works offline with no font CDN. |
| **@react-pdf/renderer** | Builds the PDF health report from React components, on-device, offline — no server PDF service needed. |

### Backend
| Choice | One-line reason |
|---|---|
| **Next.js API Routes (same repo, same deploy)** | No separate backend service for the MVP — scores, flags and PDF data are served from the same app. |
| **TypeScript scoring module (`lib/scoring/`)** | Z-scores + domain scores are simple arithmetic; implementing them in TypeScript keeps one language, one test suite, and no Python service to host. |
| **Python (seed / analysis script only, not a service)** | Used only offline, before the hackathon demo, to generate/validate the 180-day simulated data and to sanity-check Isolation Forest results — never as a live API in the MVP. |

**Explicitly NOT in the MVP:** a separate FastAPI / Express backend, a separate ML microservice, GraphQL, a CMS, an auth server, or a real-time websocket service. COSMOCare's React + FastAPI split is a valid V2 shape, but it is over-engineering for a 48-hour MVP with 540 rows of data. Add a separate backend only when a real need appears (real wearables, multi-crew, or a Python model that cannot run in TypeScript).

### Database
| Choice | One-line reason |
|---|---|
| **Supabase (Postgres, free tier)** | One place for Postgres tables, SQL, and row access — the team already chose it for the code version, and it needs no server management. |
| **localStorage / IndexedDB (on-device cache, offline-first)** | The app must work with no connection, so the last synced mission data lives on the device and is the fallback when Supabase is unreachable. |

### Hosting / tooling
| Choice | One-line reason |
|---|---|
| **Vercel (Hobby, free)** | Push to GitHub, get a live link — the fastest verified deploy path for Next.js, and the link judges open. |
| **GitHub (one repo, `main` protected)** | One repo for all 4 people; every deploy, PR and demo link comes from it. |
| **GitHub Actions (CI: typecheck + lint + build + test)** | Catches a broken build before it reaches Vercel, with no extra service to set up. |
| **Figma + Excalidraw** | Design in Figma (DESIGN.md), architecture sketch in Excalidraw for the README — no other design tools. |

### 1.1 What the existing code folder maps to
The delivered `orbitspace-code/` folder (plain HTML/CSS/JS + a Node + Supabase backend) implements the same architecture in a simpler form: `index.html` = Crew View, `astronaut.html` = Dashboard, `trends.html` = Trends, `plan.html` = Action Plan, `how.html` = How It Works, `js/data.js` = simulated data, `js/app.js` = scoring + rendering, `backend/` = Supabase server + seed. If the team keeps that folder instead of moving to Next.js, the mapping in §3 and the data model in §4 still apply — do not rebuild it in Next.js during the hackathon just for fashion. Pick one, lock it Friday night, do not switch mid-build.

### 1.2 Decisions (recorded, so nobody re-litigates them Saturday)
1. **Next.js over React+Vite+FastAPI for the target stack** — fewer services, one deploy, faster to a live link.
2. **Supabase over Firebase** — relational data (crew → baselines → readings → flags) fits Postgres; SQL is easier to explain to judges.
3. **ML in TypeScript for the MVP** — z-scores + 3-day smoothing + rule-based flags are arithmetic, not a model server. Isolation Forest runs in the Python seed script for validation, and its result is a flag in the data, not a live service.
4. **PDF on-device with @react-pdf/renderer** — no PDF server, works offline, matches the PRD's < 10-second target.
5. **No auth in the MVP** — the demo crew is fixed (3 people); add Supabase Auth only in V2 if real users appear.

---

## 2. Complete folder and file structure

This is the target Next.js structure. File names are fixed; do not invent a different layout without updating this file first. Files marked `(later)` are V2/Later — do not create them in the MVP.

```
orbitcare/
├── PRD.md
├── DESIGN.md
├── ARCHITECTURE.md
├── README.md                     # AI disclosure, data sources, "not a medical device", demo links
├── .env.example                  # placeholder keys only, never real keys
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts            # DESIGN.md tokens only — no new colours/fonts
├── postcss.config.mjs
├── public/
│   ├── favicon.ico
│   └── fonts/                    # Inter + IBM Plex Mono, self-hosted (woff2)
│       ├── inter-400.woff2
│       ├── inter-600.woff2
│       ├── inter-700.woff2
│       └── ibm-plex-mono-700.woff2
├── docs/
│   ├── architecture.md           # copy of this file (for the repo)
│   └── screenshots/              # Day-63, Crew View, Trends — for README / slides
├── scripts/
│   ├── generate-mission-data.py  # Python: generate 180 days × 3 crew, inject Day-63 event
│   ├── validate-forest.py        # Python: Isolation Forest sanity check on generated data
│   └── seed-supabase.mjs         # Node: load generated JSON into Supabase (run once)
├── src/
│   ├── app/
│   │   ├── layout.tsx            # header, nav, emergency button, footer disclaimer, fonts
│   │   ├── page.tsx              # Crew View / Overview  (PRD M1)
│   │   ├── globals.css           # Tailwind + DESIGN.md CSS custom properties only
│   │   ├── astronaut/
│   │   │   └── [crewId]/
│   │   │       └── page.tsx      # Astronaut Dashboard  (PRD M2, M3, M4)
│   │   ├── trends/
│   │   │   └── page.tsx          # Trends  (PRD M6)
│   │   ├── plan/
│   │   │   └── page.tsx          # Action Plan  (PRD M5)
│   │   ├── self-check/
│   │   │   └── page.tsx          # Daily self-check form  (PRD M7)
│   │   ├── emergency/
│   │   │   └── page.tsx          # One-tap Emergency Guide  (PRD V2 — build after MVP)
│   │   ├── how/
│   │   │   └── page.tsx          # How It Works  (PRD Flow 5)
│   │   └── api/
│   │       ├── crew/
│   │       │   └── route.ts      # GET crew list (worst-first, for a given mission day)
│   │       ├── crew/[crewId]/
│   │       │   ├── route.ts      # GET astronaut + vitals + scores for a mission day
│   │       │   └── self-check/
│   │       │       └── route.ts  # POST self-check (saves, returns updated scores)
│   │       ├── trends/
│   │       │   └── route.ts      # GET 7/30-day series + normal bands
│   │       ├── report/
│   │       │   └── route.ts      # GET report data for a mission day (PDF is built client-side)
│   │       └── sync/
│   │           └── route.ts      # GET sync status (LIVE / STALE / OFFLINE, last-sync time)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx        # 64px header, nav, sync chip, emergency button
│   │   │   ├── Footer.tsx        # "Simulated data only · Decision support only · Not a medical device"
│   │   │   └── MissionDayBar.tsx # mission-day slider + Play + "Jump to Day 63"
│   │   ├── crew/
│   │   │   ├── CrewCard.tsx      # crew card (DESIGN §7.3)
│   │   │   └── CrewList.tsx      # worst-first list
│   │   ├── health/
│   │   │   ├── StatusChip.tsx    # Nominal / Watch / Alert chip (DESIGN §7.4)
│   │   │   ├── DomainScoreCard.tsx
│   │   │   ├── VitalsTable.tsx   # vital | today | baseline | change + z-score
│   │   │   ├── FlagCard.tsx      # flag + evidence + action
│   │   │   └── TrendChart.tsx    # Recharts line + normal band + markers
│   │   ├── forms/
│   │   │   ├── SelfCheckForm.tsx
│   │   │   └── SegmentedControl.tsx  # 7-day / 30-day, mood 1–5, stress 1–5
│   │   ├── report/
│   │   │   └── ReportDocument.tsx    # @react-pdf/renderer document (4 pages)
│   │   └── ui/
│   │       ├── Button.tsx        # Primary / Secondary / Ghost / Destructive / Emergency
│   │       ├── Card.tsx
│   │       ├── Modal.tsx
│   │       ├── Toast.tsx         # toast container + toast (DESIGN §7.8)
│   │       ├── Skeleton.tsx
│   │       └── EmptyState.tsx
│   ├── lib/
│   │   ├── constants.ts          # mission length (180), baseline days (21), thresholds (Watch ≥ 1, Alert ≥ 2)
│   │   ├── types.ts              # Crew, Baseline, DailyReading, DomainScore, Flag, SelfCheck
│   │   ├── data/
│   │   │   ├── mission-data.json # generated simulated data (180 days × 3 crew) — labelled simulated
│   │   │   └── emergency-guide.ts # V2: 6 situations, steps, CPR metronome data (static, offline)
│   │   ├── scoring/
│   │   │   ├── baseline.ts       # mean + SD over Days 1–21
│   │   │   ├── zscore.ts         # direction-aware z-scores
│   │   │   ├── domains.ts        # 4 domain scores, 3-day smoothing, Watch/Alert
│   │   │   ├── flags.ts          # flag generation + plain-language explanations
│   │   │   └── action-plans.ts   # rule-based action plans + "contact flight surgeon if…"
│   │   ├── api/
│   │   │   ├── client.ts         # fetch wrapper: timeout, offline fallback, error shape
│   │   │   └── errors.ts         # AppError type + plain-language error messages
│   │   ├── store/
│   │   │   ├── mission-store.ts  # mission day, selected crew, range — URL-first (see §5)
│   │   │   └── offline-cache.ts  # localStorage/IndexedDB read/write, sync queue
│   │   ├── supabase/
│   │   │   ├── client.ts         # browser Supabase client (anon key only)
│   │   │   └── server.ts         # server Supabase client (service key, server only)
│   │   └── pdf/
│   │       └── report-data.ts    # shape report data for ReportDocument
│   ├── styles/
│   │   └── tokens.css            # DESIGN.md §11 CSS custom properties — the only place HEX lives
│   └── tests/
│       ├── scoring.test.ts       # baseline, z-score, Watch/Alert thresholds, Day-63 detection
│       ├── flags.test.ts         # every flag has evidence + action; no flag without an action
│       └── smoke.test.ts         # Crew View worst-first on Day 63; Day 90 Kenji Nominal
├── supabase/
│   ├── schema.sql                # crew, baselines, daily_readings, self_checks, sync_log
│   └── seed.sql                  # generated data load (or via scripts/seed-supabase.mjs)
└── .github/
    └── workflows/
        └── ci.yml                # typecheck + lint + build + test on every push/PR
```

**If the team keeps the plain-HTML folder instead of Next.js**, the equivalent tree is already delivered in `orbitspace-code/` (`index.html`, `astronaut.html`, `trends.html`, `plan.html`, `how.html`, `css/style.css`, `js/data.js`, `js/app.js`, `backend/` with Supabase server + seed). Do not maintain both trees — pick one in §1, delete / archive the other from the repo, and note the choice in the README.

---

## 3. Data flow

### 3.1 System diagram (text)

```
Wearables / sensors (LATER — not in MVP)
        |
        v  (V2 only, via device adapters)
┌─────────────────────────────────────────────────────────┐
│  On-board / browser (OrbitCare app)                     │
│  ┌──────────────┐   ┌──────────────────────────────┐   │
│  │  Pages       │   │  lib/scoring                 │   │
│  │  (App Router)│──▶│  baseline → z-score →        │   │
│  │  Crew View,  │   │  domain scores → flags →     │   │
│  │  Dashboard,  │   │  action plans                │   │
│  │  Trends,     │   └──────────────────────────────┘   │
│  │  Plan,       │              │                         │
│  │  Self-check  │              │ reads / writes          │
│  └──────────────┘              v                         │
│                    ┌──────────────────────┐             │
│                    │  Offline cache       │             │
│                    │  localStorage /      │             │
│                    │  IndexedDB           │             │
│                    │  (last synced data + │             │
│                    │   queued self-checks)│             │
│                    └──────────────────────┘             │
└─────────────────────────────────────────────────────────┘
        │  when a link is available (sync only — never blocking)
        v
┌──────────────────────┐      ┌──────────────────────┐
│  Next.js API Routes  │─────▶│  Supabase (Postgres) │
│  /api/crew, /trends, │      │  crew, baselines,    │
│  /report, /sync,     │      │  daily_readings,     │
│  /self-check (POST)  │      │  self_checks,        │
│                      │      │  sync_log            │
└──────────────────────┘      └──────────────────────┘
        │
        │  PDF is built on-device, not on the server
        v
┌──────────────────────┐
│  @react-pdf/renderer │
│  → OrbitCare-Day-<n>-│
│    report.pdf (download)
└──────────────────────┘

Third parties (all optional, none blocking the MVP):
  • Vercel — hosting + deploy (required for the live link)
  • GitHub — repo + CI (required)
  • Figma — design source (DESIGN.md is the authority, Figma is a sketch)
  • No analytics, no ads, no payment, no email service in the MVP.
```

### 3.2 Read flow (the common path — Crew View, Day 63)
1. User opens `/` → mission day and crew id are read from the URL (`?day=63&crew=kenji` — see §5).
2. App first reads the offline cache. If it has Day-63 data, it renders immediately — no waiting for the network.
3. In the background, `GET /api/crew?day=63` fetches the same data from Supabase. If it returns newer data, the cache is updated and the UI re-renders. If it fails or times out, the cached view stays, and the sync chip shows STALE / OFFLINE with the last-sync time.
4. Scores and flags are computed in `lib/scoring/` from baselines + readings, in the browser, on every render for the selected day. The API may return pre-computed scores, but the browser must be able to recompute them from the raw readings — that is what makes the offline demo work.
5. Crew View sorts the 3 crew worst-first (Alert > Watch > Nominal, then lowest score) and renders CrewCards.

### 3.3 Write flow (daily self-check)
1. Astronaut submits the self-check form → client validates (sleep + mood required, others optional).
2. The check is written to the offline cache immediately and the UI shows "Saved — Day X" + a toast. The user never waits for the network.
3. A sync queue entry is added. When a connection is available, `POST /api/crew/[crewId]/self-check` sends it to Supabase. On success the queue entry is marked synced; on failure it stays queued and retries on the next sync (see §6).
4. The Sleep & Mind score for that day is recomputed locally from the new check, so the dashboard updates without a reload.

### 3.4 PDF flow
1. User taps "Download PDF report" → report data for the selected day is assembled (crew at a glance, per-astronaut scores, vitals vs baseline, flags + explanations, action plan).
2. `@react-pdf/renderer` builds the 4-page PDF on-device. No server, no network.
3. File downloads as `OrbitCare-Day-<day>-report.pdf`. A toast confirms success. On failure, a plain-language inline error is shown — the button never silently does nothing.

### 3.5 Seed / setup flow (hackathon morning, once)
1. `scripts/generate-mission-data.py` generates 180 days × 3 crew, injects the Day-63 infection event and the other test events (solar-particle event, exercise slump, stress period, BP drift).
2. `scripts/validate-forest.py` runs Isolation Forest on the generated data and confirms the injected events are flagged.
3. `scripts/seed-supabase.mjs` (or `supabase/seed.sql`) loads crew + baselines + readings into Supabase.
4. Smoke test: open Day 63 → Kenji worst-first, Watch, score 78. Open Day 90 → Kenji Nominal. Wifi off → app still works.
5. Deploy to Vercel, test the live link in incognito, write the README.

### 3.6 What never flows where
- **No real health data** flows anywhere in the MVP. All data is generated, simulated, and labelled.
- **No secrets** flow to the browser. The Supabase service key lives only in server code / Vercel env vars, never in client code or in GitHub.
- **No diagnosis** flows to the user. Scores and flags are risk signals with evidence; the words "diagnosis", "you have…", and treatment prescriptions are forbidden in code, copy, and the PDF.

---

## 4. State management approach

**Principle: URL first, cache second, server third. No global state library in the MVP.**

| State | Where it lives | Why |
|---|---|---|
| Mission day (1–180), selected crew, trends range (7/30) | **URL query params** (`?day=63&crew=kenji&range=30`) | Shareable, bookmarkable, back-button works, judges can open Day 63 in one link, and the demo "Jump to Day 63" is just a link. |
| Crew, baselines, readings for the selected day | **Offline cache (localStorage / IndexedDB) + React state** | Renders instantly, works offline. Fetched in the background from the API and refreshed when newer data arrives. |
| Self-check draft (unsaved form) | **Local component state** | Lost on navigation is acceptable; a saved check is persisted (see below). |
| Saved self-checks + sync queue | **Offline cache, then Supabase** | Write locally first (§3.3), sync when possible. Never lost on refresh. |
| Sync status (LIVE / STALE / OFFLINE, last-sync time) | **Small React context (`mission-store.ts`)** | The header chip needs it on every page; everything else reads the URL/cache, not this context. |
| Toasts, modal open/closed, Play playing/paused | **Local component state** | Ephemeral UI state — do not put it in the URL or the cache. |
| Emergency Guide step | **Local component state (+ URL `?step=n` optional)** | One step at a time; do not persist mid-guide state to the server. |

**Rules:**
- Do **not** add Redux, Zustand, or any state library in the MVP. URL + React `useState`/`useContext` + the offline cache cover every PRD flow. Add a library only in V2 if a real need appears — and update this file first.
- The mission-day slider writes to the URL on every change (debounced). Play advances the day in the URL, so pausing / sharing / refreshing keeps the same day.
- Scores are **derived state, never stored as the source of truth**. Stored: raw readings + baselines + self-checks. Computed on render: z-scores, domain scores, flags, action plans. If a computed value and a stored value disagree, the computed value wins and the discrepancy is a bug.
- Sorting is deterministic: worst-first = Alert first, then Watch, then Nominal; ties broken by lowest domain score, then by name. The same input always gives the same order.
- No state is kept only in memory that the user would lose on refresh (self-checks, action-plan check-offs, and the selected day are all persisted or in the URL).

---

## 5. Error-handling strategy

**Principle: never a blank screen, never a raw error code, never a dead button. Offline is a state, not an error.**

### Error taxonomy
| Kind | Example | User sees | Developer sees |
|---|---|---|---|
| Offline / timeout | Supabase unreachable, fetch times out after 5s | Cached data + STALE/OFFLINE chip + "Last sync: Day X, HH:MM" | Console warning + sync_log entry (queued) |
| Not found | Bad crew id in URL, missing day | "Crew member not found — back to Crew View" + a Back button | 404, logged |
| Validation | Self-check missing sleep/mood, invalid number | Inline field error, plain language: "Sleep is required — pick a value to save." | Field-level error, no log needed |
| Server / DB | Supabase returns 500, seed failed | "Something went wrong loading this page. Your saved data is safe — try again." + Retry button | Error log with request id, no secrets |
| PDF failure | Report generation fails | "The PDF couldn't be created. Try again — your data is still here." + Retry | Error log, day + crew id only |
| Unexpected / bug | Anything else | A friendly fallback card, never a white screen; the rest of the page still renders | Error boundary log |

### Rules
1. **Error boundaries on every page.** A crash in Trends must not kill Crew View. Each page has its own boundary with a "Back to Crew View" action.
2. **Fetch wrapper (`lib/api/client.ts`).** Every API call goes through one wrapper: 5-second timeout, 1 retry only for network errors (not for 4xx), offline fallback to cache, and a single error shape (`{ code, message, retryable }`). No `fetch()` calls scattered in components.
3. **Plain-language messages only.** The user-facing message is always: what happened + what to do next. Technical detail (status code, stack) goes to the log only, never to the screen.
4. **Retry is explicit.** A Retry button re-runs the failed action. No silent auto-retry loops. The sync queue retries in the background, at most once per sync attempt, and stops after 3 failures — then it shows "3 items waiting to sync" in the header, not an error banner.
5. **Loading states are skeletons, not spinners alone** (DESIGN §6). A card that is loading shows skeleton bars; a button that is loading shows a spinner + "Loading…" and is disabled.
6. **Empty states are designed, not errors.** "No flags today — all Nominal" is a success state, not a 404.
7. **Logging:** log errors with day + crew id + request id only. Never log health values, self-check notes, or any personal data beyond the demo crew names already in the product.

---

## 6. Naming conventions and code style

### Files and folders
- Files: `PascalCase.tsx` for components (`CrewCard.tsx`, `FlagCard.tsx`), `kebab-case.ts` for utilities (`zscore.ts`, `action-plans.ts`), `kebab-case` for routes (`self-check/`, `action-plan/` — use the PRD wording, not abbreviations).
- Folders: lowercase, plural where it holds many things (`components/`, `lib/scoring/`). One component per file. A component file exports exactly one default component.
- Tests live next to the code they test: `scoring.test.ts` sits in `src/lib/scoring/` or `src/tests/` — pick one and keep it consistent (this file picks `src/tests/`).

### Code
- **Language:** TypeScript, strict mode on. No `any` without a comment explaining why. No `// TODO` without a linked issue / PRD section.
- **Naming:** `camelCase` for variables/functions (`computeDomainScore`, `missionDay`), `PascalCase` for types/components (`CrewMember`, `DomainScore`), `SCREAMING_SNAKE_CASE` for constants (`BASELINE_DAYS = 21`, `WATCH_THRESHOLD = 1`, `ALERT_THRESHOLD = 2`).
- **Domain terms (use these exact words everywhere — code, UI, README, PDF):** `crew`, `baseline`, `reading`, `domain score`, `flag`, `action plan`, `self-check`, `mission day`, `Nominal`, `Watch`, `Alert`. Never use: `patient`, `diagnosis`, `disease`, `treatment`, `risk %` as a standalone number without its evidence.
- **Functions:** small, pure, testable — scoring functions take readings + baseline and return scores; they never fetch, never touch the DOM, never read the URL. Components fetch/render; `lib/` computes.
- **Formatting:** Prettier (default settings) + ESLint (Next.js recommended). Run `lint` + `typecheck` + `test` in CI on every push. Do not commit code that fails CI.
- **Comments:** explain *why*, not *what*. A z-score function needs one line explaining "direction-aware: lower sleep is worse, higher BP is worse". No commented-out code — delete it, Git remembers it.

### Design tokens in code
- Colours, fonts, radii and shadows live only in `src/styles/tokens.css` (DESIGN §11). Components use Tailwind classes that reference those tokens, or the CSS variables directly. Never hard-code a HEX in a component. If a colour is missing, update DESIGN.md first, then `tokens.css`.

### Git
- Branches: `main` (protected, deploys to Vercel), `feat/<short-name>` for work, e.g. `feat/crew-view`, `feat/pdf-report`.
- Commits: short, imperative — `Add Crew View worst-first sorting`, `Fix Day-63 flag evidence`. One logical change per commit.
- PRs: one feature per PR, CI must pass, one reviewer (a teammate) before merging to `main`. No direct pushes to `main` during the hackathon.

---

## 7. Environment variables

**Rules:** placeholders only in `.env.example`. Real keys live in Vercel env vars (production) and in a local `.env.local` (never committed, listed in `.gitignore`). No real key in code, in GitHub, in the README, or in a screenshot. The browser may only see `NEXT_PUBLIC_*` variables.

| Variable | Required? | Where it is used | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (code version) | Browser + server Supabase client | Project URL from Supabase Settings → API. Safe to expose (anon key only). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (code version) | Browser Supabase client | Anon/public key only. Row-level security must be on in Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server only) | Server Supabase client + seed script | **Never** in the browser, never with a `NEXT_PUBLIC_` prefix, never in GitHub. |
| `NEXT_PUBLIC_APP_URL` | No | Canonical URL for share links / PDF footer | Defaults to the Vercel URL. Set it after the first deploy. |
| `NEXT_PUBLIC_MISSION_LENGTH_DAYS` | No | Default 180 | Only change if the mission length changes; update PRD too. |
| `NEXT_PUBLIC_BASELINE_DAYS` | No | Default 21 | Only change with a PRD update. |
| `DATABASE_URL` | No (only if using direct Postgres instead of the Supabase client) | Seed script | Prefer the Supabase client; use this only if the seed script needs it. |
| `NODE_ENV` | Set by Vercel / Next.js | `development` / `production` | Do not set it manually in `.env`. |

**Local setup (one command each, in order):** copy `.env.example` → `.env.local` → fill the Supabase URL + anon key from Supabase Settings → run the seed script once → run the dev server → open Day 63 and verify Kenji worst-first.

---

## 8. Scalability and performance notes

**Reality check first:** the MVP has 3 crew × 180 days = 540 readings. That is trivial. Do not build for millions of users. The notes below are about not making the trivial case slow, and about what breaks first if the product grows.

### What is already fast enough
- **Data size:** 540 rows loads in milliseconds. Keep the whole mission dataset in the offline cache; do not paginate it in the MVP.
- **Scoring:** z-scores + domain scores are O(n) over at most 180 days per astronaut. Compute on render; no pre-computation service needed. Memoise by `(crewId, day)` so the slider does not recompute everything on every pixel of movement.
- **Charts:** 4 charts × 180 points max. Recharts handles this easily. Do not down-sample in the MVP.
- **PDF:** 4 pages, built on-device in < 10 seconds (PRD target). Generate only when the user taps Download, never on page load.

### Performance budgets (MVP, measured on a normal laptop / phone)
- First load (Crew View): < 2 seconds on a good connection; < 1 second from cache offline.
- Mission-day slider drag: UI updates within 100 ms; no network call per drag — only on release, debounced 200 ms.
- PDF generation: < 10 seconds.
- Bundle: keep the first-load JS under 300 KB gzipped where possible; Recharts + @react-pdf/renderer are the two big dependencies — do not add another chart or PDF library.

### What breaks first if it grows (V2 / Later — do not build now)
1. **More crew / more missions:** stop loading the whole dataset into the cache. Move to per-crew, per-range API queries (`GET /api/trends?crew=…&from=…&to=…`) and paginate readings.
2. **Real wearables:** readings arrive continuously, not as a fixed 180-day file. Add a device-adapter layer (`lib/integrations/`) and a queue — do not let sensor code touch the scoring code directly.
3. **Real users / auth:** add Supabase Auth + Row-Level Security so a crew only sees its own mission. Do not bolt auth onto the MVP demo crew.
4. **Heavier ML (Isolation Forest live, forecast):** move scoring to a Python service (FastAPI) or to a server-side job, and keep the TypeScript scoring module as the rule-based fallback. Do not run a model in the browser for the MVP.
5. **More traffic:** Vercel + Supabase free tiers cover a demo and judging. If the public link gets real traffic, add caching headers for the static mission data and a CDN for fonts — both are one-line changes, not a re-architecture.

### What NOT to optimise now
- No CDN, no Redis, no queue service, no microservices, no Kubernetes, no load balancer, no database sharding, no GraphQL caching layer. Any of those in the MVP is over-engineering. The PRD's success metric is a working Day-63 demo, not a system that scales to 10,000 crews.

---

## 9. Security, privacy and compliance notes

- **Simulated data only.** No real health data in the repo, in Supabase, or in the PDF. If real data ever appears, stop and update PRD + this file first.
- **Secrets:** see §7. Service key is server-only. Anon key is public by design, protected by Row-Level Security.
- **No diagnosis:** the UI, the API, and the PDF must never return a diagnosis. The word "diagnosis" appears in this file only to forbid it.
- **AI disclosure:** the README and the Project Tab must list every AI tool used and what it helped with (code, docs, copy). AI-generated images/video must be watermarked where the rules require it.
- **No tracking:** no analytics, no cookies for advertising, no third-party trackers in the MVP. If analytics are added in V2, list them here first.

---

## 10. Open questions / decisions still to make

1. **Next.js vs the delivered plain-HTML folder:** pick one (§1.1) and lock it before Saturday 10:00. Do not run both.
2. **Supabase project owner:** who creates it and adds the keys? (User said they will set it up themselves via API keys — confirm before the seed step.)
3. **Isolation Forest live or seed-only?** This file says seed-only for the MVP. If the team wants a live forest, add a Python service in V2 and update §1 + §3 first.
4. **Auth in V2?** Only if real users appear. No decision needed for the hackathon.

---

*End of ARCHITECTURE.md v1.0. Simple, popular, well-documented tools only. If a new service, library or layer is proposed, it must earn its place here first — by naming the PRD feature it serves and the problem it solves that the current stack cannot.*
