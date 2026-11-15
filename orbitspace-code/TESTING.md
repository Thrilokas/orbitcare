# OrbitCare — TESTING.md

**The full testing plan: what to test, in what order, with what
tools, and how to know it passes.**

**Version:** 1.0 — 15 Nov 2026
**Sources of truth:** `PRD.md` v1.0, `FEATURES.md` v1.0,
`API.md` v1.0, `ARCHITECTURE.md` v1.0, `DATABASE.md` v1.0,
`PLAN.md` v1.0, `SETUP.md` v1.0 (all 15 Nov 2026). If this file
conflicts with any of those, that file wins.
**Status:** plan only. The delivered code folder has **no
automated test suite** (SETUP.md §6: "no automated test suite
exists in the delivered folder; manual smoke checks only").
No test file in this plan exists yet — §9 says how they are
generated, one feature at a time.

---

## 0. The one rule

**Generate the tests for one feature at a time, and make sure
they pass before moving on.** The same rule as FEATURES.md:
build one feature → tick its PLAN tasks only after every
acceptance box passes → stop, show the user the test results,
wait for confirmation before the next feature. A test that is
written but never run is not a test. A feature whose tests are
red is not done, however good the demo looks.

**Test order = build order** (FEATURES.md §1): M10 → M3 → M4 →
M1 → M2 → M5 → M6 → M7 → M8 → M9. The first tests to generate
are M3's (scoring — the pure functions everything else depends
on), after M10's data checks. Do not start M1's tests before
M3 and M4 are green.

---

## 1. Testing tools — chosen, with one line each

| Layer | Tool | Why this one |
|---|---|---|
| Unit (TypeScript) | **Vitest** | It runs the same TypeScript the app is written in, with no separate compiler step, and its API matches the Jest style the team already knows. |
| Unit (Python seed script) | **pytest** | The only Python in the project is `scripts/generate-mission-data.py` and `scripts/validate-forest.py` — pytest is the standard runner for both. |
| Component | **React Testing Library** + Vitest (`@testing-library/react`, `jsdom`) | It tests what the user sees (a flag card with its evidence and action) instead of a component's internals, so a refactor does not break the test. **New library — needs the user's go-ahead first (AGENTS.md: no new library without asking).** |
| API / integration | **Vitest + a test Supabase project** (`orbitcare-test`) | The API talks to real Postgres, so the integration test talks to real Postgres — a mocked database would prove nothing about RLS or the unique constraints. |
| HTTP mocking (unit only) | **MSW** (`msw`) | It intercepts `fetch` at the network level, so the fetch wrapper and the offline fallback can be tested without a server. **New library — needs the user's go-ahead first.** |
| End-to-end | **Playwright** (Chromium, headless) | It drives the real app in a real browser — the same Playwright the MCP browser server uses (MCP.md §2.4) — so an E2E test is the judge's-eye check, automated. |
| Type + lint | **TypeScript (`tsc --noEmit`) + ESLint + Prettier** | A type error is a test failure: CI runs them on every push (ARCHITECTURE §1, PLAN 5.4). |
| API contract | **The API.md error table + a schema check per endpoint** (Vitest, not a separate tool) | Every endpoint must return the documented shape and only the documented error codes — the test asserts the shape, so a drift is caught, not discovered by a judge. |
| Manual smoke | **The SETUP.md §6 checklist** (curl + browser) | For the delivered plain-HTML folder, which has no test runner, the manual smoke checks are the tests until a runner is added. |

**Tools deliberately not chosen:**

- **Jest** is not chosen — Vitest is faster for this stack and
  needs no extra transform config for TypeScript.
  `Choice:` one test runner for unit, component, and API tests
  is simpler to run in CI than two.
- **Cypress** is not chosen — Playwright covers the same ground
  and is already the browser tool in MCP.md.
  `Choice:` one browser tool for testing and for the
  judge's-eye check means one install to maintain.
- **A load-testing tool (k6, Locust) is not chosen.**
  `Choice:` 540 rows and a demo audience do not need load
  testing; a load test would measure a problem that does not exist.

### 1.1 What the delivered folder uses today

- The delivered `orbitspace-code/` folder has **no test runner,
  no test files, and no `test` script** — `backend/package.json`
  has only `seed` and `start` (verified 15 Nov 2026).
- Its tests today are the **manual smoke checks in SETUP.md §6**:
  health `{"ok":true,"storage":"supabase","dailyReadings":540,
  "seeded":true}`, Day 63 Kenji first 79 Watch, Day 90 Kenji
  95 Nominal, a self-check POST, all 5 frontend pages HTTP 200.
- When a runner is added to the delivered folder, the choice is
  **Node's built-in test runner** (`node:test`, no new
  dependency) — because the delivered backend is plain Node
  with no build step, and adding Vitest to it would be a new
  dependency for a folder the team may replace with Next.js.
  `Choice:` the built-in runner tests the folder as it is,
  without changing its stack.
- **Do not run the Next.js test commands in the delivered
  folder.** `npm test`, `npm run test:e2e`, and `npx vitest` do
  not exist there (SETUP.md §0). They exist only in the Next.js
  target, once it is created.

---

## 2. What to test in each layer, with priorities

Critical paths first. A test that guards the demo is worth ten
tests that guard a settings page that does not exist.

### Priority order (test these first, always)

