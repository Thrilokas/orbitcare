# OrbitCare — INTEGRATIONS.md

**Every third-party service this project uses, might use, or
deliberately does not use.**

**Version:** 1.0 — 15 Nov 2026
**Sources of truth:** `PRD.md` v1.0, `ARCHITECTURE.md` v1.0,
`API.md` v1.0, `DATABASE.md` v1.0, `AUTH_SECURITY.md` v1.0,
`MCP.md` v1.0, `SETUP.md` v1.0 (all 15 Nov 2026). If this file
conflicts with any of those, that file wins.
**Status:** design / setup guide. Only §2–§4 are live in the
delivered code; §5–§7 are V2 or conditional designs, and §8–§9
are explicitly **not** in the PRD — do not build them.

---

## 0. Read this first — what the PRD actually needs

The PRD needs **three** third-party services, and only three:

| # | Service | Status | PRD / ARCHITECTURE basis |
|---|---|---|---|
| 1 | **Supabase** (Postgres) | **MVP — live now** | ARCHITECTURE §1: "Supabase (Postgres, free tier)". The delivered code already runs on it (seed verified 15 Nov 2026: 3 crew, 3 baselines, 540 readings). |
| 2 | **Vercel** (hosting) | **MVP — deploy target** | ARCHITECTURE §1: "Vercel (Hobby, free)". The live link judges open. |
| 3 | **GitHub** (repo + CI) | **MVP — repo + GitHub Actions** | ARCHITECTURE §1: "GitHub (one repo, `main` protected)" and "GitHub Actions (CI: typecheck + lint + build + test)". |

Everything else in this file is either a **V2 option** (email,
file storage) or **explicitly out of scope in the PRD** (payments,
AI chat). They are documented here because the user asked for
them, and so the team does not add them by accident on Saturday:

| Service | Status | Why it is not in the MVP |
|---|---|---|
| Email (Resend) | V2 option | The PRD handover is a PDF download, not an email (PRD §6 Flow 4). No email is sent in the MVP. |
| File storage (Supabase Storage / S3) | V2 option | The PDF is generated on-device and never stored on a server (PRD M8, ARCHITECTURE §1.2 decision 4). The `reports` table holds metadata only. |
| AI / LLM (OpenAI or Anthropic) | **Not in the PRD** | Flags and action plans are rule-based by design (PRD M5, ARCHITECTURE §1.2 decision 3). "Doctor chat" and diagnosis are in PRD §10, out of scope. An LLM is a conditional V2 design only (§8). |
| Payments (Stripe or Razorpay) | **Not in the PRD** | PRD §10, out of scope: "payments" is listed verbatim as a non-goal. OrbitCare has no paid plan, no checkout, and no price. A payments design is in §9 only so the team knows what it would take — do not build it. |

**The cost and limit numbers in this file:** where a number comes
from this project's own docs (API.md rate limits, Supabase free
tier as researched 11 Nov 2026) it is stated as such. Where a
number comes from a provider's pricing page, this file says
"check <provider> pricing" instead of quoting a figure that may
have changed — verify it on the provider's page before relying
on it, and update this file with the date you checked.

**The service-layer rule (the user's rule for this file):**
every integration sits behind a small service layer — one module
per service, with a narrow interface the rest of the app calls.
The frontend **never** calls a third-party service directly.
It calls the app's own API routes (`/api/v1/...`), and the API
route calls the service. Swapping a provider means changing one
module and its env vars, not hunting calls through the pages.
See §1 for the layer, and each service section for its module.

---

## 1. The service layer — how every integration is wired

### 1.1 The shape

```
Pages / components (browser)
  │  fetch('/api/v1/...') only — never a provider SDK, never a provider key
  ▼
Next.js API Route (src/app/api/.../route.ts)
  │  validates the request, checks the role (V2), then calls one service
  ▼
Service layer (src/lib/services/<service>.ts)   ← the only place that
  │  knows the provider. One module per service.     knows the provider
  ▼
Third-party service (Supabase / Resend / Stripe / …)
```

- **One module per service, one interface per module.**
  `Choice:` one module means the provider's SDK is imported in
  exactly one file, so swapping it is a one-file change.
- **The service returns the app's own types, never the
  provider's types.**
  `Choice:` if the page sees only `Crew`, `Flag`, `Report`, a
  provider change cannot leak into the UI.
- **The service throws the app's own error shape** (API.md §4:
  `{ error: { code, message, details, request_id } }`).
  `Choice:` one error shape means the frontend has one error
  path, whatever failed underneath.
- **No service reads `process.env` anywhere except inside its
  own module, at the top, with a clear name.**
  `Choice:` env access in one place makes a missing key fail
  loudly at startup instead of halfway through a request.
- **A service never imports a React component, and a component
  never imports a service.**
  `Choice:` that one-way wall is what makes "never call it
  directly from the frontend" enforceable by a grep, not by memory.

### 1.2 Where the modules live

ARCHITECTURE.md §2 fixes the target folder tree. It has
`src/lib/supabase/` (client + server), `src/lib/api/` (fetch
wrapper), `src/lib/pdf/`, and `src/lib/scoring/` — but no
`services/` folder yet. This file proposes adding one, and
ARCHITECTURE.md §2 must be updated if the team adopts it
(AGENTS.md: do not invent a new layout without updating the
source-of-truth file first).

```
src/lib/services/
  ├── supabase.ts      # §2 — database (wraps src/lib/supabase/server.ts)
  ├── storage.ts       # §5 — file storage (V2, Supabase Storage)
  ├── email.ts         # §6 — email (V2, Resend)
  ├── ai.ts            # §8 — LLM (NOT in PRD — conditional V2 only)
  └── payments.ts      # §9 — payments (NOT in PRD — conditional only)
```

