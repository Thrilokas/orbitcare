# OrbitCare — FEATURES.md

**Build guide for each MVP feature. One feature at a time.**

**Version:** 1.0 — 15 Nov 2026
**Sources of truth:** `PRD.md` v1.0, `DESIGN.md` v1.0, `ARCHITECTURE.md` v1.0,
`DATABASE.md` v1.0, `API.md` v1.0, `PLAN.md` v1.0 (all 15 Nov 2026).
If this file conflicts with any of those, that file wins — update this
file, not the source.
**Product:** OrbitCare (working build name: Orbitspace) — offline-first
astronaut health dashboard, 180-day simulated mission, 3 crew,
personal-baseline anomaly detection, decision support only.
Simulated data only. Not a medical device.

---

## How to use this file — read this first

### The one-feature-at-a-time rule (user's rule, non-negotiable)

1. **Build one feature at a time.** Pick the next feature in the
   build order in §1. Build only that feature. Do not start the
   next one in parallel.
2. **After finishing a feature, update `PLAN.md` checkboxes.**
   Tick only the PLAN tasks listed under that feature — and only
   after every acceptance checkbox in that feature's section passes.
   Do not tick a task because the code "looks done".
3. **Do not start the next feature until the user confirms.**
   When a feature is done, stop and show the user the acceptance
   checklist with the actual results (Day-63 numbers, screenshots,
   curl output). Wait for their go-ahead before starting the next
   feature.

If you are an AI assistant reading this file, follow §2 (cross-cutting
rules) and the feature's own section, in that order. Do not invent a
new endpoint, table, colour, font, component, or screen — if it is
not in the source files, stop and ask (see `AGENTS.md`).

### What "a feature" means here

Each section below is one PRD MVP feature, M1–M10 (PRD §4). Each
section has exactly six parts, in this order:

1. **What it does + user story** — the PRD story it covers.
2. **Screens + components** — DESIGN.md layout + component specs.
3. **Database tables + API endpoints** — DATABASE.md + API.md numbers.
4. **Step-by-step build order** — data → scoring → API → UI → verify.
5. **Edge cases, validation, loading / empty / error states.**
6. **Acceptance criteria** — a checklist. All boxes must pass
   before the feature counts as done.

### Build order (do not reorder without updating PLAN.md)

Features depend on each other. Build in this order:

```
M10  Simulated data + seed          (data everything else reads)
  └─ M3  Personal-baseline anomaly detection   (scoring engine)
       ├─ M4  4 domain scores
       │    ├─ M1  Crew View (worst-first)
       │    ├─ M2  Astronaut Dashboard
       │    └─ M5  Flags + action plans
       │         └─ M6  Trends
       ├─ M7  Daily self-check       (feeds M4 Sleep & Mind)
       ├─ M8  PDF health report      (reads M1–M7 output)
       └─ M9  Offline-first + sync   (wraps M1–M8 — build its
                                        cache first, sync last)
```

In PLAN.md terms: Phase 1 (M10 + M3 foundations) → Phase 2
(M1, M2, M4) → Phase 3 (M5, M6) → Phase 4 (M7, M8, M9) →
Phase 5 (integrations). V2 features (Emergency Guide, forecast,
radiation alert) are **not** in this file — see PRD §4 V2 and
PLAN Phase 7. Do not build them as part of an MVP feature.

### Status — where each feature stands (15 Nov 2026)

Two columns, because there are two implementations. Do not confuse them.

| Feature | Next.js target (ARCHITECTURE/PLAN) — what this file builds | Delivered plain-HTML folder (`orbitspace-code/`) — what already exists |
|---|---|---|
| M1 Crew View | Not started | Done in simple form (`index.html`, `js/app.js`) |
| M2 Dashboard | Not started | Done in simple form (`astronaut.html`) |
| M3 Baseline detection | Not started | Done in simple form (`js/data.js`, `js/app.js`) |
| M4 Domain scores | Not started | Done in simple form |
| M5 Flags + action plans | Not started | Done in simple form (rule-based) |
| M6 Trends | Not started | Done in simple form (SVG charts, not Recharts) |
| M7 Self-check | Not started | Done in simple form (localStorage only, not the API) |
| M8 PDF report | Not started | **Not done** — delivered report is `.txt`, not PDF |
| M9 Offline-first | Not started | Partial — in-browser data works offline; no sync queue, no LIVE/STALE/OFFLINE chip |
| M10 Simulated data | Not started as a Next.js seed | Done — 180 days, 3 crew, 540 readings, live in Supabase (seed verified 15 Nov 2026) |

"Done in simple form" means the demo works in the plain folder.
It does **not** mean the Next.js target is done. When building a
feature for the target, reuse the logic and the numbers from the
plain folder as a reference — do not copy its files into the
Next.js tree, and do not tick PLAN tasks for the target just
because the plain folder works.

### A note on numbers — read before you build M3/M4

PRD §6 Flow 2 and PLAN §1.4/§2.3 say Kenji on Day 63 is
**Watch, score 78**, and his sleep that day is **5.2h vs a 7.4h
baseline**. The delivered plain-HTML code, verified live against
Supabase on 15 Nov 2026, returns **overall 79, Watch** on Day 63
(heart 70, bone 89, sleep 70, immune 86; sleep that day 6.5h).
The **band is the contract** — Watch, worst-first, with the same
flags — not the exact point score. The exact vital values follow
the generated seed data (`DATABASE.md` §9, `backend/lib/
simulation.js`). If your implementation returns 78 or 79, both
pass, as long as the band, the order, and the flags match. If it
returns Nominal on Day 63, or a different crew member first, it
fails — stop and fix the scoring, do not change the PRD numbers
to match the code.

---

## 1. Cross-cutting rules — apply to every feature

These apply to M1–M10 equally. A feature does not pass acceptance
if it breaks any of them, even if its own checklist is green.

### 1.1 Design (DESIGN.md — the only design authority)

- **Theme:** dark only. Background `#020612`, surfaces `#081630` /
  `#0B1E42`, primary `#2E7FFF`. Light mode is for the PDF/print
  only — never ship the app in light mode.
- **Fonts:** Inter for all text; IBM Plex Mono for scores, vitals,
  z-scores, mission day, and code only. No other fonts.
- **Status colours (fixed, never change per screen):**
  Nominal `#2FD6A3`, Watch `#FFB020`, Alert / Attention `#FF4D5E`.
  Never show status by colour alone — every status also has a chip
  label and text (DESIGN §9).
- **Tokens:** use the CSS custom properties in DESIGN §11
  (`--color-*`, `--radius-*`). Never hard-code a new HEX.
- **Components:** reuse the specs in DESIGN §7 — Button (Primary /
  Secondary / Ghost / Destructive), StatusChip, CrewCard, FlagCard,
  DomainScoreCard, tables, toasts, skeletons, segmented control.
  Do not invent a new component without updating DESIGN.md first.
- **Layout:** max content width 1200px, page padding 16px (mobile) /
  32px (desktop), header 64px with wordmark + `SIMULATED DATA` tag,
  footer disclaimer on **every** page:
  "Simulated data only · Decision support only · Not a medical device"
  (12px, muted, centred).
- **Accessibility (DESIGN §9, non-negotiable):** visible 2px
  `#7FB3FF` focus ring on every interactive element; keyboard-only
  walkthrough works (Tab / Enter / Space / arrows); screen-reader
  labels on every icon button; `prefers-reduced-motion` respected;
  touch targets ≥ 44×44px on mobile; no horizontal overflow at 360px.

### 1.2 Language — decision support only, never a diagnosis

- Never use the words `patient`, `diagnosis`, `disease`,
  `treatment`, or "you have…" / "you are suffering from…" in code,
  UI, API responses, or the PDF. Scores and flags are **risk
  signals with evidence**, not clinical findings.
- Every flag shows evidence + action (see M5). A number without
  its baseline is a design bug (DESIGN principle 2): every vital,
  chart and score shows value + baseline + direction of change.
- Plain English, reading age ~12. "z-score" is always followed by
  "(how far from your normal, in standard deviations)" on first
  use per page.

### 1.3 Data + API rules (DATABASE.md, API.md, ARCHITECTURE.md)

- **URL first, cache second, server third** (ARCHITECTURE §4):
  mission day, selected crew and trends range live in the URL
  (`?day=63&crew=kenji&range=30`). No Redux / Zustand.
  Scores are **derived, never stored as truth** — stored: raw
  readings + baselines + self-checks; computed on render: z-scores,
  domain scores, flags, action plans.
- **API envelope (API.md §4):** every JSON response is
  `{ data, meta }`; every error is
  `{ error: { code, message, details, request_id, documentation } }`
  with a SCREAMING_SNAKE_CASE code. Never return a raw DB error.
- **Pagination / filtering / sorting (API.md §5):** lists use
  `page` + `per_page` (default 20, max 100); Crew View is always
  worst-first; `GET /trends` uses `from_day`/`to_day`, not pages.
- **Rate limits (API.md §5.4):** anon 60/min, authenticated
  300/min, service 1,000/min; `429` + `Retry-After` header.
- **Auth in the MVP (API.md §3.1):** no login. Anon key for reads;
  the only browser write is `POST /self-checks`. The service key
  is server-only, never in the browser, never in GitHub.
- **RLS (DATABASE.md §7):** anon may SELECT simulated data and
  INSERT self-checks only; the service role does seed/recompute.