| Priority | What it guards | Why it is first |
|---|---|---|
| **P0 — the demo** | Day-63 detection, worst-first Crew View, the PDF, offline mode | If any of these fail, the submission fails. Nothing else matters until they are green. |
| **P1 — the data** | The seed (540 rows), the baseline (Days 1–21), the unique constraints, RLS | If the data is wrong, every test above it is testing a lie. |
| **P2 — the writes** | Self-check POST (201 / 409), acknowledge, check-off, idempotency | The only writes the browser may make — a duplicate or a lost write is a data bug a judge can trigger in one tap. |
| **P3 — the UI** | Every screen renders, every state (loading / empty / error / offline) exists, no colour-only status | A screen that is blank, or a status that only colour conveys, is a failed demo and a failed accessibility check. |
| **P4 — the edges** | Invalid input, wrong role, network failure, expired token | These are the tests that stop a real user from breaking the app by accident — and an attacker from doing it on purpose. |

### 2.1 Unit tests — the pure functions (Vitest)

**Files:** `src/tests/scoring.test.ts`, `src/tests/flags.test.ts`
(PLAN 5.5, ARCHITECTURE §2). Scoring functions take readings +
baseline and return scores — they never fetch, never touch the
DOM, never read the URL (ARCHITECTURE §6) — so they are the
easiest code in the project to test, and the most important.

| Module | What to test |
|---|---|
| `lib/scoring/baseline.ts` | Mean + SD over Days 1–21; a crew member with 21 identical readings (SD = 0) returns SD 0, not `NaN`; Days 1–21 are the baseline period and are never flagged. |
| `lib/scoring/zscore.ts` | Direction-aware z-score: lower sleep is worse, higher BP is worse, lower HRV is worse; a reading equal to the baseline is z = 0; SD = 0 returns z = 0, never `Infinity`. |
| `lib/scoring/domains.ts` | The 4 domain scores; 3-day smoothing; Watch ≥ 1, Alert ≥ 2; a domain with a missing indicator shows "—" with a reason, never 0; a Nominal domain is never hidden. |
| `lib/scoring/flags.ts` | One flag per indicator per day; every flag has evidence + action (0 flags without an action); the escalation line ("Contact flight surgeon if…") is present on every flag. |
| `lib/scoring/action-plans.ts` | The checklist for a flag; the order (rest / hydrate / light exercise / re-check tomorrow for Kenji Day 63); checking an item off persists. |
| `lib/constants.ts` | `BASELINE_DAYS = 21`, `WATCH_THRESHOLD = 1`, `ALERT_THRESHOLD = 2`, mission length 180 — changing one of these breaks the tests on purpose, so a silent change is impossible. |

### 2.2 Component tests — what the user sees (React Testing Library)

| Component / screen | What to test |
|---|---|
| `CrewCard` / Crew View | Worst-first order in the DOM (not just visually); the status chip text ("Watch", not only its colour); the "Simulated" tag is present; the footer disclaimer is present. |
| `FlagCard` | All four parts render (title, evidence, action, escalation line); a flag without an action does not render at all. |
| `DomainScoreCard` | The score, the reason, and the "—" state for a missing domain. |
| `TrendChart` | The normal band is present; a Watch/Alert marker is present; the text summary ("Sleep is below your baseline for 3 days") is present for screen readers. |
| `SelfCheckForm` | Submit with no mood → inline error, nothing saved; submit complete → toast "Saved — your Sleep & Mind score will update."; the button is disabled while saving (no double-submit). |
| Header / sync chip | LIVE / STALE / OFFLINE renders; "Last sync" text is present; the chip is never a red error banner. |

### 2.3 Integration tests — API + real database (Vitest + `orbitcare-test`)