**In the delivered plain-HTML folder** (`orbitspace-code/`),
the equivalent is `backend/lib/` — it already has
`supabase.js` (the service for §2) and `simulation.js`. A new
service there would be `backend/lib/<service>.js`, required by
`server.js` only, never by a browser script. Do not maintain
both trees — pick one (ARCHITECTURE §1.1).

### 1.3 The contract every service follows

```ts
// The shape every service in src/lib/services/ follows.
// A service is a small object with typed methods, no raw SDK
// types leaking out, and errors in the API.md §4 shape.

export interface ServiceResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; retryable: boolean };
}

// Every service method:
//   1. validates its inputs (AUTH_SECURITY.md §6),
//   2. calls the provider once, with a timeout,
//   3. retries only network errors, at most once (see §10.2),
//   4. maps the provider's error to the app's error shape,
//   5. never logs a secret, a token, or a full request body.
```

- `Choice:` a shared result shape means the API route that
  calls any service writes the same five lines of error handling.
- `Choice:` "retries only network errors, at most once" is the
  ARCHITECTURE §5 rule, applied to providers as well as to the
  app's own API.

---

## 2. Supabase — database (Postgres), Auth (V2), Storage (V2)

**Status: MVP, live.** This is the only integration the hackathon
demo depends on besides hosting. The project (OrbitCare, org Team
Alpha) was created 15 Nov 2026, `schema.sql` ran successfully,
and the seed was verified live: `Seeded Supabase: 3 crew,
3 baselines, 540 daily readings.` (SETUP.md §4–§6.)

### Why we use it

- **One place for Postgres tables, SQL, and row access** —
  ARCHITECTURE §1. The data is relational (crew → baselines →
  readings → flags), and SQL is easier to explain to judges
  than a document store.
- **Row-Level Security is the write boundary** — DATABASE.md §7:
  the anon key can only `SELECT` simulated data (and `INSERT`
  one self-check); only the service role can seed or recompute.
- **Auth and Storage come from the same project when V2 needs
  them** — one dashboard, one set of keys, no second vendor.
  `Choice:` one vendor for data, auth, and files means one
  outage to plan for instead of three.

### Required env variables

| Variable | Where | Notes |
|---|---|---|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | `.env` (local), Vercel env vars | Project URL. Safe to expose (anon key only). |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env`, Vercel env vars | Publishable key (`sb_publishable_…`). Public by design — RLS is the protection, not the key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only: `.env` on the server, Vercel env vars marked server-only | Secret key (`sb_secret_…`). **Never** in the browser, never with a `NEXT_PUBLIC_` prefix, never in GitHub. |
| `DATABASE_URL` | Only if the seed script needs direct Postgres | Prefer the Supabase client; use this only if the seed needs it (ARCHITECTURE §7). |

All four are placeholders only in `.env.example`
(AUTH_SECURITY.md §7). The real keys live in `backend/.env`
only (delivered folder) and in Vercel env vars (production).
See SETUP.md §3 for the copy-paste setup.

### SDK / package

- **Package:** `@supabase/supabase-js` `^2.45.0` — already the
  only dependency in `backend/package.json` (verified 15 Nov 2026).
  In the Next.js target the same package is used.
  `Choice:` one client library covers database, auth, and
  storage, so there is no second SDK to learn or to keep in sync.
- **No other Supabase package is needed in the MVP.** Do not add
  `@supabase/ssr` or a realtime package without asking the user
  first (AGENTS.md: no new library without asking).

### Step-by-step setup

1. Create the project (SETUP.md §4.1): org → New project
   `orbitcare`, generated password saved, Region Auto.
2. Run `backend/supabase/schema.sql` once in the SQL Editor —
   expected: `Success. No rows returned`. Four tables: `crew`,
   `baselines`, `daily_readings`, `self_checks`.
3. Copy `.env.example` → `.env`, fill `SUPABASE_URL`,
   `SUPABASE_ANON_KEY` (Publishable), `SUPABASE_SERVICE_ROLE_KEY`
   (Secret), `PORT=3000`. No quotes, no spaces around `=`.
4. `cd backend && npm install` → `npm run seed` — expected:
   `Seeded Supabase: 3 crew, 3 baselines, 540 daily readings.`
5. `npm start`, then `curl http://localhost:3000/api/health`
   — expected: `{"ok":true,"storage":"supabase",
   "dailyReadings":540,"seeded":true}`.
6. In Vercel, add the same three variables as env vars
   (Production + Preview), with the service key marked server-only.

### Which backend files wrap the service

| File | What it does | Who calls it |
|---|---|---|
| `src/lib/supabase/client.ts` (target) / `backend/lib/supabase.js` (delivered) | Creates the client, reads env, `isConfigured()`, `getSupabase({ write })` — write mode uses the service key only when the caller is the server | Only API routes / `server.js` / `seed.js`. Never a page component. |
| `src/lib/services/supabase.ts` (proposed, §1.2) | The service layer over the client: `getCrewStatus(day)`, `getAstronaut(slug, day)`, `getTrends(slug, from, to)`, `saveSelfCheck(...)` — each returning the app's own types | Only the API routes in `src/app/api/`. |
| `supabase/schema.sql` / `backend/supabase/schema.sql` | The schema (4 tables in the delivered folder; 13 in the DATABASE.md target) | Run once by a human in the SQL Editor, never by the app. |
| `scripts/seed-supabase.mjs` (target) / `backend/seed.js` (delivered) | Loads the generated 180-day data, service role only | Run once by a human in a terminal, never by the app, never by an MCP tool (MCP.md §4.2). |

- **The browser never talks to Postgres directly.**
  `Choice:` the API route is the only caller, so RLS and the
  rate limits in API.md §5.4 are enforced in one place.
- **The delivered folder's `server.js` is the wrapper today:**
  7 unversioned endpoints (`GET /api/health`, `POST /api/seed`,
  `GET /api/crew-status`, `GET /api/astronaut/:id`,
  `GET /api/trends/:id`, `GET /api/report`,
  `POST /api/self-check`) — see README.md for the difference
  from the `/api/v1/` target in API.md.