- **No new endpoints/tables:** if a feature needs an endpoint or
  table that is not in API.md / DATABASE.md, stop and ask — do not
  invent one (AGENTS.md).

### 1.4 States — every feature, every screen (DESIGN §6)

| State | What the user must see |
|---|---|
| Loading | Skeleton bars in `--color-surface-2`, never a blank screen; button shows spinner + "Loading…" and is disabled. Never a spinner alone for > 1s on a page. |
| Error | Plain language: what happened + what to do + Retry button. Never a raw error code as the only message. Never a blank screen, never a dead button. |
| Empty | Designed empty state: 1 icon, 1 line, 1 action if useful. Never a blank card. ("No flags today — all Nominal." is a success state, not a 404.) |
| Offline | Header shows OFFLINE in a muted chip. Cached data stays visible with "Last sync: Day X, HH:MM". Actions needing a connection are disabled with "Needs connection — will sync later". Offline is a state, not a red error banner. |
| Disabled | Opacity 0.5, cursor `not-allowed`, no hover, text still readable (contrast ≥ 4.5:1). |

### 1.5 How to verify a feature (the pattern for every section)

1. Build data → scoring → API → UI, in that order (vertical slice).
2. `curl` the feature's endpoints and check the numbers match the UI.
3. Open the page, run the feature's Day-63 check and its Day-90
   check (Kenji recovers — see §1 note on numbers).
4. Turn wifi off, repeat — the feature must still work from cache.
5. Tick **only** that feature's PLAN tasks below, then stop and
   wait for the user's confirmation before starting the next feature.

---

## M1 — Crew View (worst-first)

**PLAN tasks:** 2.3 (Crew View page), 2.4 (Crew View API).
**Depends on:** M10 (seeded data), M3 (scoring), M4 (domain scores).
**Phase:** 2.

### What it does + user story

All 3 crew on one screen, sorted worst-first, so the person who
needs help is never buried. One tap opens that astronaut.

> **As the crew medical officer, I want the crew listed
> worst-first, so that I help the person who needs it most first.**
> (PRD §5, Amara)
>
> **As a judge, I want to replay Day 63 in one tap, so that I can
> see OrbitCare catch a decline live.** (PRD §5)

Day-63 story: Kenji is listed first, Watch, score 78 (PRD target;
delivered code returns 79 — see §1 note on numbers). By Day 90 he
is Nominal and no longer first.

### Screens + components (DESIGN.md)

- **Screen:** Overview / Crew View — DESIGN §8.1.
  Hero: "Crew health at a glance" (24px/700) + mission day in mono
  + sync chip. Background: the only gradient in the app
  (`#0B1E42` → `#020612`). Below: "Today's flags" list + a
  Primary "Download PDF report" button, right-aligned.
- **Components:** `CrewCard` (§7.3) × 3 — avatar 48px, name 16px/700,
  role 12px muted, score mono 36px, `StatusChip` (§7.4) top-right,
  4 domain dots below. `CrewList` wraps them. `MissionDayBar`
  (slider + Play + "Jump to Day 63") sits at the top of every page
  except How It Works. Header (§7.6) + footer disclaimer on the page.
- **Grid:** 1 column mobile, 3 columns desktop. The DOM order is
  the visual order — the worst card is first in the DOM, not just
  visually moved there.
- **Sorting (ARCHITECTURE §4):** Alert first, then Watch, then
  Nominal; ties broken by lowest overall score, then by name.
  Deterministic — the same input always gives the same order.

### Database tables + API endpoints

