# OrbitCare — Implementation Roadmap (PLAN.md)

**Version:** 1.0 — 15 Nov 2026
**Sources of truth:** `PRD.md` v1.0, `ARCHITECTURE.md` v1.0, `DATABASE.md` v1.0, `API.md` v1.0 (all 15 Nov 2026). If this plan conflicts with any of them, the source file wins — update the plan, not the source.
**Product:** OrbitCare (working build name: Orbitspace) — offline-first astronaut health dashboard, 180-day simulated mission, 3 crew, personal-baseline anomaly detection, decision support only. Simulated data only. Not a medical device.
**How to use this plan:** Work top to bottom, tick tasks off as you finish them. Every task takes **under 1–2 hours**. Every phase ends with the app **runnable** — never start a phase that leaves the app broken. Build **vertical slices** (one feature end-to-end: data → API → UI → verify), not all of the backend first and then all of the frontend.
**Stack this plan builds:** the Next.js target in `ARCHITECTURE.md` §1 (Next.js 14 + React + TypeScript + Tailwind + Recharts + Supabase + Vercel). The plain-HTML `orbitspace-code/` folder already implements Phases 2–3 in simpler form — if the team keeps that folder instead of Next.js, use this plan as the checklist for what is still missing (PDF, API v1, sync, auth) and skip the Next.js setup tasks in Phase 1.

---

## Phase 0 — Decide (30 minutes, before any code)

**Goal:** lock the one decision that blocks everything else. The app is not runnable yet — that is fine, this phase is the only exception.

- [ ] **0.1 Pick the stack and write it down.** What: choose Next.js (ARCHITECTURE target) **or** keep the delivered plain-HTML folder. Files touched: `README.md` (one line: "Stack: …"). Verify: all 4 team members can say the stack in one sentence. Depends: none.
- [ ] **0.2 Write the 4 role names in.** What: Frontend / Backend-Data / AI-ML (also owns the Day-63 demo data) / Design-Pitch — names, not just titles. Files touched: `README.md`. Verify: every role has a name next to it. Depends: none.

**Definition of Done — Phase 0:** stack + 4 names are written down and nobody is still debating them.

---

## Phase 1 — Foundation (vertical slice 0: a runnable shell with real data)

**Goal:** an app that opens, shows 3 crew, and replays Day 63 — with simulated data only. No scoring yet, no API yet.

- [ ] **1.1 Create the repo and the Next.js app.** What: `git init`, Next.js 14 + TypeScript + Tailwind, `main` protected, `.gitignore`, `.env.example` with placeholders only. Files touched: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `.env.example`, `.gitignore`. Verify: `npm run dev` opens a blank page, no errors. Depends: 0.1.
- [ ] **1.2 Add the DESIGN.md tokens.** What: copy the CSS custom properties from DESIGN.md §11 into `src/styles/tokens.css` and wire Tailwind to them. No new colours or fonts. Files touched: `src/styles/tokens.css`, `tailwind.config.ts`, `src/app/globals.css`. Verify: a test page shows background `#020612`, surface `#081630`, primary `#2E7FFF`. Depends: 1.1.
- [ ] **1.3 Generate the simulated mission data.** What: run the Python generator — 180 days × 3 crew, Days 1–21 baseline, inject the Day-63 Kenji infection event + the other test events (solar-particle event, exercise slump, stress period, BP drift). Files touched: `scripts/generate-mission-data.py`, `src/lib/data/mission-data.json`. Verify: the JSON has 540 readings, Kenji Day 63 sleep is 5.2h, and `is_simulated` is `true` everywhere. Depends: 1.1.
- [ ] **1.4 Build the scoring module (pure functions only).** What: `baseline.ts` (mean + SD, Days 1–21), `zscore.ts` (direction-aware, std-dev 0 → 0), `domains.ts` (4 domain scores, 3-day smoothing, Watch ≥ 1, Alert ≥ 2). No fetching, no DOM. Files touched: `src/lib/scoring/baseline.ts`, `zscore.ts`, `domains.ts`, `src/lib/constants.ts`. Verify: unit tests pass — Kenji Day 63 Sleep & Mind is 78 Watch, Day 90 is 95 Nominal. Depends: 1.3.
- [ ] **1.5 Build the app shell.** What: header (64px, wordmark, SIMULATED DATA tag, sync chip), footer disclaimer on every page ("Simulated data only · Decision support only · Not a medical device"), mission-day slider + Play + "Jump to Day 63". Files touched: `src/app/layout.tsx`, `src/components/layout/Header.tsx`, `Footer.tsx`, `MissionDayBar.tsx`. Verify: every page shows the header, the footer, and the slider; Play advances the day in the URL (`?day=63`). Depends: 1.2.
- [ ] **1.6 Deploy the shell to Vercel.** What: push to GitHub, import into Vercel, deploy. Files touched: none (Vercel dashboard only). Verify: the live link opens in incognito and shows the shell. Depends: 1.5.