### Webhooks, retries, idempotency, error handling

- **Webhooks: none in the MVP.** Supabase Database Webhooks
  exist, but OrbitCare does not use them — there is no external
  system that needs to be told when a row changes. If V2 adds
  one (for example: "tell Resend when a sync completes"), the
  rule in §10.1 applies: verify the signature, store the event
  id, return 200 fast, process async.
- **Retries:** the fetch wrapper rule (ARCHITECTURE §5) — 5-second
  timeout, **1 retry for network errors only**, never for 4xx.
  A `503` from Supabase is not an error banner: cached data +
  STALE/OFFLINE chip, background retry (API.md §4.4, FEATURES M9).
- **Idempotency:** `Idempotency-Key` is required on
  `POST /self-checks` and `POST /reports` (API.md §3.3). Retrying
  the same key returns the original response, not a duplicate row.
  A second self-check for the same crew-day is a `409 CONFLICT`,
  not a second row (partial unique index, DATABASE.md §2.2).
- **Errors:** a Supabase error is never returned raw. The service
  maps it to the API.md §4 error shape (`SERVICE_UNAVAILABLE`
  + `retryable: true` for a timeout, `VALIDATION_ERROR` for a
  bad value) and logs only the code, never the query or the key.

### Cost, rate limits, fallback

- **Cost:** free tier (researched 11 Nov 2026): 500 MB database,
  50,000 monthly active users. OrbitCare's whole dataset is
  540 readings — the free tier is not a constraint for the demo.
  Verify the current free tier on the Supabase pricing page
  before relying on it for V2.
- **Rate limits (the app's own, API.md §5.4):** anon 60/min,
  authenticated (V2) 300/min, service role 1,000/min per key +
  IP. Over the limit → `429 RATE_LIMITED` + `Retry-After`.
  Debounce slider calls to 200 ms (ARCHITECTURE §8).
- **Fallback if Supabase is down:** the app keeps working from
  the offline cache (localStorage / IndexedDB) — Crew View,
  Dashboard, Trends and Action Plan all load, with the OFFLINE
  chip and a "Last sync" time (FEATURES M9). Writes queue and
  sync when the link returns. The demo path is the offline path:
  the PDF and the Day-63 story do not need a live connection.
  If the outage is long, the fallback is the generated JSON
  (`src/lib/data/mission-data.json` in the target,
  `js/data.js` in the delivered folder) — the app renders from
  it and says so in the footer.
- **What breaks first if it grows:** 540 rows are trivial. The
  first real limit is the free tier's 500 MB if real sensor data
  ever arrives — that is a V2 problem, and the answer then is a
  paid tier, not a re-architecture (ARCHITECTURE §8).

### How to test in sandbox / test mode

- **There is no Supabase "test mode" — the sandbox is a second,
  free project.** Create a project called `orbitcare-test`,
  run `schema.sql` there, seed it, and point a local `.env` at
  it. Never point test code at the demo project.
- **Smoke checks (SETUP.md §6, all verified live 15 Nov 2026):**
  health returns `ok:true`, 540 readings, `seeded:true`; Day 63
  Kenji first, 79 Watch in the delivered code; Day 90 Kenji 95
  Nominal; a self-check POST returns 201 and survives a refresh.
- **Kill-switch test:** stop the backend, open the app — it
  must still render from cache with the OFFLINE chip, not a
  blank screen.

---

## 3. Vercel — hosting and deploy

**Status: MVP deploy target.** ARCHITECTURE §1: "Vercel (Hobby,
free) — push to GitHub, get a live link — the fastest verified
deploy path for Next.js, and the link judges open."

### Why we use it

- **Push to GitHub, get a live link — no server to manage.**
  `Choice:` a deploy that is one push means the team can deploy
  from a phone on Sunday and still make the 15:00 submit.
- **Preview deploys per PR** — a teammate can open a PR's link
  and check Day 63 without running anything locally.
  `Choice:` a link a judge can open is worth more than a local
  screenshot, so every PR gets its own link.
- **Env vars per environment** (Production / Preview /
  Development) — the service key lives only in Production,
  server-only.
  `Choice:` separate values per environment mean a leaked Preview
  key cannot be used against Production (AUTH_SECURITY.md §7.2).

### Required env variables

None in code — Vercel reads its config from the dashboard, not
from a file. The variables it holds are Supabase's (§2) and
`NEXT_PUBLIC_APP_URL` (set after the first deploy; defaults to
the Vercel URL). There is no Vercel API key in the repo.

### SDK / package

None. Vercel is configured in the dashboard and by `vercel.json`
(if the team adds one — not in the repo yet). The deploy is
triggered by a push to `main`, not by code calling Vercel.

### Step-by-step setup

1. Push the repo to GitHub (§4).
2. In the Vercel dashboard: Add New → Project → import the
   repo → Framework Preset: Next.js → Build Command and Output
   Directory left as default.
3. Add env vars (Production): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (server-only), `NEXT_PUBLIC_APP_URL` after the first deploy.
4. Deploy. Open the link in an incognito window (PLAN 9.3) and
   check Day 63 — Kenji worst-first, Watch — before putting the
   link on the Project Tab.
5. Protect `main` in GitHub (§4) so a deploy only happens from a
   reviewed PR.

**For the delivered plain-HTML folder:** Vercel can also serve
static files, but the Node backend (`backend/server.js`) is not
a Vercel Function as delivered — it runs with `npm start` on a
machine. Do not claim the delivered folder is deployed on Vercel
until someone has actually deployed it there and tested the link.
The README says the same thing.

### Which backend files wrap the service

None — there is no Vercel wrapper in code. The "wrapper" is the
deploy configuration: the repo, the env vars, and the CI workflow
(§4). If a Vercel API call is ever needed (for example listing
deploys), it goes in `src/lib/services/vercel.ts`, server-only,
with a token from Vercel env vars — not in the MVP.