| Area | What to test |
|---|---|
| Every endpoint (#1–#34) | Returns the documented status, the API.md §4 envelope, `meta` with the disclaimer and `is_simulated: true`, and only the documented error codes. |
| Pagination / filtering / sorting | `page` + `per_page` (default 20, max 100 — over 100 clamps to 100); `status` / `domain` / `mission_day` filters; Crew View is always worst-first. |
| RLS | An anon-key call trying to `UPDATE` a reading gets `403 FORBIDDEN`; a browser call can only `INSERT` a self-check; a soft-deleted row is invisible. |
| Unique constraints | A second self-check for the same crew-day fails; a second flag for the same indicator/day fails; re-running the seed keeps 540 readings. |
| Idempotency | Retrying `POST /self-checks` with the same `Idempotency-Key` returns the original response, not a duplicate; the same key with a different body is a `409 CONFLICT`. |
| Derived endpoints | `GET /trends` has `baseline_low` / `baseline_high` on every point and has no table of its own; `GET /health` has no table and no PRD feature. |
| Error shape | No endpoint returns a raw DB error, a stack trace, or a secret; a `401` and a `403` are distinct (API.md §3.5). |

### 2.4 End-to-end tests — the whole journey (Playwright)

| Journey | What to test |
|---|---|
| The Day-63 demo (P0) | Open Crew View → Kenji is first, Watch → open his Dashboard → Trends shows sleep/HRV leaving the normal band around Day 60–63 → Action Plan lists rest / hydrate / light exercise / re-check tomorrow → download the PDF (4 pages, Kenji 78 Watch with 5 flags in the target; 79 in the delivered code — same band, FEATURES.md §1). |
| The Day-90 recovery | Open Day 90 → Kenji is Nominal; the worst-first order changes. |
| A self-check, end to end | Fill the form → save → toast → Dashboard Sleep & Mind score drops for a bad night, with no reload → refresh → the check is still there ("Saved Day X"). |
| Offline, end to end | Load the app with wifi on → turn wifi off in the browser context → Crew View, Dashboard, Trends and Action Plan all still load from cache with the OFFLINE chip → save a self-check while offline → it shows "Will sync later" → turn wifi on → it syncs, `pending_count` becomes 0. |
| "Jump to Day 63" | One tap sets the slider to 63 on every page. |
| Incognito / judge's eye | Open the deployed link in a fresh incognito context → no login, no error, Day 63 works first time. |

### 2.5 Python tests — the seed and the forest (pytest)

| Script | What to test |
|---|---|
| `scripts/generate-mission-data.py` | Generates exactly 540 readings (180 days × 3 crew); Days 1–21 are the baseline; the 5 injected events are present (Kenji Day-63 infection, solar-particle event, exercise slump, stress period, BP drift); every row has `is_simulated: true`; Kenji Day 63 sleep is 5.2h (target Python generator, DATABASE §9; the delivered JS generator gives 6.5h — see §3.2). |
| `scripts/validate-forest.py` | The Isolation Forest flags the Day-63 event and does not flag the baseline period; if the forest and the z-scores disagree, both are reported (the disagreement is data, not an error to hide). |
| `scripts/seed-supabase.mjs` / `backend/seed.js` | Run twice → still 540 readings (upserts, never duplicates); a second run does not fail on the unique constraints. |

---

## 3. Test case tables — one per feature

Each table is drawn from that feature's acceptance checklist in
FEATURES.md. A row is one test. "Layer" is where it runs:
U = unit, C = component, I = integration, E = E2E, P = Python.

### 3.1 M10 — Simulated data, clearly labelled (test first)

| # | Scenario | Input | Expected result | Layer |
|---|---|---|---|---|
| M10-1 | Full seed counts | Run the seed | 1 mission, 3 crew, 42 baselines, 540 readings, 2,160 domain scores | I / P |
| M10-2 | Kenji Day 63 sleep | `daily_readings` for Kenji, day 63 | Sleep is below the baseline mean and the sleep flag fires (5.2h is the PRD/DATABASE target; the delivered JS seed gives 6.5h vs a 7.5h baseline mean — the band is the contract, see `backend/tests/scoring.test.js`) | I / P |
| M10-3 | Every event is detectable | The 5 injected events | Each event is flagged by M3 (a missed event is a seed bug, not a detector bug) | P |
| M10-4 | No real data | Query `is_simulated = false` | 0 rows | I |
| M10-5 | Re-seed is safe | Run the seed twice | Still 540 readings, no duplicates | I |
| M10-6 | Labelling on every screen | Open each page | `SIMULATED DATA` tag in the header + footer disclaimer on every page | C / E |
| M10-7 | Reference APIs | `GET /missions`, `/indicators`, `/domains` | The reference rows are returned | I |
| M10-8 | README disclosure | Read the README | AI disclosure, data sources, "not a medical device / synthetic data only" are present | — (manual) |

### 3.2 M3 — Personal-baseline anomaly detection (test second)

| # | Scenario | Input | Expected result | Layer |
|---|---|---|---|---|
| M3-1 | Baseline is Days 1–21 | Kenji's 21 baseline readings | Mean + SD computed from those 21 days only | U |
| M3-2 | Day ≤ 21 is never flagged | A reading on Day 10, far from the mean | No flag — it is the baseline period | U |
| M3-3 | Direction-aware z-score | Sleep 5.2h vs baseline 7.4h; HR 74 vs baseline 62; HRV 52 vs baseline 68 (delivered indicators are hr, hrv, sleep, spo2, bone — there is no BP indicator in the delivered code) | Sleep z is positive-and-bad, HR z is positive-and-bad, HRV z is positive-and-bad — all flag, in the right direction | U |
| M3-4 | SD = 0 | 21 identical readings, then a different one | Reading equal to the mean → z = 0; a different reading → a finite z from the SD floor (`effSd = max(sd \|\| 1, floor)`), never `NaN` or `Infinity` | U |
| M3-5 | A missing reading | No row for Kenji Day 50 | No flag for that day; the gap is reported, not filled with an invented value | U |
| M3-6 | Day-63 detection | Kenji Day 63 readings | Watch, score 78 (target) / 79 (delivered code) — same Watch band; the band is the contract, the point is not | U / I |
| M3-7 | Forest vs z-score disagreement | An event the forest flags but z-scores do not (or the reverse) | Both results are shown, not hidden | U / P |
| M3-8 | Recompute is idempotent | `POST /admin/scoring/recompute` twice (service role) | Same scores both times; anon → `403` | I |
| M3-9 | Baseline API | `GET /crew-members/kenji/baselines` | The 14 baselines, with mean + SD each | I |

### 3.3 M4 — 4 domain scores

| # | Scenario | Input | Expected result | Layer |
|---|---|---|---|---|
| M4-1 | Domain coverage | Kenji Day 63 | Heart 70, Bone 89, Sleep 70, Immune 86 (delivered values — the band is the contract, see M3-6) | U |
| M4-2 | 3-day smoothing | A one-day spike in HR | The domain score moves by less than the raw spike (smoothed) | U |
| M4-3 | Missing domain | A domain with no indicator data that day | "—" + a reason, never 0, never hidden (delivered `domainScores()` returns NaN here — documented gap, `backend/tests/domains.test.js`; the UI must render "—" for a non-finite score) | U / C |
| M4-4 | A Nominal domain is never hidden | All 4 domains Nominal | All 4 cards render | C |
| M4-5 | Smoothing window edges | Day 22 and Day 180 | Scores compute correctly with a partial window | U |
| M4-6 | Domain scores API | `GET /crew-members/kenji/domain-scores/63` | The 4 scores for that day | I |
| M4-7 | Every domain score has its reason | Render a `DomainScoreCard` | The reason ("Sleep is below your baseline for 3 days") is shown (UI rule — `domainScores()` returns numbers only, so this is a component test, not a scorer test) | C |

### 3.4 M1 — Crew View (worst-first)

| # | Scenario | Input | Expected result | Layer |
|---|---|---|---|---|
| M1-1 | Worst-first, Day 63 | `?day=63` | Kenji first, Watch; DOM order = visual order | U / C / E |
| M1-2 | Sorting rule | Two crew in Watch, scores 79 and 85 | The 79 comes first; a tie breaks by name | U |
| M1-3 | Day 90 order | `?day=90` | Kenji is no longer first (he is Nominal); the order changes | E |
| M1-4 | Day clamped | `?day=0` and `?day=200` | Clamped to 1 and 180; the UI shows the clamped day | C / I |
| M1-5 | Unknown slug | `GET /crew-members/unknown` | `404 NOT_FOUND` | I |
| M1-6 | All Nominal | A day with no flags | "All crew Nominal today." | C |
| M1-7 | Non-integer day | `?day=abc` | Day 1 (no crash, no blank screen) | C |
| M1-8 | Loading | Slow network (throttled) | Skeleton crew cards while fetching | C |
| M1-9 | Never-seeded | Empty database | "No mission data yet — run the seed" (not a crash, not fake data) | C / I |
| M1-10 | Offline | Wifi off, cached data | Crew View loads from cache with the OFFLINE chip | E |

### 3.5 M2 — Astronaut Dashboard

| # | Scenario | Input | Expected result | Layer |
|---|---|---|---|---|
| M2-1 | Two-minute check | Open Kenji Day 63 | Vitals table (vital \| today \| baseline \| change), 4 domain scores, active flags, all visible without scrolling past the fold | E |
| M2-2 | Z-score in mono | The vitals table | Every value shows its baseline and its z-score in IBM Plex Mono | C |
| M2-3 | Unknown slug | `GET /crew-members/unknown` | `404 NOT_FOUND` | I |
| M2-4 | Missing reading | No row for that crew-day | "No reading for Day X." (not a zero, not a crash) | C / I |
| M2-5 | SD = 0 baseline | A baseline with SD 0 | z = 0, no `NaN` in the table | U |
| M2-6 | No flags | A Nominal day | "No flags today — all Nominal." | C |
| M2-7 | Actions already taken | A flag Amara acknowledged | The Dashboard shows it as acknowledged, with when | C / I |
| M2-8 | Offline | Wifi off | Dashboard loads from cache | E |
| M2-9 | Dashboard APIs | `GET /crew-members/kenji`, `/baselines`, `/domain-scores/63`, `/readings/63` | Each returns the documented shape | I |

### 3.6 M5 — Plain-language flags + action plans

| # | Scenario | Input | Expected result | Layer |
|---|---|---|---|---|
| M5-1 | Kenji Day 63 flag count | Day 63 flags | ≥ 3 flags; in the PDF example, 5 flags | U / I |
| M5-2 | 0 flags without an action | Every flag in the database | Each has evidence + action + escalation line; a flag without an action cannot be created (test enforces it) | U |
| M5-3 | Flag card completeness | Render a `FlagCard` | Title, evidence, action, escalation line all render; a flag without an action does not render | C |
| M5-4 | Action Plan content | Kenji Day 63 plan | Rest / hydrate / light exercise / re-check tomorrow | E |
| M5-5 | Acknowledge | `PATCH /flags/{id}` with `{"is_acknowledged": true}` | Returns `is_acknowledged: true` with a timestamp; a second PATCH is idempotent (same flag, not an error) | I |
| M5-6 | Check off an item | `PATCH /action-plan-items/{id}` | Persists on refresh | I / E |
| M5-7 | Mark all done, one failure | All items, one check-off fails | The others still save; the failed one shows an inline error with Retry | C |
| M5-8 | No active flags | A Nominal day | "No actions needed today." | C |
| M5-9 | No diagnosis language | Every flag + action text | The words "diagnosis" / "you have…" never appear (enforced by `flags.test.ts`) | U |
| M5-10 | Offline check-off | Wifi off, check an item | Saves locally, shows "Will sync later", syncs when the link returns | E |

### 3.7 M6 — Trends

| # | Scenario | Input | Expected result | Layer |
|---|---|---|---|---|
| M6-1 | Day 60–63 drift | Kenji 30-day sleep/HRV chart | The line leaves the normal band around Day 60–63 | E |
| M6-2 | 7 / 30-day switch | Toggle the segmented control | Re-renders without a reload; the slider position is kept | C / E |
| M6-3 | Baseline band in the API | `GET /trends?crew_slug=kenji&from_day=34&to_day=63` | Every point has `baseline_low` / `baseline_high` | I |
| M6-4 | "What changed" | The selected range | 3 plain-language bullets, generated from the flags (not hand-written) | C |
| M6-5 | Jump to Day 63 | Tap the chip | The slider is set to 63 in one tap | E |
| M6-6 | Missing reading | A gap in the range | The line breaks (a gap), never an invented value; the text summary names the gap | C |
| M6-7 | Invalid range | `from_day=70&to_day=60` | `400` + plain-language message, and the UI shows the designed empty state | I / C |
| M6-8 | Baseline period | Days 1–21 in the range | The line is inside its own band with "Baseline period" text, never a flag marker | C |
| M6-9 | Offline | Wifi off | Charts load from cache with the OFFLINE chip | E |
| M6-10 | Not colour-only | The chart + markers | Markers + labels + text summary are present (not colour alone) | C |

### 3.8 M7 — Daily self-check

| # | Scenario | Input | Expected result | Layer |
|---|---|---|---|---|
| M7-1 | Missing mood | Submit with sleep only | Inline error, nothing saved | C / I |
| M7-2 | Complete submit | Sleep 6h, mood 3, stress 2, no symptoms | Toast "Saved — your Sleep & Mind score will update." + return to Dashboard; "Saved Day X" survives a refresh | C / E |
| M7-3 | POST returns 201 | `POST /crew-members/kenji/self-checks` | `201`, `sync_status: "pending"` | I |
| M7-4 | Duplicate day | A second POST for the same crew-day | `409 CONFLICT` | I |
| M7-5 | Edit (PATCH) | Edit the Day-63 check | Returns the updated check, `sync_status` reset to `"pending"` | I |
| M7-6 | Withdraw (DELETE) | Delete the Day-63 check, then POST again | Soft delete; a new check can be created for that day | I |
| M7-7 | Score updates, no reload | Log a bad night for Kenji | His Sleep & Mind score drops on the Dashboard immediately, no reload | E |
| M7-8 | Offline save | Wifi off, submit a check | Saves locally, shows "Saved — Day X", syncs when the link returns | E |
| M7-9 | Validation | Mood 0, mood 6, sleep 25h, notes 501 chars | Each is a `400` with a plain-language message (never a silent clamp in the target API) | I |
| M7-10 | Idempotency | Retry the POST with the same `Idempotency-Key` | The original response, not a duplicate row | I |

### 3.9 M8 — PDF health report

| # | Scenario | Input | Expected result | Layer |
|---|---|---|---|---|
| M8-1 | Day-63 PDF | Download on Day 63 | `OrbitCare-Day-63-report.pdf`, 4 pages, Kenji 78 Watch with 5 flags (target), every flag with its full explanation | E |
| M8-2 | Page contents | The 4 pages | Page 1: crew at a glance. Page 2: per-astronaut scores. Page 3: vitals vs baseline + flags. Page 4: complete action plan + disclaimer + AI disclosure | E |
| M8-3 | Footer on every page | The PDF | "Simulated data only · Decision support only · Not a medical device" + page number, on all 4 pages | E |
| M8-4 | Speed + offline | Wifi off, tap Download | The PDF is generated on-device in < 10 seconds, with wifi off | E |
| M8-5 | Report APIs | `POST /reports` → `201`; `GET /reports/{id}/download` | `application/pdf` when a server copy exists, otherwise the documented `404` (generate on-device) | I |
| M8-6 | A quiet day | A day with no flags | Page 3 says "No flags on Day X — all Nominal." Still 4 pages, never 3 | E |
| M8-7 | No data for the day | Tap Download with no data | Inline error, no download, no empty file | C / E |
| M8-8 | Generation fails | Force a failure (mock) | "The PDF couldn't be created. Try again — your data is still here." + Retry; the button is never silently dead | C |
| M8-9 | No diagnosis language | The PDF text | No diagnosis language anywhere in the document | U / E |
| M8-10 | File name | Any day | Always `OrbitCare-Day-<day>-report.pdf`, never `report.pdf` | E |

**M8 in the delivered folder is not done:** the delivered
report is a `.txt` file, not a PDF (README.md, SETUP.md).
M8-1 to M8-10 fail against the delivered folder by design —
they are the tests that prove the PDF target is not yet met.
Do not change the tests to match the `.txt`.

### 3.10 M9 — Offline-first + sync

| # | Scenario | Input | Expected result | Layer |
|---|---|---|---|---|
| M9-1 | Wifi off, all pages | Kill the network, open each page | Crew View, Dashboard, Trends, Action Plan all load from cache with the OFFLINE chip + "Last sync" text | E |
| M9-2 | Sync after reconnect | A queued self-check, wifi back on | `GET /sync/status` returns `live` with `pending_count: 0` | I / E |
| M9-3 | Sync log row | After a sync | `sync_log` has a row with `sync_status: "synced"` | I |
| M9-4 | Write while offline | A self-check while offline | Saves locally, survives a refresh, shows "Will sync later" | E |
| M9-5 | 3 failed syncs | Fail the sync 3 times | The header shows "N items waiting to sync" — no error banner, no retry loop | C / E |
| M9-6 | RLS blocks a browser write | Anon key, `UPDATE daily_readings` | `403 FORBIDDEN` | I |
| M9-7 | First load from cache | Open the app (cached) | Renders in < 1 second; a background sync never blocks the UI | E |
| M9-8 | First run, never synced | Empty cache, no sync ever | "No mission data yet — run the seed" (once; never again after the first sync) | C |
| M9-9 | A 503 is not a red banner | Supabase unreachable | Cached data + STALE/OFFLINE chip, background retry | C / E |
| M9-10 | Conflicting edits | The same self-check edited on two devices | Last-write-wins by `updated_at`; the losing edit is kept in `sync_log` with `sync_status: "failed"` and a note — never silently overwritten | I |

---

## 4. Edge cases and negative tests

### 4.1 Invalid input (every endpoint, every form)

| # | Input | Expected |
|---|---|---|
| N-1 | `mission_day` = 0, 181, -5, 1.5, `"abc"` | `400 VALIDATION_ERROR`, plain-language message |
| N-2 | `per_page` = 0, 101, `"abc"` | 0 → `400`; 101 → clamped to 100 and noted in `meta`; `"abc"` → `400` |
| N-3 | `sort_by` = a column the endpoint does not document (for example `password`) | `400` — never build SQL from it |
| N-4 | A body that is not JSON, or `Content-Type` is not `application/json` | `400 INVALID_JSON` |
| N-5 | An unknown field in a body (for example `diagnosis: "flu"` on a self-check) | `400 VALIDATION_ERROR` — unknown fields are rejected, not ignored |
| N-6 | A UUID that is not a UUID (`GET /flags/not-a-uuid`) | `400`, not a 500 |
| N-7 | A self-check with mood 0, mood 6, sleep 25h, notes 501 chars | `400` each (see M7-9) |
| N-8 | An empty body on a POST that requires one | `400 VALIDATION_ERROR`, naming the missing fields |
| N-9 | `from_day` > `to_day` on `GET /trends` | `400` + the designed empty state, not a broken chart |
| N-10 | A crew slug containing `/`, `..`, or a quote | `400` / `404`, never a path traversal |

### 4.2 Unauthorized access (V2 roles, and the MVP's RLS)

| # | Input | Expected |
|---|---|---|
| N-11 | No `apikey` header at all | `401 UNAUTHENTICATED` |
| N-12 | A valid anon key, wrong role (V2: astronaut reading another astronaut's dashboard) | `403 FORBIDDEN` — not `401` (API.md §3.5) |
| N-13 | A valid token but no `profiles` row (V2) | `403 FORBIDDEN` |
| N-14 | Anon key trying to `UPDATE` / `DELETE` a reading, a score, a flag, or a baseline | `403 FORBIDDEN` (RLS, DATABASE.md §7) |
| N-15 | `DELETE /daily_readings/{id}` (history is immutable) | `405 METHOD_NOT_ALLOWED` |
| N-16 | An astronaut trying to acknowledge a flag (V2: only a medical officer may) | `403 FORBIDDEN` |
| N-17 | A flight surgeon asking for unsynced rows (V2) | Only `sync_status = 'synced'` rows are returned; the rest are invisible |
| N-18 | An expired access token that cannot be refreshed (V2) | `401 UNAUTHENTICATED` |
| N-19 | A service-role key sent from the browser | The request is rejected — the service key must never arrive from a browser (AUTH_SECURITY.md §3) |
| N-20 | A soft-deleted self-check, read directly | `404 NOT_FOUND` — it is invisible to the app |

### 4.3 Network failure and service failure

| # | Input | Expected |
|---|---|---|
| N-21 | Supabase unreachable (timeout after 5s) | `503 SERVICE_UNAVAILABLE` with `retryable: true`; the client shows cached data + STALE/OFFLINE chip, not a red banner |
| N-22 | Supabase returns a 500 | The API returns `500 SERVER_ERROR` with the fixed message "Something went wrong. Your saved data is safe — try again." — never the raw DB error |
| N-23 | The network drops mid-page | The page keeps showing the cached data; the chip flips to OFFLINE; nothing disappears |
| N-24 | A sync fails 3 times | The queue stops, the header shows "N items waiting to sync", no retry loop (M9-5) |
| N-25 | Rate limit hit (61st request in a minute, anon) | `429 RATE_LIMITED` + `Retry-After`; the client backs off and retries once after that time |
| N-26 | A `429` with no `Retry-After` from a provider | Wait 60 seconds, retry once, then fail with `retryable: true` (INTEGRATIONS.md §10.2) |
| N-27 | Vercel deploy fails | The previous good deploy stays live; the demo link does not go down |
| N-28 | The PDF generator fails (mocked) | Inline error + Retry; the button is never silently dead (M8-8) |

---

## 5. Test data and mocking strategy

### 5.1 The data is the test fixture

- **The seed data is the test data.** The same generated
  180 days × 3 crew that the demo uses is what the tests assert
  against — so a test failure means the demo would fail too.
  `Choice:` one dataset for demo and tests means there is no
  second dataset to keep in sync.
- **The deterministic fixtures** (checked into the repo as JSON,
  under `src/tests/fixtures/` in the target):
  - `day63-kenji.json` — Kenji's Day-63 readings, baselines, and
    the expected scores (78 Watch in the target, 79 in the
    delivered code — the fixture stores the band, not only the point).
  - `day90-kenji.json` — Kenji recovered, Nominal.
  - `baseline-kenji.json` — Kenji's 21-day baseline (mean + SD
    per indicator).
  - `empty-day.json` — a crew-day with no reading.
  - `zero-sd-baseline.json` — 21 identical readings (SD = 0).
  `Choice:` a fixture file is deterministic — the same input
  gives the same expected output on every machine, on every run.
- **Never use real health data in a test.** All fixtures are
  simulated and labelled, like the app data. A test that needs
  "a realistic patient" is a test that should not be written.
- **The test project is `orbitcare-test`** (a second, free
  Supabase project). Integration tests run against it, never
  against the demo project. The test project is seeded from the
  same generator, and it is re-seeded before the integration
  suite runs, so a test never depends on another test's leftovers.
  `Choice:` a separate project means a test can delete and
  re-seed freely without touching the demo.

### 5.2 What is mocked, and what is never mocked

| Thing | Mocked in unit tests? | Mocked in integration / E2E? | Why |
|---|---|---|---|
| The Supabase client | Yes — a fake that returns the fixture JSON | **No** — the real `orbitcare-test` project | A unit test proves the logic; an integration test proves the database, RLS, and constraints — a mock would prove none of those. |
| `fetch` (the API client) | Yes — MSW, returning fixture responses | **No** — the real API routes | The offline fallback is a property of the real wrapper, not of a mock. |
| The clock / mission day | Yes — the day is a parameter, never `Date.now()` in scoring code | Yes — Playwright sets `?day=63` in the URL | Time is an input, so a test can set it; a test that depends on today's date is flaky by design. |
| The network (offline) | Yes — MSW returns a network error | Yes — Playwright's offline mode (`context.setOffline(true)`) | Offline must be tested as a real browser state, not as a mocked error. |
| The PDF generator | Yes in unit (a stub that records it was called) | **No** in E2E — the real `@react-pdf/renderer` output, opened and counted (4 pages) | A stub PDF cannot prove the real document has 4 pages. |
| The LLM / email / payments (V2) | Yes — always stubbed, never called | **No live calls, ever** in a test | A test must never send a real email, charge a real card, or call a real LLM — test mode / stubs only (INTEGRATIONS.md §6/§8/§9). |

- **A mock is named for what it replaces** (`mockSupabase`,
  `mockFetch`), and a test that uses one says so in its name.
  `Choice:` a hidden mock is a test that lies about what it proved.
- **No test depends on the order tests run in.** Each test
  creates its own data (or uses the re-seeded project) and
  cleans up after itself.
  `Choice:` order-dependent tests fail one run in ten, and the
  team stops trusting the suite.

---

## 6. Coverage targets

| Area | Target | Why that number |
|---|---|---|
| `src/lib/scoring/` (baseline, z-score, domains, flags, action plans) | **100% lines and branches** | This is the code that decides Watch vs Nominal. A branch not covered is a case never checked — including the SD = 0 branch. |
| `src/lib/api/` (fetch wrapper, error mapping) | **100% lines** | One missed branch is a network failure the app handles wrong. |
| API routes (`src/app/api/`) | **≥ 90% lines** | Every endpoint's happy path and its documented errors must be covered; the uncovered 10% is defensive code that is hard to trigger. |
| Components | **≥ 80% lines** | The states (loading / empty / error / offline) matter more than every line of JSX. |
| Whole project (Next.js target) | **≥ 80% lines, ≥ 70% branches** | A floor, not a goal — coverage is a check that the tests exist, not a proof the app is correct. The Day-63 E2E is the proof. |
| Python scripts | **≥ 80% lines** | The generator and the forest validator shape the data every other test trusts. |

- **Coverage is measured, not guessed:** `npm run test:coverage`
  (§7) prints the table and fails the build if a target is missed.
- **A coverage number is never faked:** no `/* istanbul ignore */`
  on scoring code, no excluding a file to hit the target.
  `Choice:` an honest 78% that the team can see is more useful
  than a gamed 90%.
- **The delivered folder has no coverage target yet** — it has
  no runner. Its coverage is the manual smoke checklist in
  SETUP.md §6, run by a human, until a runner is added (§1.1).

---

## 7. Commands — run everything

These commands are for the **Next.js target**, once it exists.
They do not exist in the delivered folder (SETUP.md §0) — see
§7.4 for what to run there instead.

### 7.1 Every day (while building)

```bash
npm run test:unit        # Vitest, unit + component, watch mode off
npm run test:unit -- src/tests/scoring.test.ts   # one file, while working on it
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint + Prettier check
```

### 7.2 Before a PR

```bash
npm run test             # unit + component + integration (against orbitcare-test)
npm run test:e2e          # Playwright, Chromium headless
npm run test:coverage     # Vitest with coverage; fails if a target in §6 is missed
npm run build             # Next.js build — must pass before the PR is opened
```

### 7.3 In CI (GitHub Actions, PLAN 5.4)

```yaml
# .github/workflows/ci.yml — typecheck + lint + build + test, on every push/PR
# (ARCHITECTURE §1, §2). The CI job runs, in order:
#   1. npm ci
#   2. npm run typecheck
#   3. npm run lint
#   4. npm run test            # unit + component + integration
#   5. npm run test:e2e        # Playwright
#   6. npm run build
# A PR cannot merge to main unless every step is green.
# The integration step needs ORBITCARE_TEST_* env vars as
# GitHub Actions secrets — never as plain text in the workflow file.
```

### 7.4 In the delivered folder (no runner yet)

```bash
cd backend && npm run seed    # re-seed the test project (or the demo project, deliberately)
npm start                      # backend on :3000
curl http://localhost:3000/api/health
# Expected: {"ok":true,"storage":"supabase","dailyReadings":540,"seeded":true}
python3 -m http.server 8000   # frontend, in the repo root
# Then open http://localhost:8000/, click Day 63 — Kenji first, Watch.
# Day 90 — Kenji Nominal. Wifi off — the app still works.
# That is the smoke suite, from SETUP.md §6, until a runner is added.
```

### 7.5 The `package.json` scripts to add (target)

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run src/tests src/lib",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . && prettier --check .",
    "build": "next build"
  }
}
```

- `Choice:` one command per layer means a developer can run
  the layer they just changed without running the whole suite,
  and CI can run all of them with one word each.

---

## 8. Manual QA checklist — pre-release

Run this by hand, on the deployed link, in an incognito window,
before the Project Tab submit (PLAN 9.3–9.4). A human does this
because no automated test can judge whether the app *looks*
right to a stranger.

### 8.1 The demo (do this first)

- [ ] Open the deployed link in incognito. It loads, no login,
      no error, no blank screen.
- [ ] Crew View, Day 63: Kenji is first, Watch. The other two
      are below him, in the right order.
- [ ] Open Kenji: the vitals table shows today vs baseline vs
      change, with z-scores. The 4 domain scores are visible.
      The flags each have evidence + an action.
- [ ] Trends: the 30-day sleep/HRV line leaves the normal band
      around Day 60–63. Switch to 7-day — it re-renders.
- [ ] Action Plan: rest / hydrate / light exercise / re-check
      tomorrow. Check one item off — it stays checked on refresh.
- [ ] Download the PDF: 4 pages, Kenji 78 Watch with 5 flags
      (target), footer disclaimer on every page.
- [ ] Day 90: Kenji is Nominal.
- [ ] "Jump to Day 63" works from every page.

### 8.2 Offline

- [ ] Load the app, then turn wifi off: every page still loads,
      OFFLINE chip shows, "Last sync" is visible.
- [ ] Save a self-check with wifi off: it saves, shows
      "Will sync later", and syncs when wifi returns.
- [ ] Download the PDF with wifi off: it works, in under 10 seconds.

### 8.3 The rest of the app

- [ ] Every page has the `SIMULATED DATA` tag and the footer
      disclaimer ("Simulated data only · Decision support only ·
      Not a medical device").
- [ ] No page has diagnosis language. No page says "patient".
- [ ] How It Works explains the product to a stranger in under
      a minute (read it as a judge would).
- [ ] The app is usable by keyboard alone (Tab through the
      Crew View, open a Dashboard, submit a self-check).
- [ ] Reduced motion: with `prefers-reduced-motion` on, nothing
      animates that should not.
- [ ] Mobile width (390px): nothing overflows, nothing is cut off,
      the slider is usable.

### 8.4 The submission

- [ ] The README has the AI disclosure, the data sources, and
      the "not a medical device / synthetic data only" line.
- [ ] The demo link is public, needs no password, and opens in
      incognito.
- [ ] The 7-slide PPT (or the 30-sec video — one, not both at
      the last minute) is ready, with the same numbers as the app.
- [ ] The code zip is the repo backup, and it has no `.env` and
      no `node_modules` in it.
- [ ] The submit time is ~15:00 IST Sunday, before the 16:00
      gates close — not the 11:59 PM outer bound.

---

## 9. How the tests get written — one feature at a time

1. **Pick the next feature in the build order** (§0): M10,
   then M3, then M4, then M1, M2, M5, M6, M7, M8, M9.
2. **Write only that feature's tests** — from its table in §3
   and its acceptance checklist in FEATURES.md. Do not write
   the next feature's tests "while you are here".
3. **Run them. They must pass before moving on.**
   A red test is not a reason to start the next feature — it is
   the work. Fix the code or the test (and say which one was
   wrong), re-run, and only then move on.
4. **Tick the PLAN tasks for that feature only** — the same
   tasks FEATURES.md lists for it — and only after every
   acceptance box passes.
5. **Stop and show the user the results** — the test output,
   the Day-63 numbers, and a screenshot — then wait for
   confirmation before the next feature.
6. **If a test cannot be written** (for example M8's PDF tests
   against the delivered folder, which has no PDF — §3.9),
   say so in the chat instead of weakening the test. A test
   that is skipped silently is worse than a test that is
   honestly blocked.

**Where the test files live (target):**

```
src/tests/
  ├── fixtures/                 # day63-kenji.json, day90-kenji.json, ...
  ├── scoring.test.ts           # M3 (baseline, z-score, thresholds, Day-63)
  ├── flags.test.ts             # M5 (every flag has evidence + action)
  ├── domains.test.ts           # M4
  ├── crew-view.test.ts         # M1
  ├── dashboard.test.ts         # M2
  ├── trends.test.ts            # M6
  ├── self-check.test.ts        # M7
  ├── report.test.ts            # M8 (PDF)
  ├── offline.test.ts           # M9 (cache, sync queue, OFFLINE chip)
  ├── seed.test.ts              # M10 (counts, events, is_simulated)
  └── smoke.test.ts             # Day 63 worst-first; Day 90 Nominal (PLAN 5.5)