**Definition of Done — Phase 1:** `npm run dev` and the Vercel link both open a runnable shell with the slider, the header/footer, and real simulated data behind it. Day 63 is reachable in one tap.

---

## Phase 2 — Core slice 1: Crew View + Astronaut Dashboard (PRD M1, M2, M3, M4)

**Goal:** the first real feature, end-to-end: data → scoring → API → UI. After this phase a judge can open the app and see who is worst.

- [ ] **2.1 Create the Supabase tables (migrations 001–004).** What: run DATABASE.md migrations 001 (triggers) → 004 (`missions`, `indicators`, `domains`, `domain_indicators`, `crew_members`, `baselines`, `daily_readings`). Files touched: `supabase/001_*.sql` … `004_*.sql`. Verify: tables exist in Supabase, row counts are 1 mission / 3 crew / 42 baselines. Depends: 1.3.
- [ ] **2.2 Seed Supabase.** What: load the generated JSON into Supabase (seed script, service role only). Files touched: `scripts/seed-supabase.mjs`. Verify: `daily_readings` has 540 rows; a SQL query for Kenji Day 63 returns sleep 5.2h. Depends: 2.1.
- [ ] **2.3 Build the Crew View page.** What: 3 crew cards, worst-first, status chips, score in mono, tap opens the Astronaut page. Data from the offline cache first, API in the background. Files touched: `src/app/page.tsx`, `src/components/crew/CrewCard.tsx`, `CrewList.tsx`, `src/components/health/StatusChip.tsx`, `src/lib/store/offline-cache.ts`. Verify: open `/` → Kenji is first on Day 63, Watch, 78; on Day 90 he is Nominal. Depends: 1.4, 1.5.
- [ ] **2.4 Build the API for the Crew View.** What: `GET /api/v1/crew-members?mission_day=63` (API.md #4). Files touched: `src/app/api/crew-members/route.ts`, `src/lib/api/client.ts`, `src/lib/supabase/client.ts`. Verify: `curl` the endpoint → same 3 crew, same order, same scores as the UI. Depends: 2.2, 2.3.
- [ ] **2.5 Build the Astronaut Dashboard page.** What: avatar + name + status, 4 domain-score cards, vitals table (vital | today | baseline | change + z-score). Files touched: `src/app/astronaut/[crewId]/page.tsx`, `src/components/health/DomainScoreCard.tsx`, `VitalsTable.tsx`. Verify: Kenji Day 63 shows Sleep & Mind and Immune drifting, every vital row shows its baseline. Depends: 2.3.
- [ ] **2.6 Build the API for the Dashboard.** What: `GET /api/v1/crew-members/{slug}` (API.md #5) + `GET /crew-members/{slug}/baselines` (#6) + `GET /crew-members/{slug}/domain-scores/{day}` (#10). Files touched: `src/app/api/crew-members/[crewId]/route.ts`, `src/app/api/crew-members/[crewId]/baselines/route.ts`, `src/app/api/crew-members/[crewId]/domain-scores/[day]/route.ts`. Verify: each endpoint returns the same numbers the Dashboard shows. Depends: 2.5.

**Definition of Done — Phase 2:** Crew View + Dashboard work end-to-end, online and from cache offline. Day 63: Kenji worst-first, Watch, 78. Day 90: Kenji Nominal, 95. Every vital shows its baseline.

---

## Phase 3 — Core slice 2: Flags, Action Plan, Trends (PRD M5, M6)

**Goal:** the explainable half of the product — every alert has evidence and an action, and a drift is visible on a chart.

- [ ] **3.1 Build flags + action plans (pure functions).** What: `flags.ts` (flag per indicator/day, evidence text, why-it-matters, action) + `action-plans.ts` (rule-based checklist + "contact flight surgeon if…"). Files touched: `src/lib/scoring/flags.ts`, `action-plans.ts`. Verify: unit tests — every flag has evidence + action; 0 flags without an action; Kenji Day 63 has ≥ 3 flags. Depends: 1.4.
- [ ] **3.2 Store flags + scores (migrations 005).** What: create `domain_scores`, `flags`, `action_plan_items` tables and load the computed rows. Files touched: `supabase/005_*.sql`. Verify: `domain_scores` has 2,160 rows; `flags` has ≥ 3 for Kenji Day 63. Depends: 2.1, 3.1.
- [ ] **3.3 Build the Flag cards.** What: flag card component (left border in status colour, title, evidence, action, escalation line). Files touched: `src/components/health/FlagCard.tsx`. Verify: a flag card on the Dashboard shows all four parts; no flag renders without its action. Depends: 3.1.
- [ ] **3.4 Build the Flags + Action Plan APIs.** What: `GET /api/v1/crew-members/{slug}/flags` (#11), `GET /api/v1/flags/{id}` (#12), `GET /api/v1/crew-members/{slug}/action-plan` (#14), `PATCH /api/v1/flags/{id}` (#13, acknowledge), `PATCH /api/v1/action-plan-items/{id}` (#15, check off). Files touched: the 5 route files under `src/app/api/`. Verify: `curl` each one; PATCH acknowledge returns `is_acknowledged: true` with a timestamp. Depends: 3.2.
- [ ] **3.5 Build the Action Plan page.** What: flags in priority order, each with its checklist, "Contact flight surgeon if…" line, "Mark all done" + "Download PDF report" buttons. Files touched: `src/app/plan/page.tsx`. Verify: Kenji Day 63 plan lists rest / hydrate / light exercise / re-check tomorrow; checking an item persists on refresh. Depends: 3.3, 3.4.
- [ ] **3.6 Build the Trends page.** What: astronaut selector, 7-day / 30-day segmented control, 4 Recharts line charts with the normal band, Watch/Alert markers, "What changed" bullets, "Jump to Day 63" chip. Files touched: `src/app/trends/page.tsx`, `src/components/health/TrendChart.tsx`, `src/components/forms/SegmentedControl.tsx`. Verify: Kenji's sleep/HRV line leaves the normal band around Day 60–63; switching 7/30 days re-renders without a reload. Depends: 2.5.
- [ ] **3.7 Build the Trends API.** What: `GET /api/v1/trends?crew_slug=kenji&from_day=34&to_day=63` (API.md #21, flagged derived — no own table). Files touched: `src/app/api/trends/route.ts`. Verify: the response has `baseline_low` / `baseline_high` for every point and matches the chart. Depends: 3.6.

**Definition of Done — Phase 3:** a judge can do the full PRD Flow 2 in the app: Crew View → Kenji → Trends (drift visible) → flag (evidence shown) → Action Plan (checklist works). 0 unexplained alerts.

---

## Phase 4 — Core slice 3: Self-check, offline sync, PDF report (PRD M7, M8, M9)

**Goal:** the write path and the handover — the app now saves the crew's own input and produces a real report, offline.

- [ ] **4.1 Create the self-checks table (migration 006).** What: `self_checks` + the partial unique index (one per crew-day, ignoring soft-deleted rows). Files touched: `supabase/006_*.sql`. Verify: inserting two checks for Kenji Day 63 fails on the unique constraint. Depends: 2.1.
- [ ] **4.2 Build the self-check form.** What: sleep (slider), mood 1–5, stress 1–5, symptoms (checkboxes), notes (optional); validation (sleep + mood required); saved state shows "Saved Day X". Files touched: `src/app/self-check/page.tsx`, `src/components/forms/SelfCheckForm.tsx`. Verify: submit with no mood → inline error; submit complete → toast "Saved — your Sleep & Mind score will update." Depends: 2.5.
- [ ] **4.3 Build the self-check APIs.** What: `POST /api/v1/crew-members/{slug}/self-checks` (#17), `GET` list + one day (#16, #18), `PATCH` (#19), `DELETE` (#20, soft delete). Files touched: `src/app/api/crew-members/[crewId]/self-checks/route.ts` + `[day]/route.ts`. Verify: POST returns `201`, `sync_status: "pending"`; a second POST for the same day returns `409 CONFLICT`; PATCH resets `sync_status` to `pending`. Depends: 4.1, 4.2.
- [ ] **4.4 Wire the self-check into the score.** What: after a save, recompute the Sleep & Mind score locally from the new check (no reload, no network wait). Files touched: `src/lib/scoring/domains.ts`, `src/components/forms/SelfCheckForm.tsx`. Verify: log a bad night for Kenji → his Sleep & Mind score drops on the Dashboard immediately. Depends: 4.2.
- [ ] **4.5 Build the offline cache + sync queue.** What: `offline-cache.ts` (localStorage/IndexedDB read/write, sync queue) + the fetch wrapper (5s timeout, 1 retry for network errors only, offline fallback). Files touched: `src/lib/store/offline-cache.ts`, `src/lib/api/client.ts`, `src/lib/api/errors.ts`. Verify: turn wifi off → Crew View, Dashboard, Trends and Action Plan still load from cache with the OFFLINE chip; turn wifi on → the queued self-check syncs. Depends: 2.3, 4.3.
- [ ] **4.6 Build the sync endpoints.** What: `GET /api/v1/sync/status` (#27), `POST /api/v1/sync` (#28), `GET /api/v1/sync-log` (#29, V2 handover log), migrations 007 (`reports`, `sync_log`). Files touched: `src/app/api/sync/route.ts`, `src/app/api/sync-log/route.ts`, `supabase/007_*.sql`. Verify: after a sync, `sync_log` has a row with `sync_status: "synced"`; `GET /sync/status` returns `live` with `pending_count: 0`. Depends: 4.5.
- [ ] **4.7 Build the PDF report.** What: `ReportDocument.tsx` (4 pages: cover + crew at a glance, per-astronaut scores, vitals vs baseline + flags, action plan + disclaimer + AI disclosure) + `report-data.ts`, built on-device with @react-pdf/renderer. Files touched: `src/components/report/ReportDocument.tsx`, `src/lib/pdf/report-data.ts`. Verify: download on Day 63 → `OrbitCare-Day-63-report.pdf`, 4 pages, Kenji 78 Watch with 5 flags, every flag with its full explanation, generated in < 10 seconds, with wifi off. Depends: 3.5.
- [ ] **4.8 Build the report APIs.** What: `GET /api/v1/reports` (#22), `POST /api/v1/reports` (#23), `GET /api/v1/reports/{id}` (#24), `GET /api/v1/reports/{id}/download` (#25), `DELETE /api/v1/reports/{id}` (#26). Files touched: `src/app/api/reports/route.ts` + `[reportId]/route.ts` + `[reportId]/download/route.ts`. Verify: POST returns `201`; the download returns `application/pdf` when a server copy exists, otherwise `404` telling the client to generate on-device. Depends: 4.7.

**Definition of Done — Phase 4:** the full PRD MVP works end-to-end. A self-check saves, survives refresh, syncs when a link returns, and updates the score. The PDF is a real 4-page report, not a demo file, and it downloads with wifi off.

---

## Phase 5 — Integrations: How It Works, reference APIs, RLS, CI (PRD Flow 5, DATABASE §7–§8, API.md)

**Goal:** the app is complete, safe, and checked by a machine on every push — ready to show to judges.

- [ ] **5.1 Build the How It Works page.** What: single column, max 720px: the problem, your baseline, how a flag is made (plain language), what OrbitCare is not, "Jump to Day 63" button. Files touched: `src/app/how/page.tsx`. Verify: a non-technical reader can explain the product after reading it; the button opens Day 63. Depends: 2.3.
- [ ] **5.2 Build the reference APIs.** What: `GET /api/v1/indicators` (#32), `GET /api/v1/domains` (#33), `GET /api/v1/missions` + `GET /api/v1/missions/{id}` (#2, #3), `GET /api/v1/health` (#1, flagged — infrastructure only). Files touched: `src/app/api/indicators/route.ts`, `domains/route.ts`, `missions/route.ts`, `health/route.ts`. Verify: each returns its reference rows; `/health` returns `200` with `database: "connected"`. Depends: 2.1.
- [ ] **5.3 Enable Row-Level Security (migration 009).** What: `ENABLE ROW LEVEL SECURITY` on every table + the MVP policies from DATABASE.md §7 (anon: SELECT simulated data only, INSERT self-check only; service role: everything). Files touched: `supabase/009_*.sql`. Verify: a browser call with the anon key trying to UPDATE a reading gets `403 FORBIDDEN`. Depends: 2.1, 4.1.
- [ ] **5.4 Add CI.** What: GitHub Actions — typecheck + lint + build + test on every push/PR. Files touched: `.github/workflows/ci.yml`. Verify: push a branch with a type error → CI fails; push a fix → CI passes. Depends: 1.1.
- [ ] **5.5 Add the scoring tests.** What: `scoring.test.ts` (baseline, z-score, thresholds, Day-63 detection), `flags.test.ts` (every flag has evidence + action), `smoke.test.ts` (Day 63 worst-first, Day 90 Nominal). Files touched: `src/tests/`. Verify: `npm test` passes, 3 files, 0 skipped. Depends: 1.4, 3.1.

**Definition of Done — Phase 5:** every API.md endpoint exists and returns the documented shape. RLS blocks a browser write to readings/scores/flags. CI is green. The How It Works page explains the product to a stranger.

---

## Phase 6 — Auth (V2 only — SKIP for the hackathon)

**Goal:** real users, real roles — only if the product continues after the hackathon. Do not start this phase before Phase 4 is done and submitted.

- [ ] **6.1 Add Supabase Auth + a profiles table.** What: `profiles` (`auth.users.id` → `crew_id`, role `astronaut` / `medical_officer` / `flight_surgeon`). Files touched: `supabase/011_profiles.sql`, `src/lib/supabase/client.ts`. Verify: a user can sign up and their profile row exists. Depends: Phase 4 done.
- [ ] **6.2 Enforce the V2 RLS policies.** What: replace the MVP policies with the V2 policies from DATABASE.md §7 (astronaut: own rows only; medical officer: all crew, acknowledge + check-off only; flight surgeon: synced rows only, read-only). Files touched: `supabase/012_rls_v2.sql`. Verify: an astronaut calling another crew's self-checks gets `403 FORBIDDEN`. Depends: 6.1.
- [ ] **6.3 Wire the API to the JWT.** What: every endpoint reads the `Authorization: Bearer <jwt>` header and checks the role (API.md §3). Files touched: all `src/app/api/**/route.ts` files (auth check only, no logic change). Verify: a request with a valid key but the wrong role gets `403`, not `401`. Depends: 6.2.

**Definition of Done — Phase 6:** three test users (one per role) can each do exactly what their role allows and nothing else. The demo crew still works unchanged.

---

## Phase 7 — V2 features (PRD V2 — after the MVP works end-to-end)

**Goal:** the should-haves, one vertical slice at a time. Do not start any of these before Phase 4 is submitted.

- [ ] **7.1 One-tap Emergency Guide.** What: red EMERGENCY GUIDE button on every page, 6 situation cards, one step at a time, progress bar, CPR metronome 110 bpm, handover note. Full page, never a modal, works fully offline. Files touched: `src/app/emergency/page.tsx`, `src/lib/data/emergency-guide.ts`, `supabase/007_*` (`emergency_guide_steps`), `src/app/api/emergency/route.ts` (#30, #31). Verify: open it with wifi off, pick "Collapsed / not breathing", follow to the handover note; Esc never closes it mid-step. Depends: Phase 4 done.
- [ ] **7.2 Radiation shelter alert.** What: solar-particle-event warning with a countdown to shelter, from cumulative dose + spike detection in `daily_readings`. Files touched: `src/lib/scoring/radiation.ts`, `src/components/health/RadiationAlert.tsx`. Verify: on a day with a radiation spike, the alert shows a countdown and the shelter step. Depends: 2.5.
- [ ] **7.3 Health forecast (14 days).** What: predict who is likely to decline in the next 14 days, with the evidence for the forecast. Files touched: `src/lib/scoring/forecast.ts`, `src/components/health/ForecastCard.tsx`. Verify: the forecast for Kenji before Day 63 names sleep + HRV as the evidence. Depends: 3.6.
- [ ] **7.4 Medicine stock countdown + exercise prescription.** What: which medicine runs out on which day; today's workout auto-made from Bone & Muscle scores. Files touched: `src/lib/scoring/medicine.ts`, `exercise.ts`, `src/app/plan/page.tsx`. Verify: both appear on the Action Plan page and change when the scores change. Depends: 3.5.

**Definition of Done — Phase 7:** each V2 feature works offline, has its own verify step above, and does not break any Phase 2–4 verify step. If a feature breaks the MVP, cut the feature, not the MVP.

---

## Phase 8 — Polish (DESIGN.md, ARCHITECTURE.md §5, §8)

**Goal:** the app feels finished — fast, accessible, and correct on a phone.

- [ ] **8.1 Accessibility pass.** What: visible focus rings everywhere, keyboard-only walkthrough of every page, screen-reader labels on every icon button, chart text summaries, `prefers-reduced-motion` respected. Files touched: all components (no new files). Verify: Tab through the whole app without a mouse; a screen reader announces every status chip as text, not colour. Depends: Phases 2–4 done.
- [ ] **8.2 Mobile pass.** What: 360px wide, single column, bottom nav, 44×44px touch targets, tables scroll horizontally, slider full width. Files touched: `src/app/layout.tsx`, `src/components/layout/Header.tsx`, all page files. Verify: no horizontal overflow at 360px; every button is tappable. Depends: Phases 2–4 done.
- [ ] **8.3 Error + empty + loading states.** What: skeletons on every loading card, plain-language errors with Retry, designed empty states ("No flags today — all Nominal."). Files touched: `src/components/ui/Skeleton.tsx`, `EmptyState.tsx`, `Toast.tsx`, every page. Verify: block the API in dev tools → every page shows cached data + OFFLINE, never a blank screen. Depends: 4.5.
- [ ] **8.4 Performance pass.** What: memoise scoring by `(crewId, day)`, debounce the slider to 200 ms, check the budgets (first load < 2s, slider < 100 ms, PDF < 10s, first-load JS < 300 KB gzipped). Files touched: `src/lib/scoring/*`, `src/components/layout/MissionDayBar.tsx`. Verify: measure each budget and write the numbers in the PR. Depends: Phases 2–4 done.

**Definition of Done — Phase 8:** the app passes the accessibility + mobile + offline checks above, and the performance budgets are measured (not guessed) and written down.

---

## Phase 9 — Launch (PRD §8 — the hackathon submission)

**Goal:** submitted, on time, with proof. This phase is the only one with a clock on it.

- [ ] **9.1 Test the live link in incognito.** What: open the Vercel link in incognito, run the Day-63 demo end-to-end, download the PDF, turn wifi off and repeat. Files touched: none. Verify: every step works for a stranger with no login and no cache. Depends: Phase 4 done.
- [ ] **9.2 Take screenshots + record the demo.** What: 3 screenshots (Crew View Day 63, Dashboard, Trends) into `docs/screenshots/`; record the 30-second video **or** finish the 7-slide deck — one, not both at the last minute (PRD §9: confirm the format in the Project Tab first). Files touched: `docs/screenshots/`, `README.md` (screenshot links). Verify: the screenshots are the real app, not mockups; the video/deck is public, no password. Depends: 8.4.
- [ ] **9.3 Write the README + AI disclosure.** What: README with the live link, how to run it, data sources, and the AI disclosure (every AI tool used, what it helped with). Files touched: `README.md`. Verify: a judge can run the app from the README alone. Depends: 9.1.
- [ ] **9.4 Submit on the Project Tab by ~15:00 Sun 15 Nov.** What: submit the live link + demo **before 16:00 gates close** (global 11:59 PM is the outer bound, not the plan). Files touched: none (Project Tab). Verify: submission confirmed, participant certificate eligibility noted. Depends: 9.2, 9.3.

**Definition of Done — Phase 9:** submitted on the Project Tab by ~15:00 IST Sunday, live link tested in incognito, demo public with no password, README has the AI disclosure and the "not a medical device / synthetic data only" line. The team can walk away.

---

## Cut list — if you are behind, cut in this order

1. Phase 7 (all V2) — cut first, no discussion.
2. Phase 8 (polish) — cut to 8.1 + 8.3 only.
3. Phase 6 (auth) — already skipped for the hackathon.
4. Phase 5 (5.2, 5.4) — keep 5.3 (RLS) and 5.5 (tests), cut the rest.
5. Phase 4 (4.6 sync-log, 4.8 report APIs) — keep the on-device PDF and the self-check.
6. **Never cut:** Phase 1, Phase 2, Phase 3, the Day-63 demo, the PDF, or the offline check. If those are at risk, cut everything else first.

## How long is this plan?

| Phase | Tasks | Estimate (1 person) | With 4 people in parallel |
|---|---|---|---|
| Phase 0 | 2 | 0.5 h | 0.5 h |
| Phase 1 | 6 | 6–9 h | 2–3 h |
| Phase 2 | 6 | 6–10 h | 2–3 h |
| Phase 3 | 7 | 7–11 h | 2–3 h |
| Phase 4 | 8 | 8–12 h | 3–4 h |
| Phase 5 | 5 | 5–8 h | 2 h |
| **MVP total (Phases 0–5)** | **34** | **~33–50 h** | **~12–16 h of wall time** |
| Phase 6 (V2 auth) | 3 | 3–5 h | 1–2 h |
| Phase 7 (V2 features) | 4 | 4–7 h | 2 h |
| Phase 8 (polish) | 4 | 4–7 h | 2 h |
| Phase 9 (launch) | 4 | 3–5 h | 1–2 h |

Estimates assume the tasks are split across the 4 roles (Frontend / Backend-Data / AI-ML / Design-Pitch) and that vertical slices are built in parallel — two people never wait on the same task. If one person builds it alone, use the 1-person column and cut from the cut list first.

---

*End of PLAN.md v1.0. Tick tasks off as you finish them. If a task takes more than 2 hours, stop, split it, and write the split into this file — a task that grows is a task that was too big.*