### Webhooks, retries, idempotency, error handling

- **Deploy Hooks / webhooks: none in the MVP.** A push to `main`
  is the trigger. If V2 adds a deploy hook, it is a secret URL
  stored in Vercel only, never in the repo.
- **Retries:** a failed build is not retried automatically — the
  team reads the build log, fixes the error, and pushes again.
  `Choice:` retrying a broken build wastes the deploy queue and
  hides the error that caused it.
- **Error handling:** a failed deploy leaves the previous live
  deployment untouched (Vercel keeps the last good deploy).
  `Choice:` that is the fallback — the demo link never goes
  down because a new build failed.

### Cost, rate limits, fallback

- **Cost:** Hobby, $0. Verify the current Hobby limits on the
  Vercel pricing page before relying on them for V2 (bandwidth
  and build minutes are the ones that matter).
- **Fallback if Vercel is down:** the demo link already shared
  is the primary; the fallback is the code zip (the repo backup)
  and a local run (`python3 -m http.server 8000` + `npm start`,
  SETUP.md §5). The submission does not depend on a deploy
  happening on Sunday — submit the link already tested, not a
  fresh one.

### How to test in sandbox / test mode

- **Preview deploys are the sandbox.** Every PR gets a Preview
  URL — open it in incognito, check Day 63, then merge. Never
  test a change by pushing straight to `main`.

---

## 4. GitHub — repo and CI

**Status: MVP.** ARCHITECTURE §1: "GitHub (one repo, `main`
protected)" and "GitHub Actions (CI: typecheck + lint + build +
test)".

### Why we use it

- **One repo for all 4 people; every deploy, PR and demo link
  comes from it.**
- **CI catches a broken build before it reaches Vercel, with no
  extra service to set up.**
  `Choice:` a free, built-in CI is the smallest thing that
  stops a broken push from taking down the demo link.

### Required env variables

None in code. The only credential is a GitHub personal access
token, and only for the MCP GitHub server (MCP.md §2.3) — it
lives in the user's own environment, never in the repo.

### SDK / package

None. CI is the workflow file `.github/workflows/ci.yml`
(typecheck + lint + build + test on every push/PR).
There is no GitHub SDK in the app.

### Step-by-step setup

1. Create the repo (one repo, `main` as the default branch).
2. Protect `main`: require a PR, require CI to pass, require
   one reviewer. No direct pushes to `main` during the hackathon.
3. Add `.github/workflows/ci.yml` (from ARCHITECTURE §2).
4. Push. Check the Actions tab — the first run must be green
   before the first Vercel deploy.

### Which backend files wrap the service

None — GitHub is not called from the app. The wrapper is the
workflow file, and the MCP GitHub server (§ MCP.md) is the only
place an assistant talks to GitHub, with a fine-grained token.

### Webhooks, retries, idempotency, error handling

- **Webhooks:** GitHub → Vercel is a built-in integration, not
  a webhook this project configures. No custom webhook is needed.
- **Retries / idempotency:** not applicable — a push is a push;
  a failed CI run is re-run from the Actions tab after a fix.
- **Errors:** a failing CI blocks the merge (branch protection).
  That is the error handling — it is meant to block.

### Cost, rate limits, fallback

- **Cost:** free for a public repo (including Actions minutes at
  the free tier). Verify the current free minutes on the GitHub
  pricing page if the team adds heavy CI.
- **Fallback if GitHub is down:** the code zip is the repo backup
  (PRD §9: "keep the code zip as the repo backup"). Work
  continues locally; push when it returns.

### How to test in sandbox / test mode

- **A PR is the sandbox.** Open a PR from a `feat/<name>` branch,
  watch CI go green, open the Vercel Preview link, then merge.

---

## 5. File storage — Supabase Storage (V2 option) or S3 (alternative)

**Status: V2 option, not in the MVP.** The PDF is generated
on-device with `@react-pdf/renderer` and downloaded by the user;
no report file is stored on a server (PRD M8, ARCHITECTURE §1.2
decision 4). The `reports` table holds metadata only (DATABASE.md
§2). Add storage only if V2 needs a server copy of a report —
for example, so Earth can fetch a handover PDF without the
astronaut re-generating it.

### Why we would use it (and why not now)

- **Supabase Storage is the default choice:** it is the same
  project, the same keys, and the same RLS as the database.
  `Choice:` one vendor means the report's access rules are the
  same rules as the data's, not a second policy to keep in sync.
- **S3 is the alternative, not a second service:** use it only
  if the team needs storage outside Supabase (for example a
  compliance rule). Never run both — pick one.
  `Choice:` two object stores would be two buckets, two keys,
  and two policies for one file.
- **Not now because:** the MVP's report is a download, not a
  share. Storing it would add a bucket, a bucket policy, a
  signed-URL flow, and a deletion rule — for a feature nobody
  asked for in the hackathon.

### Required env variables

| Variable | Where | Notes |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server only (§2) | Storage uses the same project and the same service key — **no new key** for Supabase Storage. |
| `STORAGE_BUCKET` | `.env` / Vercel env vars | Bucket name, for example `reports`. One bucket for the MVP of this feature. |
| If S3 instead: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Server only, Vercel env vars | All server-only. Never `NEXT_PUBLIC_`. Never in the repo. |

### SDK / package

- **Supabase Storage:** included in `@supabase/supabase-js`
  (already installed, §2) — no new package.
  `Choice:` no new dependency is the cheapest way to add storage.
- **S3:** `@aws-sdk/client-s3` (v3, modular — import only
  `S3Client`, `PutObjectCommand`, `GetObjectCommand`).
  `Choice:` the v3 SDK lets the bundle include only the three
  commands used, instead of the whole AWS SDK.
- **Ask the user first** before adding either package (AGENTS.md:
  no new library without asking).