e2e/
  ├── demo-day63.spec.ts        # the Day-63 journey (§2.4)
  ├── self-check.spec.ts
  └── offline.spec.ts
scripts/
  ├── test-generate-data.py     # pytest, M10 (§2.5)
  └── test-validate-forest.py   # pytest, M3 (§2.5)
```

- **PLAN 5.5 names three files** (`scoring.test.ts`,
  `flags.test.ts`, `smoke.test.ts`) — those three are the minimum
  the plan requires. This file adds one test file per feature,
  so that a feature's tests live with that feature's name and
  can be run alone (`npm run test:unit -- src/tests/scoring.test.ts`).

---

*End of TESTING.md v1.0 — 15 Nov 2026. Tools: Vitest (unit /
component / integration), pytest (Python seed + forest),
Playwright (E2E), TypeScript + ESLint (CI). Priorities: P0 the
demo, P1 the data, P2 the writes, P3 the UI, P4 the edges.
85 acceptance checkboxes from FEATURES.md are the test cases in
§3; the negative tests in §4 cover invalid input, unauthorized
access, and network failure. The delivered folder has no test
suite yet — its tests are the SETUP.md §6 manual smoke checks
until a runner is added. Tests are generated one feature at a
time, in build order, and must pass before the next feature
starts. Source of truth: PRD > DESIGN > ARCHITECTURE > DATABASE
> API. If this file conflicts with one of those, that file wins.*
