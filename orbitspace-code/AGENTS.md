# AGENTS.md — OrbitCare (Orbitspace)

Rulebook for every AI coding assistant working in this repo.
Read the source-of-truth files before you write any code.
If this file conflicts with a source-of-truth file, that file wins.

## Project summary (5 lines)

1. OrbitCare is an offline-first astronaut health dashboard for a 180-day simulated Mars mission with 3 crew (Kenji, Amara, Elena).
2. It compares each astronaut to their own Days 1–21 baseline (direction-aware z-scores) and shows 4 domain scores, plain-language flags, and action plans.
3. The Crew View is worst-first. The Day-63 demo: Kenji flags Watch (score 78), recovers to Nominal by Day 90.
4. It works offline, syncs to Earth only when a link returns, and downloads a real 4-page PDF report on-device.
5. Decision support only. Simulated data only. Not a medical device. Never claim a diagnosis.

## Source of truth — priority order

1. `PRD.md` — what to build, what to cut, what to demo. Wins on scope.
2. `DESIGN.md` — colours, fonts, spacing, components, accessibility. Wins on how it looks.
3. `ARCHITECTURE.md` — stack, folder structure, data flow, state, errors. Wins on how it is built.
4. `DATABASE.md` — tables, relationships, indexes, RLS, migrations, seed data. Wins on data.
5. `API.md` — every endpoint under `/api/v1`, error format, pagination, rate limits. Wins on the API contract.

## DO

- Follow the folder structure in ARCHITECTURE.md exactly. Do not invent a new layout.
- Reuse existing components, functions, and tokens before writing new ones.
- Write small, focused functions. One function does one thing. Keep files short.
- Name things the way PRD / DATABASE.md name them: `crew`, `baseline`, `flag`, `action plan`, `self-check`, `Nominal`, `Watch`, `Alert`.
- Use only the colours and fonts in DESIGN.md. Use only the tokens in `tokens.css`. Never hard-code a new HEX.
- Comment complex logic: explain why, not what. A z-score function needs one line on direction.
- Handle errors and loading states on every screen: skeleton while loading, plain-language error with a retry, never a blank screen.
- Handle offline first: render from cache, sync in the background, show LIVE / STALE / OFFLINE.
- Keep every flag explainable: evidence + action, always. Zero unexplained alerts.
- Test what you change: Day 63 must show Kenji worst-first in Watch; Day 90 must show him Nominal.

## DO NOT

- Do not change the tech stack (Next.js + React + TypeScript + Tailwind + Recharts + Supabase + Vercel).
- Do not add a new library without asking the user first. Say what it is, why it is needed, and what it replaces.
- Do not modify the database schema without updating DATABASE.md first, then writing a new migration. Never edit a migration that already ran.
- Do not delete or rewrite working code unless the user asked for it. Fix the bug, keep the rest.
- Do not hard-code secrets, API keys, passwords, or tokens. Use env vars (`.env.example` has placeholders only).
- Do not add diagnosis, treatment, or prescription language anywhere — code, UI, API, or PDF.
- Do not use real health data. All data is simulated and labelled.
- Do not invent a new endpoint, table, colour, or font. If it is not in the source-of-truth files, ask first.

## Workflow

1. **Plan first.** Say what you will change, which files, and which source-of-truth rule it follows. Wait if the plan is unclear.
2. **Code.** Make the smallest change that does the job. Follow the DO rules above.
3. **Explain.** Give a short summary: what changed, which files, and how to check it (e.g. "Open Day 63 — Kenji is worst-first, Watch").

## If a request conflicts with a source-of-truth file

Stop. Do not guess, do not work around it, do not rewrite the rule quietly.
Tell the user exactly which file and rule it conflicts with, and ask them before proceeding.