### Step-by-step setup (Supabase Storage)

1. In the Supabase dashboard → Storage → New bucket `reports`,
   **private** (not public).
2. Add a storage RLS policy: only the service role can write;
   reads are by signed URL only, expiring in 1 hour.
3. Add `STORAGE_BUCKET=reports` to `.env` / Vercel env vars.
4. Implement `src/lib/services/storage.ts` (§5, below) behind
   the interface in §1.3 — `uploadReport(day, pdfBytes)`,
   `getReportUrl(reportId)` (signed URL, 1 hour), and nothing else.
5. Store only the file path in the `reports` table, never the
   file itself and never a public URL.

### Which backend files wrap the service

| File | What it does | Who calls it |
|---|---|---|
| `src/lib/services/storage.ts` (V2, new) | The only file that imports the Storage SDK. Methods: `uploadReport`, `getSignedUrl`, `deleteReport`. Returns the app's own types; throws the API.md §4 error shape. | Only the report API routes (`POST /api/v1/reports`, `GET /api/v1/reports/{id}/download`). |
| `src/app/api/reports/route.ts` (target) | Validates the request, calls `storage.ts`, returns the signed URL — never the file bytes, never a public URL | The frontend (for a download link). |
| `supabase/storage.sql` (V2, new — a migration, not code) | Bucket + storage RLS policies | Run once by a human in the SQL Editor, as a new migration (DATABASE.md §8: never edit a migration that already ran). |

- **The frontend never uploads a file and never holds a bucket
  key.** It asks the API route for a signed URL and downloads
  from it.
  `Choice:` a 1-hour signed URL is the smallest capability that
  still lets a user download a report.

### Webhooks, retries, idempotency, error handling

- **Webhooks: none.** Storage does not need to tell the app
  when a file lands — the API route that uploaded it already
  knows, and it writes the `reports` row in the same request.
- **Retries:** 5-second timeout, 1 retry for network errors
  only. A failed upload is a `503 SERVICE_UNAVAILABLE` with
  `retryable: true` — and the fallback is to generate the PDF
  on-device again, which needs no storage at all.
- **Idempotency:** the object key is deterministic:
  `reports/<mission_id>/<day>/report.pdf`. Uploading the same
  day twice overwrites the same key (upsert), so a retry cannot
  create a duplicate file. The `reports` row is created with an
  `Idempotency-Key` (API.md §3.3), so a retried POST cannot
  create a duplicate row either.
- **Errors:** a missing file is a `404`, not a 500. An expired
  signed URL is a `410` with "Request a new download link" —
  never a stack trace, never the bucket name in the message
  (the bucket name is not a secret, but it is not the user's
  problem either).

### Cost, rate limits, fallback

- **Cost:** Supabase Storage is inside the free tier — check the
  current free storage on the Supabase pricing page. A 4-page
  PDF is tens of kilobytes; storage cost is not a constraint.
  S3 pricing is per GB stored + per request — check the AWS
  pricing page before choosing it.
- **Fallback if storage is down:** generate the PDF on-device
  (the MVP path). The user still gets their report; only the
  server copy is missing, and the `reports` row records that
  (`sync_status: "pending"` until a copy exists).
- **Retention:** a report file is kept until its `reports` row
  is soft-deleted; deleting the row deletes the file. No file
  without a row, no row without a file.

### How to test in sandbox / test mode

- **Use a second bucket, `reports-test`, in the test project
  (§2, sandbox).** Upload a Day-63 PDF, fetch it with a signed
  URL, check it opens and is 4 pages, delete it, confirm the
  signed URL then returns `410`.
- **Kill-switch test:** stop the storage call (or point the
  bucket name at a bucket that does not exist) and download a
  report — the on-device PDF must still download.

---

## 6. Email — Resend (V2 option)

**Status: V2 option, not in the MVP.** The PRD sends no email:
the handover is a PDF the crew downloads (PRD §6 Flow 4), and
there is no digest, no notification, and no "email the report"
feature in the MVP. Add email only if V2 needs one thing: telling
Earth that a handover report is ready when a sync completes.

### Why we would use it (and why Resend)

- **Resend is the choice because:** it is an API-first email
  service with a small SDK, webhook delivery events, and no
  SMTP server to run.
  `Choice:` an API call with a JSON body is easier to test and
  to retry than SMTP, and its delivery events are the audit
  trail for "Earth got the handover".
- **Alternatives considered:** SendGrid (larger, more features
  than this project needs) and Supabase Auth's built-in email
  (only for auth messages — signup, reset, magic link — never
  for app emails).
  `Choice:` Supabase Auth email stays for auth only, so an app
  email cannot be confused with a password reset.

### Required env variables

| Variable | Where | Notes |
|---|---|---|
| `RESEND_API_KEY` | Server only: `.env` (local), Vercel env vars | Starts `re_…`. **Never** in the browser, never in GitHub, never in a chat. |
| `EMAIL_FROM` | `.env` / Vercel env vars | For example `OrbitCare <handover@orbitcare.example>`. Must be a verified domain in Resend, or mail will not send. |
| `EMAIL_TO_EARTH` | `.env` / Vercel env vars | The flight surgeon's address, set per mission. One address in V2, not a mailing list. |

No email key is needed for the MVP, and none is in the repo.

### SDK / package

- **Package:** `resend` (the official SDK). Install only when
  V2 email is approved — ask the user first (AGENTS.md).
  `Choice:` the official SDK is one import, and it is the only
  place the API key is used.

### Step-by-step setup

1. Create a Resend account, add and verify the sending domain.
2. Create an API key (full access is not needed — sending only),
   store it as `RESEND_API_KEY` in Vercel env vars (server-only).
3. Implement `src/lib/services/email.ts` (below) — one method,
   `sendHandoverReady(day, reportUrl)`, and nothing else.