| | |
|---|---|
| **Tables** | `crew_members` (3 rows), `domain_scores` (2,160 rows after a full seed: 3 crew × 180 days × 4 domains) |
| **Endpoint** | `GET /api/v1/crew-members` — API.md #4, §6.3. Query: `?mission_day=63`. Returns the 3 crew, worst-first, with overall score + status. No pagination (3 rows). |
| **Also used** | `GET /api/v1/crew-members/{slug}` (#5) for the tap-through; `GET /api/v1/health` (#1, flagged — infrastructure only) for the liveness check behind the sync chip. |

Delivered equivalent: `GET /api/crew-status?day=63` in
`backend/server.js` (unversioned, 7 endpoints — not the `/api/v1/`
target). The plain folder's `index.html` + `js/app.js` already
render this view from in-browser data.

### Step-by-step build order

1. **Data (30 min):** confirm the seed from M10: `crew_members`
   has 3 rows, `domain_scores` has 2,160. If not, fix M10 first —
   do not work around missing data in the UI.
2. **Scoring (30 min):** wire the M3/M4 scoring module
   (`lib/scoring/`) so the Crew View can ask for one overall
   score + one status per astronaut per day. No scoring logic in
   the page component.
3. **API (45 min):** implement `GET /api/v1/crew-members`
   (`src/app/api/crew-members/route.ts`). Sort worst-first on the
   server, not only in the browser. Return the documented envelope
   (§1.3). Verify with curl (step 5).
4. **Cache-first UI (60 min):** build `src/app/page.tsx` +
   `CrewCard.tsx` + `CrewList.tsx` + `StatusChip.tsx`. Render from
   the offline cache first (§1.3, M9), fetch the API in the
   background, re-render when newer data arrives. Tapping a card
   (or Enter on it) opens `/astronaut/{slug}?day=<day>`.
5. **Wire the day control (30 min):** the mission-day slider writes
   to the URL (`?day=63`, debounced 200 ms). Play advances the day
   in the URL. "Jump to Day 63" sets `?day=63` in one tap.
6. **Flags strip (30 min):** "Today's flags" below the grid, using
   the M5 `FlagCard` — but only after M5 exists; before that, show
   the flags summary from the M5 API shape, not a placeholder list.

### Edge cases, validation, loading / empty / error states

- **Day out of range:** `?day=0` or `?day=999` → clamp to 1–180
  (ARCHITECTURE: `clampDay`). Never crash, never show an empty page.
- **Unknown crew slug in the URL:** the tap-through target does not
  exist → "Crew member not found — back to Crew View" + a Back
  button (404, not a blank screen).
- **All Nominal:** empty state — "All crew Nominal today." + a
  1-line summary. This is a success state, not an error.
- **Ties:** two crew with the same status and score → tie-break by
  name (deterministic order, §1.3).
- **Loading:** skeleton crew cards (3 skeleton bars in
  `--color-surface-2`) while the first fetch runs. Never a blank
  page, never a spinner alone for > 1s.
- **Offline / API fails:** show the cached Crew View + OFFLINE chip
  with "Last sync: Day X, HH:MM". Do not show a red error banner.
  Retry in the background (5s timeout, 1 retry for network errors
  only — ARCHITECTURE §5).
- **No data at all (never seeded):** designed empty state, not a
  crash — "No mission data yet — run the seed (see SETUP.md)" with
  a link to the setup steps. This must never happen in the demo;
  it is a setup failure, not a UI state to polish.
- **Validation:** `mission_day` must be an integer 1–180. A
  non-integer (`?day=abc`) → day 1, not an error page.

### Acceptance criteria

- [ ] Open `/` → 3 crew cards render, worst-first, in DOM order.
- [ ] Day 63: **Kenji first, Watch, score 78** (PRD target; 79 in
      the delivered code also passes — same Watch band, see §1 note).
- [ ] Day 90: Kenji is **Nominal, 95**, and is no longer first.
- [ ] `curl "GET /api/v1/crew-members?mission_day=63"` returns the
      same 3 crew, same order, same scores as the UI.
- [ ] Tapping / pressing Enter on a card opens that astronaut's
      Dashboard for the same day.
- [ ] Slider + Play + "Jump to Day 63" all update the URL (`?day=`).
- [ ] All Nominal → "All crew Nominal today." empty state shows.
- [ ] Wifi off → Crew View still loads from cache with the OFFLINE chip.
- [ ] No diagnosis language anywhere on the page; footer disclaimer
      is visible; every status has a chip label + text, not colour alone.
- [ ] PLAN tasks **2.3, 2.4** ticked only after every box above passes,
      then **stop and wait for the user's confirmation** before M2.

---

## M2 — Astronaut Dashboard

**PLAN tasks:** 2.5 (Dashboard page), 2.6 (Dashboard APIs).
**Depends on:** M1, M3, M4. **Phase:** 2.

### What it does + user story

One astronaut's current health on one screen: current vitals vs
their own baseline, 4 domain scores, active flags. The 2-minute
daily check.

> **As an astronaut, I want to see my health status in green /
> amber / red in under 2 minutes, so that I know whether I need to
> act today.** (PRD §5, Kenji)
>
> **As the crew medical officer, I want to see what action was
> already taken for a flag, so that I don't repeat or miss a step.**
> (PRD §5, Amara)

### Screens + components (DESIGN.md)

- **Screen:** Astronaut Dashboard — DESIGN §8.2.
  Header row: avatar 64px, name 24px/700, role 14px secondary,
  status chip, mission day in mono. Layout: 2fr main / 1fr side
  (desktop), stacked on mobile.
- **Main column:** 4 `DomainScoreCard`s in a 2×2 grid (Heart,
  Bone & Muscle, Sleep & Mind, Immune/Radiation) — domain name
  14px/600, score mono 36px, status chip, 1-line reason 14px
  secondary, mini sparkline (primary line only). Then the vitals
  table: vital | today | your baseline | change, with z-score in
  mono (§7.7 — numbers mono, right-aligned, status in a chip).
- **Side column:** active flags (`FlagCard`s), then the Daily
  self-check card (M7), then Primary "Download PDF report" (M8).
- **Rule:** every vital row shows baseline + change. A vital
  without a baseline is not shipped.

### Database tables + API endpoints

| | |
|---|---|
| **Tables** | `crew_members`, `daily_readings`, `domain_scores`, `flags` (read-only here); `baselines`, `indicators` (for the baseline column) |
| **Endpoints** | `GET /api/v1/crew-members/{slug}` — API.md #5, §6.3 (dashboard: astronaut + vitals + scores + flags for a day). `GET /api/v1/crew-members/{slug}/baselines` — #6, §6.4 (14 baseline rows). `GET /api/v1/crew-members/{slug}/domain-scores/{mission_day}` — #10, §6.6 (4 scores for one day). Also `GET /api/v1/crew-members/{slug}/readings/{mission_day}` — #8, §6.5 (one day's reading). |
| **Also used** | `GET /api/v1/crew-members/{slug}/readings` (#7) for the vitals table range. |

Delivered equivalent: `GET /api/astronaut/:id?day=63` in
`backend/server.js`; `astronaut.html` + `js/app.js` in the plain folder.

### Step-by-step build order

1. **API first (60 min):** implement #5, #6, #10, #8. Each returns
   the documented shape. Verify with curl before building the UI:
   Kenji Day 63 must show Sleep & Mind and Immune drifting.
2. **Dashboard shell (45 min):** `src/app/astronaut/[crewId]/
   page.tsx` — header row, 2fr/1fr layout, Back button
   ("< Back" ghost button, DESIGN §7.6).
3. **Domain-score cards (45 min):** `DomainScoreCard.tsx` —
   score, chip, 1-line reason from M4, sparkline. No score without
   its reason.
4. **Vitals table (60 min):** `VitalsTable.tsx` — one row per
   indicator (14 rows, from `indicators`): vital | today |
   baseline (mean ± SD) | change + z-score in mono. Direction
   matters: show whether the change is worse or better, in words,
   not just a number.
5. **Side column (30 min):** active flags (M5 `FlagCard`s) +
   self-check card placeholder linking to M7 + PDF button (M8).
   Do not build the PDF or the form here — link to them.
6. **Verify (30 min):** run the acceptance checklist below.

### Edge cases, validation, loading / empty / error states

- **Unknown astronaut slug:** `/astronaut/nope` → "Crew member
  not found — back to Crew View" + Back button (404).
- **Day with no reading:** a day outside 1–180, or a reading
  missing for that day → clamp the day; if a reading is genuinely
  missing, show the row as "No reading for this day" in the table,
  not a blank dashboard. Scores for that day are computed from
  the 3-day window if possible, otherwise shown as "—" with the
  reason in plain language.
- **Baseline missing (SD = 0):** z-score is 0, not infinity or
  NaN (PLAN 1.4). The row shows "Baseline is flat — no variation
  in Days 1–21" instead of a z-score.
- **No active flags:** side column shows the designed empty state
  ("No flags today — all Nominal."), not a blank card.
- **Loading:** skeleton domain cards + skeleton table rows while
  fetching. Never a blank dashboard.
- **Offline:** cached dashboard + OFFLINE chip; the vitals table
  still shows the last synced day's values with "Last sync" text.
- **Validation:** `mission_day` in the URL is clamped to 1–180;
  `crewId` must be one of `kenji` / `amara` / `elena` (the demo
  crew slugs). Anything else is a 404, not a 500.

### Acceptance criteria

- [ ] Kenji Day 63: Sleep & Mind and Immune drifting; every vital
      row shows its baseline (mean ± SD) + change + z-score.
- [ ] Kenji Day 90: all 4 domain scores Nominal; overall 95.
- [ ] Each API (#5, #6, #10, #8) returns the same numbers the
      Dashboard shows (curl-checked).
- [ ] 2fr/1fr layout on desktop, stacked on mobile; no horizontal
      overflow at 360px; tables scroll horizontally on mobile.
- [ ] Unknown slug → 404 page with "Back to Crew View".
- [ ] No flags → "No flags today — all Nominal." empty state.
- [ ] Wifi off → Dashboard loads from cache with OFFLINE chip.
- [ ] No diagnosis language; footer disclaimer visible.
- [ ] PLAN tasks **2.5, 2.6** ticked only after every box above
      passes, then **stop and wait for the user's confirmation**
      before the next feature.

---

## M3 — Personal-baseline anomaly detection

**PLAN tasks:** 1.3 (generate data), 1.4 (scoring module), 2.1
(tables 001–004), 2.2 (seed Supabase).
**Depends on:** M10 (data). Everything else depends on this.
**Phase:** 1–2.

### What it does + user story

The scoring engine. The first 21 days are each astronaut's own
normal (mean + SD per indicator). Every later day is compared to
that personal baseline with direction-aware z-scores, not to a
population average. Isolation Forest runs across indicators to
catch unusual combined patterns.

> **As an astronaut, I want each alert to explain what changed
> and what to do, so that I don't need a doctor to interpret it.**
> (PRD §5, Kenji — the explanation comes from this engine's evidence)
>
> **As a flight surgeon, I want every flag to show its evidence
> (indicator, baseline, direction and size of change), so that I
> can trust it without OrbitCare claiming a diagnosis.**
> (PRD §5, Dr. Rao)

Thresholds (PRD §4, DATABASE §6): a domain's 3-day smoothed
z-score ≥ 1 → **Watch**; ≥ 2 → **Alert**. Below 1 → Nominal.

### Screens + components (DESIGN.md)

- **No screen of its own.** M3 is a library, not a page. Its
  output appears on M1 (status + score), M2 (vitals table +
  domain cards), M5 (flag evidence), M6 (normal band).
- **Files (ARCHITECTURE §2, PLAN 1.4):**
  `src/lib/scoring/baseline.ts` (mean + SD, Days 1–21),
  `zscore.ts` (direction-aware), `domains.ts` (4 domain scores,
  3-day smoothing), `src/lib/constants.ts`
  (`BASELINE_DAYS = 21`, `WATCH_THRESHOLD = 1`,
  `ALERT_THRESHOLD = 2`, mission length 180).
  Pure functions only — they take readings + baseline and return
  scores; they never fetch, never touch the DOM, never read the URL.
- **What the user sees of M3:** the z-score in mono next to a
  vital, the normal band on a chart, and the evidence line on a
  flag ("Sleep 5.2h vs your 7.4h baseline (−1.8 SD)" — PRD Flow 2;
  exact values follow the seed data, see §1 note on numbers).

### Database tables + API endpoints

| | |
|---|---|
| **Tables** | `baselines` (42 rows: 3 crew × 14 indicators; columns `*_mean`, `*_sd` per indicator), `daily_readings` (540 rows), `indicators` (14 rows — the reference list), `domains` + `domain_indicators` (which indicators feed which domain, with weight). `domain_scores` and `flags` are M3's *output* tables (see M4/M5). |
| **Endpoints** | `GET /api/v1/crew-members/{slug}/baselines` — API.md #6, §6.4 (14 baseline rows for one astronaut). `GET /api/v1/indicators` — #32, §7.4 (reference list). `POST /api/v1/admin/scoring/recompute` — #34, §8, ⚠️ flagged: no PRD feature of its own, seed/recovery only, service-role only. It recomputes `domain_scores` + `flags` from `baselines` + `daily_readings`. |
| **The 14 indicators** | Resting HR, HRV, systolic BP, diastolic BP, sleep hours, exercise minutes, body weight, grip strength, temperature, illness symptoms, mood, stress, reaction time, radiation dose. (DATABASE §2.1, `indicators`.) |

Delivered equivalent: `js/data.js` + `js/app.js` scoring in the
plain folder; `backend/lib/simulation.js` generates the data;
`backend/supabase/schema.sql` creates `crew`, `baselines`,
`daily_readings`, `self_checks` (4 tables, not the 13-table
DATABASE.md design — see SETUP.md for the difference).

### Step-by-step build order

1. **Generate the data (60 min, PLAN 1.3):** Python generator
   (`scripts/generate-mission-data.py`) — 180 days × 3 crew,
   Days 1–21 baseline, inject the Day-63 Kenji infection event +
   the other test events (solar-particle event, exercise slump,
   stress period, BP drift). Output `src/lib/data/mission-data.json`
   with `is_simulated: true` everywhere. Verify: 540 readings,
   Kenji Day 63 sleep is 5.2h in the generated file.
2. **Baseline module (45 min):** `baseline.ts` — mean + SD over
   Days 1–21 per astronaut per indicator. No data before Day 22
   is scored against a baseline.
3. **Z-score module (45 min):** `zscore.ts` — direction-aware:
   lower sleep is worse, higher BP is worse, lower HRV is worse,
   and so on per indicator (DATABASE §6 lists the direction for
   each of the 14). Standard deviation 0 → z-score 0, never
   infinity or NaN.
4. **Domain module (60 min):** `domains.ts` — map the 14
   indicators to the 4 domains (via `domain_indicators`, with
   weight), 3-day smoothing, Watch ≥ 1, Alert ≥ 2. Verify with
   the unit tests in step 5.
5. **Tests (45 min, PLAN 5.5 / `scoring.test.ts`):** baseline,
   z-score, thresholds, Day-63 detection. Kenji Day 63 Sleep &
   Mind is Watch; Day 90 is Nominal. A test with SD = 0 must
   return z = 0.
6. **Tables + seed (60 min, PLAN 2.1–2.2):** run DATABASE.md
   migrations 001–004, then the seed script (service role only).
   Verify: 1 mission, 3 crew, 42 baselines, 540 readings; a SQL
   query for Kenji Day 63 returns sleep 5.2h.
7. **Isolation Forest (60 min, seed-only):** Python
   (`scripts/validate-forest.py`) runs Isolation Forest across
   indicators on the generated data and confirms the injected
   events are flagged. Its result is a flag in the data, not a
   live service — do not build a live ML service in the MVP
   (ARCHITECTURE §1).

### Edge cases, validation, loading / empty / error states

- **SD = 0 (flat baseline):** z-score = 0. Never divide by zero.
- **Missing reading for a day:** that indicator is skipped for
  that day; the domain score uses the 3-day window around it.
  If a whole day is missing, the score shows "—" with the reason.
- **Day ≤ 21:** no anomaly detection — these days *are* the
  baseline. Show the value with "Baseline period" text, never a
  flag.
- **Isolation Forest disagrees with z-scores:** both are shown —
  the forest result is an extra flag with its own evidence, never
  a silent override of a z-score flag. A flag must never appear
  without evidence (see M5).
- **Recompute:** `POST /admin/scoring/recompute` is service-role
  only. An anon call gets `403 FORBIDDEN`, never a recompute.
  Re-running it is idempotent — scores/flags are a recomputable
  cache, not truth (DATABASE.md: "Scores/flags are a recomputable
  cache, not truth").
- **Loading / error:** M3 has no UI of its own, so its states are
  the consuming feature's states (M1/M2/M5 skeletons and errors).
  If scoring throws, the page must show its error state with
  Retry — never a blank screen, never a raw stack trace.
- **Validation:** `mission_day` 1–180; `crew_slug` must exist;
  indicator names must be one of the 14 in `indicators`. An
  unknown indicator is a `400`, not a silent skip.

### Acceptance criteria

- [ ] Baseline = mean + SD over Days 1–21, per astronaut per indicator.
- [ ] Direction-aware z-scores: lower sleep / lower HRV / higher
      BP / higher resting HR all count as worse, per DATABASE §6.
- [ ] SD = 0 → z-score 0 (unit test passes).
- [ ] 3-day smoothing; Watch ≥ 1, Alert ≥ 2.
- [ ] Kenji Day 63 Sleep & Mind is **Watch**; Day 90 is **Nominal**.
- [ ] Isolation Forest (seed script) flags the injected events,
      including Day 63; no live ML service exists.
- [ ] Seed counts: 1 mission, 3 crew, **42 baselines, 540 readings**.
- [ ] `GET /baselines` for Kenji returns 14 rows; recompute endpoint
      rejects anon calls with `403`.
- [ ] PLAN tasks **1.3, 1.4, 2.1, 2.2** ticked only after every box
      above passes, then **stop and wait for the user's confirmation**
      before the next feature.

---

## M4 — 4 domain scores

**PLAN tasks:** 1.4 (scoring module, shared with M3), 2.6
(Dashboard APIs), 3.2 (store scores, migration 005).
**Depends on:** M3. **Phase:** 1–3.

### What it does + user story

Four scores per astronaut per day, each Nominal / Watch / Alert
with a plain-language reason:

| Domain | What it covers |
|---|---|
| Heart (cardiovascular) | Resting HR, HRV, blood pressure |
| Bone & Muscle | Bone density, grip strength, exercise, weight |
| Sleep & Mind | Sleep hours, mood, stress, reaction time |
| Immune / Radiation | Temperature, illness symptoms, radiation dose |

> **As an astronaut, I want to see my health status in green /
> amber / red in under 2 minutes, so that I know whether I need
> to act today.** (PRD §5, Kenji)
>
> **As an astronaut, I want to see my trends against my own
> normal band, so that I can see a slow drift before it becomes
> a problem.** (PRD §5, Kenji — the domain score is the number
> that drifts.)

The overall score is the worst-first summary of the four — the
Crew View sorts on it. Kenji Day 63: overall 78 Watch (PRD target;
79 in the delivered code — see §1 note on numbers). Day 90: 95 Nominal.

### Screens + components (DESIGN.md)

- **Screens:** Astronaut Dashboard (§8.2, the 2×2 grid) and Crew
  View (§8.1, the 4 domain dots under each crew card).
- **Component:** `DomainScoreCard` (§7.3) — domain name 14px/600,
  score mono 36px, status chip, 1-line reason 14px secondary,
  mini sparkline (primary line only). The reason is mandatory:
  a score without its 1-line reason is not shipped.
- **Chart colour note (DESIGN §2):** Nominal chart lines use
  primary `#2E7FFF`; Nominal chips/text use success `#2FD6A3`.
  Do not swap them.

### Database tables + API endpoints

| | |
|---|---|
| **Tables** | `domain_scores` (2,160 rows: 3 crew × 180 days × 4 domains; columns: crew, day, domain, score, status, reason), `domains` (4 rows — reference), `domain_indicators` (junction: which indicators feed which domain, with weight). Scores are derived — recompute them, never hand-edit a row. |
| **Endpoints** | `GET /api/v1/crew-members/{slug}/domain-scores` — API.md #9, §6.6 (list over a range). `GET /api/v1/crew-members/{slug}/domain-scores/{mission_day}` — #10, §6.6 (4 scores for one day). `GET /api/v1/domains` — #33, §7.4 (reference list of the 4 domains). |

### Step-by-step build order

1. **Scoring (in M3, PLAN 1.4):** `domains.ts` — indicator →
   domain mapping with weights, 3-day smoothing, thresholds.
   If M3 is not done, do not start M4.
2. **Store (45 min, PLAN 3.2):** migration 005 creates
   `domain_scores` and loads the computed rows (2,160). Verify the
   row count in Supabase.
3. **API (45 min):** #9 and #10. #10 must return exactly 4 scores,
   one per domain, for the requested day. Verify with curl.
4. **Cards (45 min):** `DomainScoreCard.tsx` on the Dashboard,
   domain dots on the Crew Card. Score in mono, chip + reason
   always present.
5. **Verify (30 min):** acceptance checklist below.

### Edge cases, validation, loading / empty / error states

- **A domain with no data that day:** score shows "—" + the
  reason ("No reading for this domain on Day X"), not 0 and not a
  fake Nominal. 0 would be the worst possible score and must
  never be used as a placeholder.
- **Smoothing window at the edges (Day 22, Day 180):** the 3-day
  window uses the days that exist; do not invent readings for
  days outside 1–180.
- **All 4 Nominal:** the Dashboard still shows all 4 cards —
  never hide a Nominal domain. Hiding good news makes the bad
  news unreadable.
- **Loading:** skeleton domain cards while fetching.
- **Offline:** cached scores + OFFLINE chip (M9).
- **Validation:** `mission_day` 1–180; `domain` must be one of
  the 4 in `domains`.

### Acceptance criteria

- [ ] Exactly 4 domain scores per astronaut per day, each with a
      status (Nominal / Watch / Alert) + a 1-line reason.
- [ ] Kenji Day 63: Sleep & Mind and Immune are the drifting
      domains; overall Watch.
- [ ] Kenji Day 90: all 4 Nominal; overall 95.
- [ ] `domain_scores` has **2,160 rows** after a full seed.
- [ ] `GET /domain-scores/{day}` returns exactly 4 scores; the
      numbers match the Dashboard cards (curl-checked).
- [ ] No domain ever shows a score without its reason; no missing
      domain ever shows 0.
- [ ] PLAN tasks **1.4, 2.6, 3.2** (the M4 parts) ticked only after
      every box above passes, then **stop and wait for the user's
      confirmation** before the next feature.

---

## M5 — Plain-language flags + action plans

**PLAN tasks:** 3.1 (flags + action-plan functions), 3.2 (store,
migration 005, shared with M4), 3.3 (Flag cards), 3.4 (Flags +
Action Plan APIs), 3.5 (Action Plan page).
**Depends on:** M3, M4. **Phase:** 3.

### What it does + user story

Every flag says four things, in plain language: what we see, why
it matters, what to do now, and when to contact the flight
surgeon. Rule-based, no black box. The action plan is the flag's
checklist, in priority order.

> **As an astronaut, I want each alert to explain what changed
> and what to do, so that I don't need a doctor to interpret it.**
> (PRD §5, Kenji)
>
> **As a flight surgeon, I want every flag to show its evidence
> (indicator, baseline, direction and size of change), so that I
> can trust it without OrbitCare claiming a diagnosis.**
> (PRD §5, Dr. Rao)
>
> **As the crew medical officer, I want to see what action was
> already taken for a flag, so that I don't repeat or miss a step.**
> (PRD §5, Amara)

Kenji Day 63 has ≥ 3 flags (PLAN 3.1) — in the PDF example, 5
flags (PLAN 4.7). Every one of them has evidence + an action.
**0 unexplained alerts** is the PRD success metric.

### Screens + components (DESIGN.md)

- **Screens:** Astronaut Dashboard side column (§8.2, active
  flags) and Action Plan page (§8.4). The Action Plan page:
  astronaut selector + mission day on top; one action-plan card
  per active flag, in priority order; "Mark all done" Secondary
  button + Primary "Download PDF report" at the bottom.
- **Components:** `FlagCard` (§7.3) — left border 4px in status
  colour (Watch `#FFB020` / Alert `#FF4D5E` / Nominal `#2FD6A3`),
  title 16px/600, evidence 14px body, action 14px with a
  "What to do" label in 12px/600 muted. A flag card without its
  action is never rendered. Checklist items are checkboxes, 14px,
  unchecked by default. Every card ends with a "Contact flight
  surgeon if…" line in warning colour.

### Database tables + API endpoints

| | |
|---|---|
| **Tables** | `flags` (one row per indicator per day that crosses a threshold; columns: indicator, baseline, current value, direction-aware z-score, domain, status, plain-language explanation, action, timestamp, `is_acknowledged`, `acknowledged_at`), `action_plan_items` (one row per checklist item per flag; columns: flag, action text, `is_done`, `done_at`). One flag per indicator per day (unique constraint). |
| **Endpoints** | `GET /api/v1/crew-members/{slug}/flags` — API.md #11, §6.7. `GET /api/v1/flags/{flag_id}` — #12. `PATCH /api/v1/flags/{flag_id}` — #13 (acknowledge: `{"is_acknowledged": true}` → returns the flag with a timestamp). `GET /api/v1/crew-members/{slug}/action-plan` — #14, §6.8. `PATCH /api/v1/action-plan-items/{item_id}` — #15 (check off one item). |
| **Do not use** | No `PUT`, no action verbs in URLs — acknowledging is a `PATCH`, not `/flags/{id}/acknowledge` (API.md §1.3). |

### Step-by-step build order

1. **Functions (60 min, PLAN 3.1):** `src/lib/scoring/flags.ts`
   (one flag per indicator/day, evidence text, why-it-matters,
   action) + `action-plans.ts` (rule-based checklist +
   "contact flight surgeon if…"). Pure functions, unit-tested:
   every flag has evidence + action; 0 flags without an action.
2. **Store (30 min, PLAN 3.2):** migration 005 creates `flags`
   + `action_plan_items` and loads the computed rows. Verify:
   ≥ 3 flags for Kenji Day 63.
3. **Flag cards (45 min, PLAN 3.3):** `FlagCard.tsx` — all four
   parts (title, evidence, action, escalation line) or the card
   does not render.
4. **APIs (60 min, PLAN 3.4):** #11–#15. Verify with curl:
   PATCH acknowledge returns `is_acknowledged: true` with a
   timestamp; PATCH check-off persists.
5. **Action Plan page (60 min, PLAN 3.5):** `src/app/plan/
   page.tsx` — flags in priority order, checklists, escalation
   line, "Mark all done", PDF button (M8 link only — do not build
   the PDF here).
6. **Verify (30 min):** acceptance checklist below.

### Edge cases, validation, loading / empty / error states

- **A flag with no action:** must not exist. The generator
  (step 1) and the test both enforce it. If one appears, it is a
  bug in the generator, not a UI case to handle.
- **Acknowledging twice:** PATCH acknowledge is idempotent —
  the second call returns the same acknowledged flag, not an error.
- **Checking off an item twice:** idempotent; the item stays done.
- **"Mark all done":** checks off every visible item one by one;
  if one check-off fails, the others still save, and the failed
  one shows an inline error with Retry — never a silent partial save.
- **No active flags:** "No actions needed today." (Action Plan
  empty state) and "No flags today — all Nominal." (Dashboard).
- **Escalation line:** every flag carries "Contact flight surgeon
  if…" — including Nominal-adjacent flags. The line is never empty.
- **Loading:** skeleton flag cards while fetching.
- **Offline:** cached flags + action plan still readable; checking
  off an item while offline queues it (M9 sync queue) and shows
  "Will sync later" — the checkbox still updates locally.
- **Validation:** `flag_id` / `item_id` must exist, else `404`;
  acknowledge body must be a boolean; a check-off on a
  soft-deleted item is a `404`. No diagnosis language in any
  flag text — the words "diagnosis" / "you have…" are forbidden
  (checked in the unit test, PLAN 5.5 `flags.test.ts`).

### Acceptance criteria

- [ ] Kenji Day 63 has **≥ 3 flags**, every flag with evidence +
      action + escalation line. **0 flags without an action.**
- [ ] A flag card shows all four parts (title, evidence, action,
      escalation). No flag renders without its action.
- [ ] Action Plan page lists Kenji Day 63 as: rest / hydrate /
      light exercise / re-check tomorrow (PLAN 3.5).
- [ ] PATCH acknowledge returns `is_acknowledged: true` with a
      timestamp; PATCH check-off persists on refresh.
- [ ] "Mark all done" checks off every item; a failed item shows
      an inline error, the rest still save.
- [ ] No flags → "No actions needed today." / "No flags today —
      all Nominal."
- [ ] Wifi off → flags + plan readable from cache; a check-off
      queues and shows "Will sync later".
- [ ] No diagnosis language in any flag or action text.
- [ ] PLAN tasks **3.1, 3.2, 3.3, 3.4, 3.5** ticked only after
      every box above passes, then **stop and wait for the user's
      confirmation** before the next feature.

---

## M6 — Trends

**PLAN tasks:** 3.6 (Trends page), 3.7 (Trends API).
**Depends on:** M2, M3, M4. **Phase:** 3.

### What it does + user story

7-day and 30-day charts with the astronaut's own normal band
shown, so a slow drift is visible at a glance. Mission-day slider
+ Play replays the mission. A "Jump to Day 63" chip opens the demo
day in one tap.

> **As an astronaut, I want to see my trends against my own
> normal band, so that I can see a slow drift before it becomes
> a problem.** (PRD §5, Kenji)

Day-63 story: on the 30-day chart, Kenji's sleep/HRV line leaves
his normal band around Day 60–63.

### Screens + components (DESIGN.md)

- **Screen:** Trends — DESIGN §8.3. Controls on top: astronaut
  selector (segmented), 7-day / 30-day segmented control,
  mission-day slider + Play. Charts: one chart per domain
  (4 charts, stacked, full width). Each: title 16px/600, normal
  band shaded, current line primary, Watch/Alert markers, axis
  12px muted. Below: "What changed" — 3 bullet lines in plain
  language, generated from the flags. "Jump to Day 63" chip button.
- **Components:** `TrendChart` (§5/§7.9 — Recharts only, line
  chart + normal band as a shaded area, primary at 12% opacity),
  `SegmentedControl` (§7.2 — container `#081630`, radius 999px,
  selected segment `#2E7FFF`). Chart palette only (§2): main line
  `#2E7FFF`, band `#2E7FFF` at 12%, secondary line `#7FB3FF`,
  Watch marker `#FFB020`, Alert marker `#FF4D5E`. No pie charts,
  no 3D, no other chart colours.

### Database tables + API endpoints

| | |
|---|---|
| **Tables** | **None of its own.** `GET /trends` is derived from `daily_readings` + `baselines` (+ `domain_scores` for markers). API.md §11 flags it: it must never be given its own table. |
| **Endpoint** | `GET /api/v1/trends?crew_slug=kenji&from_day=34&to_day=63` — API.md #21, §6.10, ⚠️ flagged (derived). Response: one point per day with value + `baseline_low` / `baseline_high` for every point, plus markers. Range-based (`from_day`/`to_day`), not paginated. Also uses `GET /api/v1/crew-members/{slug}/readings` (#7) for the raw series. |

Delivered equivalent: `trends.html` + SVG charts in the plain
folder (not Recharts — the target uses Recharts per DESIGN §5).

### Step-by-step build order

1. **API (45 min, PLAN 3.7):** `GET /api/v1/trends` — derive
   from readings + baselines. Every point carries
   `baseline_low` / `baseline_high`. Verify with curl: the
   response matches the chart.
2. **Page shell (30 min):** `src/app/trends/page.tsx` — astronaut
   selector, 7/30-day segmented control, slider + Play,
   "Jump to Day 63" chip.
3. **Charts (60 min, PLAN 3.6):** `TrendChart.tsx` — 4 charts,
   normal band, markers, axis labels 12px muted. Text summary
   next to each chart for screen readers ("Sleep is below your
   baseline for 3 days" — DESIGN §9).
4. **"What changed" (30 min):** 3 plain-language bullets,
   generated from the M5 flags for the selected range — not
   hand-written copy.
5. **Verify (30 min):** acceptance checklist below.

### Edge cases, validation, loading / empty / error states

- **Range with no data (e.g. `from_day` > `to_day`, or days
  outside 1–180):** clamp to 1–180; if `from_day` > `to_day`
  after clamping, return `400` with a plain-language message and
  the UI shows the designed empty state, not a broken chart.
- **Day ≤ 21 in the range:** those days are the baseline — the
  chart shows the line inside its own band with "Baseline period"
  text, never a flag marker.
- **A day with a missing reading:** the line breaks (a gap), it
  does not interpolate a fake value. The gap is labelled in the
  text summary.
- **Switching 7/30 days:** re-renders without a reload, from the
  cache if offline. The slider position is kept.
- **Loading:** skeleton chart rectangles while fetching.
- **Offline:** cached series + OFFLINE chip; switching ranges
  still works from cache.
- **Empty:** a crew member with no readings at all → "No data
  for this astronaut yet." (setup failure, not a demo state).
- **Validation:** `crew_slug` must exist; `from_day`/`to_day`
  must be integers 1–180.
- **Accessibility:** charts are never colour-only — markers +
  labels + the text summary (DESIGN §9). `prefers-reduced-motion`
  disables chart animation.

### Acceptance criteria

- [ ] Kenji's sleep/HRV line leaves the normal band around
      **Day 60–63** on the 30-day chart.
- [ ] Switching 7-day / 30-day re-renders without a reload.
- [ ] Every chart point carries `baseline_low` / `baseline_high`
      from the `GET /trends` response (curl-checked).
- [ ] "What changed" shows 3 plain-language bullets from the flags.
- [ ] "Jump to Day 63" sets the slider to 63 in one tap.
- [ ] A missing reading shows as a gap, never an invented value.
- [ ] Wifi off → charts load from cache with the OFFLINE chip.
- [ ] Charts have markers + labels + text summary, not colour alone.
- [ ] PLAN tasks **3.6, 3.7** ticked only after every box above
      passes, then **stop and wait for the user's confirmation**
      before the next feature.

---

## M7 — Daily self-check

**PLAN tasks:** 4.1 (self-checks table, migration 006), 4.2
(self-check form), 4.3 (self-check APIs), 4.4 (wire into score).
**Depends on:** M2, M3, M4. **Phase:** 4.

### What it does + user story

An astronaut logs sleep, mood, stress and symptoms in under a
minute. The check saves — it is not lost on refresh — and it
feeds the Sleep & Mind domain score, so the Dashboard updates
without a reload.

> **As an astronaut, I want to log a daily self-check in under a
> minute, so that my mood, sleep and symptoms are part of my
> health picture.** (PRD §5, Kenji)

### Screens + components (DESIGN.md)

- **Screen:** Daily self-check — DESIGN §8.5. Form card,
  max-width 560px, centred: sleep (slider, hours), mood (5-option
  segmented: 1–5), stress (5-option segmented), symptoms
  (checkbox list), notes (textarea, optional). Submit: Primary
  "Save self-check". On save: toast "Saved — your Sleep & Mind
  score will update." + return to Dashboard. A saved check shows
  "Saved Day X" and can be edited.
- **Components:** `SelfCheckForm` (§7.2 inputs — bg `#050B1A`,
  border `#1E3A66`, radius 10px, labels 12px/600 above the field,
  required fields marked `*` in `#FF4D5E` with "(required)" for
  screen readers), `SegmentedControl` for mood/stress, `Toast`
  (§7.8) for the saved message.

### Database tables + API endpoints

| | |
|---|---|
| **Tables** | `self_checks` (one row per crew per day, ignoring soft-deleted rows — partial unique index, DATABASE §2.2 / PLAN 4.1; columns: astronaut, day 1–180, sleep, mood 1–5, stress 1–5, symptoms, notes, `sync_status`, soft-delete columns). |
| **Endpoints** | `POST /api/v1/crew-members/{slug}/self-checks` — API.md #17, §6.9 (201, `sync_status: "pending"`). `GET /api/v1/crew-members/{slug}/self-checks` — #16 (list). `GET /api/v1/crew-members/{slug}/self-checks/{mission_day}` — #18 (one day). `PATCH /.../self-checks/{mission_day}` — #19 (edit; resets `sync_status` to `"pending"`). `DELETE /.../self-checks/{mission_day}` — #20 (soft delete only). |
| **Rules** | A second POST for the same crew-day returns **409 CONFLICT**. POST requires an `Idempotency-Key` header (API.md §3.3) — retrying the same key returns the original response, not a duplicate row. |

Delivered equivalent: `POST /api/self-check` in `backend/server.js`
(unversioned); the plain folder's self-check saves to localStorage
only and feeds the Behavioural score — the target must use the API
above.

### Step-by-step build order

1. **Table (30 min, PLAN 4.1):** migration 006 — `self_checks` +
   the partial unique index. Verify: inserting two checks for
   Kenji Day 63 fails on the unique constraint.
2. **Form (60 min, PLAN 4.2):** `src/app/self-check/page.tsx` +
   `SelfCheckForm.tsx`. Validation: sleep + mood required, others
   optional. Submit with no mood → inline error (see below).
3. **APIs (60 min, PLAN 4.3):** #16–#20. Verify with curl: POST
   returns 201 + `sync_status: "pending"`; a second POST for the
   same day returns 409; PATCH resets `sync_status` to `"pending"`.
4. **Wire into the score (45 min, PLAN 4.4):** after a save,
   recompute the Sleep & Mind score locally from the new check
   (no reload, no network wait). Files: `lib/scoring/domains.ts` +
   `SelfCheckForm.tsx`.
5. **Verify (30 min):** acceptance checklist below.

### Edge cases, validation, loading / empty / error states

- **Validation (the rules — enforce in the form AND the API):**
  sleep is required (a number, 0–24h); mood is required (1–5);
  stress optional (1–5, defaults to 3); symptoms are checkboxes
  (0 or more); notes optional, max 500 characters. Mood/stress
  outside 1–5 → `400` with a plain-language message, never a
  silent clamp in the target API (the delivered `server.js`
  clamps — do not copy that behaviour; the API.md contract is
  a 400). Sleep outside 0–24 → `400`.
- **Duplicate day:** second POST for the same crew-day → `409
  CONFLICT` with the existing check in the response, so the UI
  can offer "Edit" instead of failing silently.
- **Editing:** PATCH edits a saved check and resets `sync_status`
  to `"pending"` (it must sync again). Editing a soft-deleted
  check → `404`.
- **Withdrawing:** DELETE is a soft delete — the row stays with
  `deleted_at` set, and a new check can be created for that day
  afterwards (the unique index ignores soft-deleted rows).
- **Unknown astronaut / day out of range:** `404` / `400`
  respectively, with plain-language messages.
- **Loading:** submit button shows spinner + "Loading…" and is
  disabled while saving. Never allow a double-submit — the button
  is disabled from the first tap until the response arrives.
- **Offline:** the check saves to the offline cache immediately
  and shows "Saved — Day X" + toast, with a queued sync (M9).
  It is never lost on refresh. When a link returns, it syncs and
  `sync_status` becomes `"synced"`.
- **Empty:** no check for today yet → the form is blank with
  "No self-check for Day X yet." No check for a past day →
  "No self-check recorded for Day X." with an "Add one" action.
- **Score update:** after a bad night is logged, the Sleep &
  Mind score drops on the Dashboard immediately, without a reload.

### Acceptance criteria

- [ ] Submit with no mood → inline error, nothing saved.
- [ ] Submit complete → toast "Saved — your Sleep & Mind score
      will update." + return to Dashboard; the check shows
      "Saved Day X" and survives a refresh.
- [ ] POST returns **201**, `sync_status: "pending"`; a second
      POST for the same day returns **409 CONFLICT**.
- [ ] PATCH edits the check and resets `sync_status` to `"pending"`.
- [ ] DELETE soft-deletes; a new check can then be created for
      that day.
- [ ] Log a bad night for Kenji → his Sleep & Mind score drops
      on the Dashboard immediately, no reload.
- [ ] Wifi off → the check still saves locally, shows "Saved —
      Day X", and syncs when the link returns.
- [ ] PLAN tasks **4.1, 4.2, 4.3, 4.4** ticked only after every
      box above passes, then **stop and wait for the user's
      confirmation** before the next feature.

---

## M8 — PDF health report

**PLAN tasks:** 4.7 (PDF report), 4.8 (report APIs).
**Depends on:** M1–M7 output (scores, flags, action plan).
**Phase:** 4.

### What it does + user story

Download a real report for any mission day: crew at a glance,
per-astronaut scores, vitals vs baseline, every flag with its
full explanation, complete action plan. Generated on-device,
works offline, in under 10 seconds.

> **As the crew medical officer, I want to download a PDF report
> for any mission day, so that I can hand a clear summary to
> Earth when a link returns.** (PRD §5, Amara)
>
> **As a flight surgeon, I want a report that says "synthetic
> data only / decision support only", so that I never mistake a
> prototype for a clinical record.** (PRD §5, Dr. Rao)

### Screens + components (DESIGN.md)

- **In-app:** a Primary "Download PDF report" button (on Crew
  View, Dashboard and Action Plan). Tap → generate on-device →
  toast on success → file downloads as
  `OrbitCare-Day-<day>-report.pdf`. The button is never silently
  dead: on failure it shows a plain-language inline error + Retry.
- **PDF layout (light mode only — DESIGN §8.7):**
  - **Page 1 (cover):** title, mission day, crew at a glance (table).
  - **Page 2:** per-astronaut scores (4 domain scores each).
  - **Page 3:** vitals vs baseline + flags with full explanations.
  - **Page 4:** complete action plan + disclaimer + AI disclosure.
  - Footer on every page: "Simulated data only · Decision support
    only · Not a medical device" + page number.
  - Typography: Inter, same sizes as DESIGN §3, light-mode
    colours only (§2).
- **Component:** `ReportDocument` (`@react-pdf/renderer` —
  ARCHITECTURE §1, the only PDF library) + `report-data.ts`
  (shape the report data for the document). The PDF is built
  from React components on-device — no server PDF service.

### Database tables + API endpoints

| | |
|---|---|
| **Tables** | `reports` (metadata only: id, mission day, crew snapshot, `file_path` / `download_url`, `created_at`, soft-delete columns). The PDF file itself is **not** stored in the database — it is built on-device. |
| **Endpoints** | `GET /api/v1/reports` — API.md #22, §7.1 (list). `POST /api/v1/reports` — #23 (create/register a report, 201). `GET /api/v1/reports/{report_id}` — #24 (metadata). `GET /api/v1/reports/{report_id}/download` — #25 (returns `application/pdf` when a server copy exists, otherwise `404` telling the client to generate on-device). `DELETE /api/v1/reports/{report_id}` — #26 (soft delete). |

Delivered equivalent: **not done.** The delivered frontend's
report download is a **`.txt` file, not a PDF** (README.md,
SETUP.md). `GET /api/report?day=63` in `backend/server.js`
returns plain text. Do not present the `.txt` as M8 done — M8
means a real 4-page PDF.

### Step-by-step build order

1. **Report data (45 min):** `src/lib/pdf/report-data.ts` —
   assemble, for a day: crew at a glance, per-astronaut scores,
   vitals vs baseline, every flag with its full explanation,
   complete action plan. Same data the UI shows — never a
   separate, diverging copy.
2. **Document (60 min, PLAN 4.7):** `src/components/report/
   ReportDocument.tsx` — 4 pages exactly as in §8.7, light mode,
   footer on every page. No diagnosis language anywhere in the
   document.
3. **Button + download (30 min):** wire the Primary button on
   Crew View / Dashboard / Action Plan to generate on-device and
   download `OrbitCare-Day-<day>-report.pdf`. Toast on success.
4. **Report APIs (45 min, PLAN 4.8):** #22–#26. POST returns
   201; download returns `application/pdf` when a server copy
   exists, otherwise the documented `404` (client generates
   on-device).
5. **Verify (30 min):** acceptance checklist below — including
   the wifi-off download.

### Edge cases, validation, loading / empty / error states

- **No flags that day:** Page 3 still exists and says "No flags
  on Day X — all Nominal." Never ship a 3-page PDF because a day
  was quiet.
- **No data for the day:** the button shows an inline error
  ("No data for Day X — run the seed first") and does not start
  a download. Never download an empty file.
- **Generation fails:** "The PDF couldn't be created. Try again —
  your data is still here." + Retry. The button never silently
  does nothing (ARCHITECTURE §5).
- **Generation is slow:** the button shows spinner + "Loading…"
  and is disabled while generating. Target: < 10 seconds (PRD §8);
  generate only when the user taps Download, never on page load.
- **Offline:** the PDF is built on-device from cached data — it
  must work with wifi off. If the data is not cached, the button
  shows "Needs connection — will sync later" (DESIGN §6) instead
  of failing.
- **Validation:** `mission_day` 1–180; `report_id` must exist
  for #24–#26, else `404`. A report for a day with no crew data
  is a `400`, not an empty PDF.
- **File name:** always `OrbitCare-Day-<day>-report.pdf` — never
  a generic `report.pdf`, never a name with the astronaut's name
  only (it is a crew report).

### Acceptance criteria

- [ ] Download on Day 63 → `OrbitCare-Day-63-report.pdf`,
      **4 pages**, Kenji **78 Watch with 5 flags** (PLAN 4.7),
      every flag with its full explanation.
- [ ] Page 1: crew at a glance. Page 2: per-astronaut scores.
      Page 3: vitals vs baseline + flags. Page 4: complete action
      plan + disclaimer + AI disclosure.
- [ ] Footer on every page: "Simulated data only · Decision
      support only · Not a medical device" + page number.
- [ ] Generated in **< 10 seconds**, on-device, **with wifi off**.
- [ ] POST `/reports` returns 201; download returns
      `application/pdf` (or the documented 404 for on-device
      generation).
- [ ] No flags that day → Page 3 says "No flags on Day X — all
      Nominal." (still 4 pages).
- [ ] No diagnosis language anywhere in the PDF.
- [ ] PLAN tasks **4.7, 4.8** ticked only after every box above
      passes, then **stop and wait for the user's confirmation**
      before the next feature.

---

## M9 — Offline-first

**PLAN tasks:** 4.5 (offline cache + sync queue), 4.6 (sync
endpoints), 1.5 (app shell: sync chip), 5.3 (RLS, migration 009).
**Depends on:** M1–M8 (it wraps them). **Phase:** 1, 4–5.

### What it does + user story

Dashboard, trends, action plans and the report work with no
connection. Data is stored locally / on board; it syncs to Earth
only when a link is available. The header always shows the sync
state clearly: LIVE / STALE / OFFLINE.

> **As an astronaut, I want the app to work with no Earth
> signal, so that I am not helpless when the link is down.**
> (PRD §5, Kenji)

DESIGN principle 3: **offline is normal, not an error.** The app
must look complete with no connection.

### Screens + components (DESIGN.md)

- **Every screen:** the header (§7.6) carries the sync status
  chip — LIVE / STALE / OFFLINE (muted chip, uppercase, 12px)
  — plus "Last sync: Day X, HH:MM" in caption text where data
  is shown. The chip is quiet, never a red error banner.
- **Components:** the offline cache (`src/lib/store/
  offline-cache.ts` — localStorage / IndexedDB read/write +
  sync queue), the fetch wrapper (`src/lib/api/client.ts` —
  5-second timeout, 1 retry for network errors only, offline
  fallback to cache, single error shape
  `{ code, message, retryable }`), `src/lib/api/errors.ts`,
  and the small React context for sync status
  (`mission-store.ts` — ARCHITECTURE §4). No other page keeps
  its own sync logic.

### Database tables + API endpoints

| | |
|---|---|
| **Tables** | `sync_log` (one row per sync attempt: what was synced, when, `sync_status` — `pending` / `synced` / `failed`, `last_sync_at`), `self_checks` (the queued rows — `sync_status: "pending"` until a sync succeeds). |
| **Endpoints** | `GET /api/v1/sync/status` — API.md #27, §7.2 (LIVE / STALE / OFFLINE + `pending_count` + last sync). `POST /api/v1/sync` — #28 (sync the queued items; returns the original response for an empty queue, never an error). `GET /api/v1/sync-log` — #29 (V2 handover log — list sync history). |

### Step-by-step build order

1. **Cache first (60 min, PLAN 4.5 — do this early, in Phase 1
   alongside the shell):** `offline-cache.ts` — read/write the
   last synced mission data (crew, baselines, readings, scores,
   flags) to localStorage / IndexedDB. Every page renders from
   the cache first, then refreshes from the API in the background.
2. **Fetch wrapper (45 min, PLAN 4.5):** `lib/api/client.ts` —
   5s timeout, 1 retry for network errors only (never for 4xx),
   offline fallback to cache, single error shape. No `fetch()`
   calls scattered in components — every API call goes through
   this wrapper.
3. **Sync chip (30 min, PLAN 1.5):** header chip + "Last sync"
   text on every page. The chip reads `GET /sync/status`.
4. **Sync queue (60 min, PLAN 4.5):** writes (self-checks,
   check-offs, acknowledgements) go to the cache + queue
   immediately, then sync when a link returns. The queue retries
   at most once per sync attempt and stops after 3 failures —
   then the header shows "3 items waiting to sync", not an error
   banner (ARCHITECTURE §5).
5. **Sync endpoints (45 min, PLAN 4.6):** #27, #28, #29 +
   migration 007 (`reports`, `sync_log`). Verify: after a sync,
   `sync_log` has a row with `sync_status: "synced"`, and
   `GET /sync/status` returns `live` with `pending_count: 0`.
6. **RLS (30 min, PLAN 5.3):** migration 009 — RLS on every
   table, MVP policies (anon: SELECT simulated data + INSERT
   self-check only; service role: everything). Verify: a browser
   call with the anon key trying to UPDATE a reading gets
   `403 FORBIDDEN`.
7. **Verify (30 min):** the wifi-off acceptance checklist below.

### Edge cases, validation, loading / empty / error states

- **First run, never synced, no cache:** the app shows the
  designed empty state ("No mission data yet — run the seed")
  once. After the first sync, this state must never appear again.
- **Wifi drops mid-page:** the page keeps showing the cached
  data and the chip flips to OFFLINE. Nothing the user was
  looking at disappears.
- **A write while offline (self-check, check-off, acknowledge):**
  it saves locally, shows "Saved — will sync later", and queues.
  It is never lost on refresh. On reconnect it syncs in the
  background — the user never waits for the network (PRD Flow 1,
  ARCHITECTURE §3.3).
- **Sync fails 3 times:** the queue stops retrying and the
  header shows "N items waiting to sync". No error banner, no
  auto-retry loop.
- **A 503 / timeout from the API:** not an error banner. Cached
  data + STALE/OFFLINE chip, background retry (API.md §4.4).
- **Conflicting edits (same self-check edited on two devices):**
  last-write-wins by `updated_at`; the losing edit is kept in
  `sync_log` with `sync_status: "failed"` and a plain-language
  note — never silently overwritten with no trace.
- **Validation:** `sync_status` is only `pending` / `synced` /
  `failed`. A queued item with no `Idempotency-Key` (POST) is
  rejected before it enters the queue.
- **Loading:** the first load from cache is instant (< 1s,
  ARCHITECTURE §8). A background sync never shows a loading
  spinner over the data — only the chip changes.
- **Supabase unreachable for a long time:** the app keeps
  working from cache indefinitely. The only thing that stops
  working is new data arriving — and the chip says so.

### Acceptance criteria

- [ ] Wifi off → Crew View, Dashboard, Trends and Action Plan
      **all load from cache** with the OFFLINE chip + "Last sync" text.
- [ ] Wifi on → a queued self-check syncs; `GET /sync/status`
      returns `live` with `pending_count: 0`.
- [ ] After a sync, `sync_log` has a row with
      `sync_status: "synced"`.
- [ ] A write while offline saves locally, survives refresh, and
      shows "Will sync later".
- [ ] After 3 failed syncs, the header shows "N items waiting
      to sync" — no error banner, no retry loop.
- [ ] Anon key trying to UPDATE a reading gets `403 FORBIDDEN`
      (RLS, migration 009).
- [ ] First load from cache is < 1 second; a background sync never
      blocks the UI.
- [ ] PLAN tasks **4.5, 4.6, 1.5, 5.3** ticked only after every
      box above passes, then **stop and wait for the user's
      confirmation** before the next feature.

---

## M10 — Simulated data, clearly labelled

**PLAN tasks:** 1.3 (generate data), 2.1 (tables 001–004),
2.2 (seed Supabase), 5.2 (missions + reference APIs).
**Depends on:** nothing. Everything else depends on this.
**Phase:** 1–2, 5.

### What it does + user story

180 days, 3 astronauts, each with their own baseline. One
injected decline event (Day 63, Kenji) so the demo can prove
detection. Every screen labels the data "Simulated" — the user
and the judges can never mistake the prototype for real health
data.

> **As a judge, I want to see the AI disclosure and data
> sources, so that I know what was built, what was simulated,
> and what was AI-assisted.** (PRD §5)
>
> **As a flight surgeon, I want a report that says "synthetic
> data only / decision support only", so that I never mistake a
> prototype for a clinical record.** (PRD §5, Dr. Rao)

### Screens + components (DESIGN.md)

- **Every screen:** the header carries a `SIMULATED DATA` tag
  (12px, muted, uppercase, next to the wordmark — DESIGN §7.6),
  and the footer carries the disclaimer on every page.
  The PDF carries it on every page (M8). The README carries it
  (PLAN 9.3).
- **No component of its own.** M10 is the data + the labelling
  rule. Its visible parts are the tag, the footer, and the
  "Baseline period" / "Simulated" text on the Dashboard and Trends.

### Database tables + API endpoints

| | |
|---|---|
| **Tables** | `missions` (1 row: 180-day mission, start/end, `is_simulated: true`), `crew_members` (3 rows), `baselines` (42 rows), `daily_readings` (540 rows), `indicators` (14 rows), `domains` (4 rows), `domain_indicators` (junction). Full-seed counts (DATABASE §9): 1 mission, 3 crew, 42 baselines, **540 readings, 2,160 domain scores**. |
| **Endpoints** | `GET /api/v1/missions` — API.md #2, §6.2 (list missions). `GET /api/v1/missions/{mission_id}` — #3 (one mission). `GET /api/v1/indicators` — #32 (14 indicators). `GET /api/v1/domains` — #33 (4 domains). |
| **Injected events (DATABASE §9, PLAN 1.3)** | Infection (Day 63, Kenji), solar-particle event (radiation spike), exercise slump, stress period, BP drift. Each one must be detectable — if an event is not flagged by M3, the seed data is wrong, not the detector. |

Delivered equivalent: **done and verified live.** The plain
folder's `backend/lib/simulation.js` generates the data;
`backend/supabase/schema.sql` creates 4 tables; the seed was run
against the real Supabase project on 15 Nov 2026 and printed
`Seeded Supabase: 3 crew, 3 baselines, 540 daily readings.`
Health check returned `{"ok":true,"storage":"supabase",
"dailyReadings":540,"seeded":true}`. (SETUP.md §4–§6.)

### Step-by-step build order

1. **Generate (60 min, PLAN 1.3):** Python generator —
   180 days × 3 crew, Days 1–21 baseline, inject the 5 events
   above. Output JSON with `is_simulated: true` everywhere.
   Verify: 540 readings, Kenji Day 63 sleep is 5.2h.
2. **Tables (45 min, PLAN 2.1):** migrations 001–004
   (`missions`, `indicators`, `domains`, `domain_indicators`,
   `crew_members`, `baselines`, `daily_readings`). Verify: 1 / 3 / 42.
3. **Seed (30 min, PLAN 2.2):** seed script, service role only.
   Verify: `daily_readings` has 540 rows; Kenji Day 63 returns
   sleep 5.2h.
4. **Labelling (30 min):** `SIMULATED DATA` tag in the header,
   footer disclaimer on every page, "Simulated" on the PDF,
   AI disclosure + data sources in the README. Check every page
   — a page without the label fails this feature.
5. **Reference APIs (30 min, PLAN 5.2):** #2, #3, #32, #33.
   Verify each returns its reference rows.
6. **Verify (15 min):** acceptance checklist below.

### Edge cases, validation, loading / empty / error states

- **A row with `is_simulated = false`:** must not exist in the
  MVP. The seed script sets `true` everywhere; a query for
  `is_simulated = false` must return 0 rows. If it returns any,
  the seed is wrong — stop and fix it.
- **Real data appears:** stop. Per PRD §3 and ARCHITECTURE §9,
  if real health data ever appears, stop and update PRD +
  ARCHITECTURE first. Never mix real data into the simulated set.
- **An event is not flagged:** the seed data is wrong, not the
  detector. Fix the generator (the event's magnitude, day, or
  astronaut), re-seed, re-run M3 — do not lower the M3 thresholds
  to make the event appear.
- **Seed run twice:** safe — upserts for crew/baselines, daily
  readings replaced, never duplicated (540 stays 540).
- **Empty database:** the app shows "No mission data yet — run
  the seed (see SETUP.md)" — never a crash, never fake data
  invented by the UI.
- **Loading / error:** M10's states are the consuming features'
  states (M1 skeletons, M9 offline chip). The labelling itself
  has no loading state — the tag and footer render with the shell.
- **Validation:** mission length is 180, baseline is 21 (both
  in `constants.ts` and in the `missions` row). Changing either
  requires a PRD update first.

### Acceptance criteria

- [ ] Full seed: **1 mission, 3 crew, 42 baselines, 540 readings,
      2,160 domain scores.**
- [ ] Kenji Day 63 sleep is **5.2h** in the generated/seeded data;
      the Day-63 infection event is flagged by M3.
- [ ] Every screen shows the `SIMULATED DATA` tag in the header
      and the footer disclaimer. No page without them.
- [ ] A query for `is_simulated = false` returns **0 rows**.
- [ ] `GET /missions`, `GET /indicators`, `GET /domains` return
      their reference rows.
- [ ] Re-running the seed keeps the counts at 540 readings
      (no duplicates).
- [ ] README has the AI disclosure, data sources, and "not a
      medical device / synthetic data only".
- [ ] PLAN tasks **1.3, 2.1, 2.2, 5.2** ticked only after every
      box above passes, then **stop and wait for the user's
      confirmation** before the next feature.

---

## 2. Feature index — one line per feature, for the build log

| Feature | PLAN tasks | Built after | User confirms before |
|---|---|---|---|
| M10 Simulated data | 1.3, 2.1, 2.2, 5.2 | — (first) | M3 |
| M3 Baseline detection | 1.3, 1.4, 2.1, 2.2 | M10 | M4 |
| M4 Domain scores | 1.4, 2.6, 3.2 | M3 | M1 |
| M1 Crew View | 2.3, 2.4 | M4 | M2 |
| M2 Dashboard | 2.5, 2.6 | M1 | M5 |
| M5 Flags + action plans | 3.1–3.5 | M2 | M6 |
| M6 Trends | 3.6, 3.7 | M5 | M7 |
| M7 Self-check | 4.1–4.4 | M6 | M8 |
| M8 PDF report | 4.7, 4.8 | M7 | M9 |
| M9 Offline-first | 4.5, 4.6, 1.5, 5.3 | M8 (cache first, in Phase 1) | Launch (Phase 9) |

**How to log a finished feature:** copy its acceptance checklist
into the chat message to the user, with the actual results filled
in (curl output, Day-63 numbers, a screenshot). Tick the PLAN
tasks listed in that feature's section. Then stop. Do not start
the next feature until the user says so — even if the next one
looks small.

## 3. What is NOT in this file

- **V2 features** (PRD §4): Emergency Guide, radiation shelter
  alert, health forecast, medicine stock countdown, exercise
  prescription, sync/handover log. They have their own PLAN
  tasks (Phase 7, 7.1–7.4). Do not build them as part of M1–M10.
  (Note: the one-tap Emergency Guide already exists in the
  separate Orbitspace artifact — it is not in the code files,
  and it is not an MVP feature.)
- **Auth** (PLAN Phase 6): V2 only, skip for the hackathon.
- **The Next.js setup itself** (PLAN Phase 1, tasks 1.1–1.2, 1.5–1.6):
  repo, tokens, app shell, Vercel deploy. Those are in PLAN.md
  and SETUP.md, not in a feature section — build them before M10
  if the team picks the Next.js target, or skip them if the team
  keeps the plain-HTML folder (ARCHITECTURE §1.1).
- **Polish / Launch** (PLAN Phases 8–9): accessibility pass,
  mobile pass, performance budgets, screenshots, README, Project
  Tab submit. Those happen after all 10 features pass.

---

*FEATURES.md v1.0 — 15 Nov 2026. Built from PRD.md §4–§6,
PLAN.md Phases 1–5, API.md §2/§6/§7 (34 endpoints, #1–#34),
DATABASE.md §2/§9 (13 tables + V2 emergency_guide_steps),
DESIGN.md §6–§9. Delivered-code status checked against
`orbitspace-code/` and the live Supabase seed verified 15 Nov
2026 (3 crew, 3 baselines, 540 readings; Day 63 Kenji 79 Watch
in the delivered code vs the PRD target of 78 — same Watch band,
see the note in §1). Source of truth: PRD > DESIGN >
ARCHITECTURE > DATABASE > API. If this file conflicts with one
of those, that file wins.*