4. Add a Resend webhook for `email.delivered` / `email.bounced`
   (§10.1) so a failed handover email is visible, not silent.
5. Send one test email to the team, from the test project, and
   confirm it arrives before wiring it to a sync.

### Which backend files wrap the service

| File | What it does | Who calls it |
|---|---|---|
| `src/lib/services/email.ts` (V2, new) | The only file that imports `resend`. Method: `sendHandoverReady(day, downloadUrl)` → returns `{ messageId }` or the app's error shape. Never imports a component. | Only the sync API route (`POST /api/v1/sync`), after a successful sync — never a page, never a client component. |
| `src/app/api/sync/route.ts` (target) | After a sync succeeds, calls `email.sendHandoverReady(...)` in the background (fire-and-forget with a log, never blocking the sync response) | The frontend sync action. |
| `src/app/api/webhooks/resend/route.ts` (V2, new) | Receives Resend delivery events, verifies the signature (§10.1), records `delivered` / `bounced` in `sync_log` | Resend's servers only. |

- **The frontend never sends an email.**
  `Choice:` an email sent from the browser would need the API
  key in the browser, which would let anyone send mail as the project.
- **Email is never on the critical path.** The sync returns
  success whether or not the email went out; the email is a
  notification, and a failed email is a log entry, not a failed sync.
  `Choice:` a handover that is ready must not be reported as
  failed because a notification failed.

### Webhooks, retries, idempotency, error handling

- **Webhook (Resend → app):** `email.delivered`, `email.bounced`,
  `email.complained`. Verify the signature with Resend's Svix
  headers before reading the body (§10.1). Store the event id;
  a duplicate delivery is ignored. Return `200` in under 2
  seconds and process after — Resend retries a slow endpoint.
- **Retries (app → Resend):** 5-second timeout, 1 retry for
  network errors only. A `429` from Resend is honoured with its
  `Retry-After`. After that, the email is logged as failed in
  `sync_log` and the sync still succeeds (see above).
- **Idempotency:** one email per sync, keyed by
  `sync_log.id` — the service checks the log before sending, so
  a retried sync cannot send the same handover twice.
- **Errors:** a bad `RESEND_API_KEY` is a startup error, not a
  runtime surprise — the service throws at import time if the
  key is missing. A bounced address is logged and surfaced in
  the sync log, never as an error to the astronaut.

### Cost, rate limits, fallback

- **Cost:** Resend's free tier covers a handover email per sync
  many times over — check the current free tier on the Resend
  pricing page before relying on it. Email is not a cost driver.
- **Fallback if Resend is down:** nothing breaks. The report is
  still generated, still downloadable, and still in `sync_log`;
  the email is retried on the next sync, and the flight surgeon
  can fetch the report from the Project Tab link instead.
  `Choice:` a notification must never be the only copy of the
  thing it notifies about.

### How to test in sandbox / test mode

- **Resend has a test mode:** use the test API key, which
  accepts the call and returns a message id without sending.
  Then send one real email to the team's own addresses from the
  test project, and confirm delivery in the Resend dashboard.
- **Do not test with the flight surgeon's real address** until
  the content of the email has been reviewed by a human.

---

## 7. Libraries that look like integrations but are not services

These are in the stack, but they are code the app bundles — no
account, no key, no network call, no webhook. They are listed
here so nobody adds a service for a job a library already does.

| Library | What it does | Why it stays a library |
|---|---|---|
| `@react-pdf/renderer` | Builds the 4-page PDF report on-device, offline (PRD M8) | The PDF must work with wifi off — a server PDF service would fail the offline requirement. |
| `Recharts` | Trend charts with normal bands (DESIGN §5) | Charts are rendered from data already on the device; no chart service is needed. |
| `Tailwind CSS` | Styling from DESIGN.md tokens | No service involved. |
| Python `scikit-learn` (Isolation Forest) | Validates the generated data offline, in `scripts/validate-forest.py` — never a live service (ARCHITECTURE §1.2 decision 3) | The forest's result is a flag in the data, not a live API call. |

---

## 8. AI / LLM — OpenAI or Anthropic (NOT in the PRD)

**Status: not in the PRD. Do not build.** This section is a
conditional design only, because the user asked for it. If the
team ever decides an LLM is needed, this is the design to use —
and the decision to add it must be made by the user first, with
a PRD update, because it changes the safety story of the product.

### Why the PRD does not need it

- **Flags and action plans are rule-based by design** (PRD M5,
  FEATURES.md M5): every flag has evidence + an action, written
  as rules, so a judge can check exactly why a flag fired.
  `Choice:` a rule can be audited; a language model cannot
  explain why it said what it said.
- **"Doctor chat" is in PRD §10, out of scope**, and diagnosis
  is forbidden everywhere (AGENTS.md, PRD §3). An LLM that
  answers health questions would be a doctor chat.
- **Offline-first forbids it:** the dashboard must work with no
  Earth signal (PRD M9). An LLM API call needs a connection, so
  it can never be on the critical path — at best it is a
  nice-to-have that disappears offline.
- **The MVP already has plain-language text** — written by the
  team, reviewed by a human, and the same for every user. An LLM
  would make it different every time, which is a bug for a
  safety-adjacent product, not a feature.

### If it is ever added: the conditional design

- **Provider: Anthropic Claude (first choice), OpenAI as the
  fallback.** `Choice:` Claude is chosen for its longer context
  and its system-prompt discipline on safety-critical text, and
  because one provider is enough — the service layer (§1) is
  what lets the team swap to OpenAI later without touching a page.
- **What it may do, and only this:** rephrase a rule-generated
  flag explanation into plainer language, and draft a handover
  summary from data the rules already produced. It may not
  generate a new flag, a new score, a diagnosis, or a treatment.
  Every LLM output is shown with "AI-assisted draft — check
  before sending" and a human must approve it before it leaves
  the app.
  `Choice:` the LLM may only polish words the rules already
  wrote, so a hallucination can change a sentence but never a
  medical decision.
- **Where it runs:** server-only, in `src/lib/services/ai.ts`,
  called only by an API route, with the key in Vercel env vars.
  The frontend never calls it directly, and the key never
  reaches the browser.
- **Env variables:** `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`
  if swapped) — server-only, never `NEXT_PUBLIC_`.
- **SDK:** `@anthropic-ai/sdk` (or `openai` if swapped) — one
  import, inside `ai.ts` only.
- **Retries / idempotency:** 10-second timeout (LLM calls are
  slow), 1 retry for network errors only, never for a content
  error. Every call carries an `Idempotency-Key` and is logged
  (prompt hash + response hash, never health data) so a duplicate
  can be detected.
- **Cost:** per-token pricing — check the provider's pricing
  page and set a monthly cap in the dashboard before the first
  call. A runaway prompt (for example a loop re-summarising the
  same day) must hit the cap, not the bill.
- **Rate limits:** the provider's own limits apply; the service
  honours `429` + `Retry-After` and returns a `503` with
  `retryable: true` to the caller.
- **Fallback if the LLM is down:** the rule-based text is shown
  as-is. The user loses nothing — the LLM was only polishing.
  `Choice:` a fallback that is the current system is the only
  fallback that is guaranteed to work.
- **Webhooks:** none.
- **Testing:** use the provider's playground / test key first,
  with a fixed prompt and a fixed expected shape (a summary
  under 200 words, no diagnosis words). Assert the banned words
  (diagnosis, "you have…", treatment) never appear in the
  output — the same test as `flags.test.ts` (PLAN 5.5).

---

## 9. Payments — Stripe or Razorpay (NOT in the PRD)

**Status: not in the PRD. Do not build.** PRD §10 lists
"payments" verbatim as out of scope. OrbitCare has no paid plan,
no checkout, and no price — there is nothing to charge for, and
the demo must be free for judges to open. This section is a
conditional design only, because the user asked for it.

### If a paid plan ever appears: the conditional design

- **Provider: Stripe (first choice), Razorpay as the India
  alternative.**
  `Choice:` Stripe is chosen because the audience is
  international (judges, Tier-1 English-speaking users) and
  Stripe's test mode, webhooks, and docs are the ones the team
  can verify fastest; Razorpay is the right choice only if the
  paying users are in India and need UPI.
- **What it would do, and only this:** a subscription for a
  future paid tier (for example a multi-mission plan). It would
  never gate the health dashboard itself — a payment failure
  must never block an astronaut seeing their own health data.
  `Choice:` a health dashboard that stops working when a card
  fails is a safety bug, not a billing feature.
- **Where it runs:** server-only, in `src/lib/services/payments.ts`,
  called only by API routes. The frontend uses Stripe Checkout
  (a hosted page) or Stripe Elements — it never sees a secret key.
- **Env variables:** `STRIPE_SECRET_KEY` (`sk_test_…` in test,
  `sk_live_…` in production), `STRIPE_WEBHOOK_SECRET`
  (`whsec_…`), `STRIPE_PRICE_ID` for the plan — all server-only,
  never `NEXT_PUBLIC_`. Razorpay equivalent: `RAZORPAY_KEY_ID`,
  `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- **SDK:** `stripe` (the official Node SDK) — one import, inside
  `payments.ts` only. Razorpay equivalent: `razorpay`.
- **Webhooks (§10.1):** Stripe sends `checkout.session.completed`,
  `invoice.payment_succeeded`, `invoice.payment_failed`,
  `customer.subscription.deleted`. Verify the signature with
  the raw body and `STRIPE_WEBHOOK_SECRET` before reading the
  event; store the event id and ignore duplicates; return `200`
  fast and process after. A webhook is the only way a payment is
  recorded — never trust a redirect back to the app as proof
  of payment.
  `Choice:` a redirect can be faked by visiting the URL, while
  a signed webhook cannot, so the webhook is the source of truth.
- **Retries / idempotency:** every Stripe call carries an
  `Idempotency-Key` (a UUID per checkout), so a retried request
  cannot charge twice. Webhook handlers are idempotent by event
  id (see above). A failed webhook is retried by Stripe with
  backoff — the handler must be safe to run twice.
- **Cost:** Stripe's standard fee is a percentage + a fixed fee
  per successful charge — check the current fee on the Stripe
  pricing page for the team's country before quoting it.
  Razorpay's fee is similar — check its pricing page the same way.
- **Fallback if payments are down:** the app stays free. The
  health dashboard, the PDF, and the demo link are unaffected;
  a checkout that fails shows "Payments are unavailable right
  now — try again later" and nothing is charged.
- **Testing:** Stripe **test mode** with test keys (`sk_test_…`)
  and the test card `4242 4242 4242 4242` (any future expiry,
  any CVC) — no real money, ever, in testing. Use the Stripe CLI
  (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`)
  to test webhooks locally. Razorpay test mode is equivalent
  (`rzp_test_…` keys).

---

## 10. Cross-cutting rules — webhooks, retries, idempotency, errors

These rules apply to every integration in this file, not just the
one that inspired them. They are the same rules as API.md §3–§5,
applied outward to providers.

### 10.1 Webhook handling (any provider → app)

1. **Verify the signature first, before reading the body.**
   Stripe: `stripe.webhooks.constructEvent(rawBody, signature,
   STRIPE_WEBHOOK_SECRET)`. Resend: Svix headers. Supabase
   (if ever used): the shared secret in the webhook config.
   `Choice:` a signature is the only proof the event came from
   the provider, so anything unverified is discarded unread.
2. **The raw body must be preserved.** In Next.js, read the
   request as text/buffer (`await req.text()`), not as JSON —
   parsing it first breaks the signature.
   `Choice:` a signature is computed over the exact bytes sent,
   so one re-serialised field invalidates it.
3. **Store the event id, then check for duplicates.**
   Insert into a `webhook_events` table (or `sync_log` for the
   MVP's scale) with the provider event id as the unique key.
   A duplicate delivery returns `200` and does nothing.
   `Choice:` providers retry deliveries, so the handler must be
   safe to run twice — the unique key is what makes it safe.
4. **Return `200` fast, process after.** Acknowledge in under
   2 seconds, then do the work (write the row, send the email).
   `Choice:` a slow endpoint gets retried, and a retried
   webhook is a duplicate the handler then has to survive.
5. **Log the event id + type + time, never the payload.**
   `Choice:` a log without a payload cannot leak the data the
   webhook carried.

### 10.2 Retries

| Error kind | Retry? | How |
|---|---|---|
| Network error / timeout / 5xx from the provider | Yes, **once** | Wait 1 second, retry once, then fail with `retryable: true` |
| `429` from the provider | Yes, after waiting | Honour `Retry-After` (or wait 60 seconds if absent), then retry once |
| 4xx (bad request, unauthorised, forbidden, not found) | **No** | Fail immediately — retrying a bad request cannot fix it |
| A request that already succeeded (unknown) | **No — ask first** | Use the `Idempotency-Key` to ask the provider what happened, instead of re-sending |

- `Choice:` one retry is the ARCHITECTURE §5 rule, and it
  bounds the worst case: a call can take at most two attempts,
  never an unbounded loop.

### 10.3 Idempotency

- **Every POST that creates something carries an
  `Idempotency-Key`** (API.md §3.3) — a client-generated UUID.
  The server stores the key + the response, and a retry with the
  same key returns the stored response.
- **Every provider call that charges, sends, or stores carries
  its own key** (Stripe's idempotency key, Resend's per-sync key,
  the deterministic Storage object key in §5).
- **A reused key with a different body is a `409 CONFLICT`.**
  `Choice:` a conflict is honest — it says "this key was already
  used for something else" instead of silently doing the wrong thing.

### 10.4 Error handling (one shape, everywhere)

- Every service error becomes the API.md §4 shape:
  `{ error: { code, message, details, request_id }, meta }`.
- `message` is plain language, for the user. `details` is for the
  log. Neither ever contains a secret, a key, or a raw provider
  error (a raw Stripe or Supabase error can contain an internal
  id or a query — map it, do not forward it).
- `retryable` is `true` only for the rows in §10.2 that say yes.
  The frontend retries only when `retryable` is `true`.

---

## 11. Integration summary — one table

| Service | Status | Env vars (server-only unless noted) | SDK / package | Wrapper file | Webhook? | Fallback if down |
|---|---|---|---|---|---|---|
| Supabase (Postgres) | **MVP, live** | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY` | `@supabase/supabase-js` ^2.45.0 | `src/lib/services/supabase.ts` / `backend/lib/supabase.js` | No | Offline cache + local JSON |
| Vercel | **MVP** | None in code (dashboard env vars) | None | None (dashboard) | No | Previous good deploy; code zip |
| GitHub + Actions | **MVP** | None in code (PAT only for MCP) | None | `.github/workflows/ci.yml` | No (built-in) | Code zip; push later |
| Supabase Storage | V2 option | `STORAGE_BUCKET` (+ §2 keys) | Built into `supabase-js` | `src/lib/services/storage.ts` | No | On-device PDF |
| Email (Resend) | V2 option | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TO_EARTH` | `resend` | `src/lib/services/email.ts` | Yes (delivery events) | Report still downloadable |
| AI / LLM (Anthropic / OpenAI) | **Not in PRD** | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | `@anthropic-ai/sdk` / `openai` | `src/lib/services/ai.ts` | No | Rule-based text (the MVP) |
| Payments (Stripe / Razorpay) | **Not in PRD** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | `stripe` | `src/lib/services/payments.ts` | Yes (payment events) | App stays free |
| `@react-pdf/renderer` | MVP library | None | `@react-pdf/renderer` | `src/components/report/ReportDocument.tsx` | No | N/A (on-device) |
| Python `scikit-learn` | Seed script only | None | `scikit-learn` | `scripts/validate-forest.py` | No | N/A (offline, not a service) |

---

## 12. Checklist — before adding any integration

- [ ] It is in the PRD (or the user asked for it explicitly, and
      the PRD has been updated first) — AGENTS.md: if it is not
      in the source-of-truth files, ask first.
- [ ] It has a service module in `src/lib/services/` (or
      `backend/lib/` in the delivered folder) — one file, one
      interface, no provider SDK anywhere else.
- [ ] The frontend does not import it, and no secret reaches the
      browser (no `NEXT_PUBLIC_` key that is a secret).
- [ ] Its env vars are placeholders in `.env.example` and real
      values only in `.env` (local) / Vercel env vars (production).
- [ ] Its webhook (if any) verifies the signature, stores the
      event id, returns `200` fast, and is idempotent.
- [ ] Its fallback is written in this file and tested (the
      kill-switch test: the app still works with the service off).
- [ ] Its cost and limits were checked on the provider's pricing
      page, with the date recorded, not copied from memory.
- [ ] It was tested in sandbox / test mode first (§2–§9), never
      against the demo project or a live key.

---

*End of INTEGRATIONS.md v1.0 — 15 Nov 2026. Only Supabase,
Vercel, and GitHub are in the MVP; email and file storage are V2
options; AI/LLM and payments are explicitly out of scope in PRD
§10 and are documented here as conditional designs only, not to
be built. Every integration sits behind a service layer
(`src/lib/services/`, proposed — ARCHITECTURE.md §2 to be updated
if adopted; `backend/lib/` in the delivered folder), and the
frontend never calls a provider directly. No real API key, token,
or secret is in this file — env vars are placeholders only.
Source of truth: PRD > DESIGN > ARCHITECTURE > DATABASE > API.
If this file conflicts with one of those, that file wins.*
