# OrbitCare — Product Requirements Document (PRD)

**Version:** 1.0 — 15 Nov 2026
**Team:** Team Alpha (4 people)
**Event / context:** NASA Space Apps Challenge 2026, Harohalli Local Event — "Create Health Monitoring Software for Astronauts on Space Missions" (Intermediate)
**Product name:** OrbitCare (working build name: Orbitspace)
**Status:** MVP for the 14–15 Nov 2026 hackathon. This PRD is the source of truth for what to build, what to cut, and what to demo.
**One line:** When Earth is 20 minutes away by radio and there is no hospital, astronauts need software that spots health changes early — against their own baseline — and tells them what to do next, even offline.

---

## 1. Problem statement

Long-duration missions (e.g. a 180-day Mars transit) expose a small crew to radiation, isolation and confinement, altered gravity, and a hostile closed environment. Those conditions can cause immune changes, bone and muscle loss, cardiovascular events, and behavioural-health problems.

On Earth, a patient can call a doctor. In deep space they cannot:

- Communication delay is ~20 minutes each way — no real-time help from Earth.
- There is no hospital, no flight surgeon on board, and limited medical supplies.
- Changes are slow and easy to miss: a resting heart rate drifting up, sleep getting shorter, grip strength falling. By the time a symptom is obvious, the problem is already serious.
- Population "normal ranges" are misleading in space. What matters is change from *that astronaut's own* normal.

Existing health apps assume a clinic, the internet, and a doctor on call. None of that holds on a spacecraft.

**OrbitCare's job:** give each astronaut a daily, plain-language answer to "Am I OK, and if not, what should I do now?" — and give the crew a worst-first view of who needs attention first.

### What success looks like in one demo

Day 63 of a 180-day mission. Crew Member Kenji's sleep, HRV and mood have been drifting for days. OrbitCare flags him worst-first in the Crew View, shows his trend against his own Days 1–21 baseline, explains *why* in plain language, gives an action plan, and lets the crew download a 4-page PDF report — all offline.

---

## 2. Target users — personas

### Persona 1: Kenji — the Astronaut (primary user)
- **Who:** Crew member on a 180-day mission, e.g. mission specialist, age 30s–40s. Fit, trained, not a doctor.
- **Needs:** A 2-minute daily check. "Am I OK today? Anything getting worse? What do I do?"
- **Frustrations:** Dense medical dashboards, unexplained scores, alerts with no action, apps that need Earth/internet to work.
- **Success:** Opens the dashboard, sees green/amber/red per health area, reads one plain-language flag, follows one action plan, logs a self-check in under 2 minutes.

### Persona 2: Amara — the Crew Medical Officer / Commander (secondary user)
- **Who:** The crew member responsible for crew health on board. Also not a doctor, but the decision-maker.
- **Needs:** A crew-wide view, worst-first. Who is declining, how fast, and what has already been done? A report to send to Earth when a link returns.
- **Frustrations:** Having to open 3 separate profiles to compare people; no history; no shareable summary.
- **Success:** Opens Crew View, sees the worst crew member first, opens their trends and action plan, downloads the PDF report for the Earth handover.

### Persona 3: Dr. Rao — the Flight Surgeon on Earth (tertiary user, remote)
- **Who:** Doctor at mission control, receiving data hours/days late.
- **Needs:** A trustworthy, explainable handover: what changed, from what baseline, with what evidence, and what the crew already did.
- **Frustrations:** Black-box "risk 78%" with no evidence; raw data dumps; claims that sound like a diagnosis.
- **Success:** Reads the PDF report and can see, for each flag: the indicator, the baseline, the direction and size of change, and the action taken — without OrbitCare ever claiming to diagnose.

**Non-users (explicitly out of scope):** the general public, patients on Earth, hospitals, insurers. OrbitCare is not a consumer wellness app and not a clinical system.

---

## 3. Goals and non-goals

### Goals (what the MVP must prove)
1. An astronaut can understand their health status in under 2 minutes a day.
2. A decline is caught *early* — by comparing each person to their own 21-day personal baseline, not to a population average.
3. Every alert is explainable and actionable — evidence + plain-language action, including when to contact the flight surgeon.
4. The crew view is worst-first, so the person who needs help is never buried.
5. It works offline. No Earth link, no problem: data is stored on board, and it syncs only when a link returns.
6. A shareable PDF report can be produced for any mission day, so Earth gets a clean handover.

### Non-goals (what we are deliberately NOT doing)
- **No diagnosis, no treatment prescription.** Decision support only. Every screen and the PDF say: "Not a medical device. Synthetic data only."
- **No real wearables / real astronaut telemetry.** All MVP data is simulated and clearly labelled.
- **No real-time Earth chat, no doctor chat, no video consult.**
- **No mobile app** — web dashboard only for the MVP.
- **No multi-mission / multi-crew management, no admin panel, no accounts beyond the demo crew.**
- **No clinical validation.** Thresholds are illustrative, not clinically validated, and must never be presented as such.

---

## 4. Core features

### MVP — must-have (ship this, or there is no product)

| # | Feature | Detail |
|---|---------|--------|
| M1 | Crew View (worst-first) | All 3 crew on one screen, sorted by worst status. Status chips: Nominal / Watch / Alert. One tap opens that astronaut. |
| M2 | Astronaut Dashboard | Current vitals, 4 domain scores, active flags. Vitals shown vs that person's own baseline. |
| M3 | Personal-baseline anomaly detection | First 21 days = personal normal (mean + SD). Direction-aware z-scores (lower sleep = worse, higher BP = worse). 3-day smoothed domain scores. Watch ≥ 1, Alert ≥ 2. Isolation Forest across indicators for unusual combined patterns. |
| M4 | 4 domain scores | Heart (cardiovascular), Bone & Muscle, Sleep & Mind, Immune / Radiation. Each Nominal / Watch / Alert with a plain-language reason. |
| M5 | Plain-language flags + action plans | Every flag says: what we see, why it matters, what to do now, and when to contact the flight surgeon. Rule-based, no black box. |
| M6 | Trends | 7-day and 30-day charts with the person's normal band shown, so a drift is visible at a glance. Mission-day slider + Play to replay the mission. |
| M7 | Daily self-check | Astronaut logs sleep, mood, stress, symptoms in under a minute. Feeds the Behavioural / Sleep & Mind score. Saves, not lost on refresh. |
| M8 | PDF health report | Download a real report for any mission day: crew at a glance, per-astronaut scores, vitals vs baseline, every flag with its full explanation, complete action plan. Generated on-device, works offline. |
| M9 | Offline-first | Dashboard, trends, action plans and report work with no connection. Data stored locally/on board; sync to Earth only when a link is available. Show LIVE / STALE / OFFLINE state clearly. |
| M10 | Simulated data, clearly labelled | 180 days, 3 astronauts, each with their own baseline. One injected decline event (Day 63) so the demo can prove detection. Every screen labels data "Simulated". |

### V2 — should-have (build after the MVP works end-to-end)

- **One-tap Emergency Guide:** big red button on every page. Pick a situation (collapsed / not breathing, choking, chest pain, severe bleeding, burn / electric shock, radiation shelter) → one step at a time, with a progress bar, CPR metronome (110 bpm), and a handover note. Offline, no doctor needed.
- **Radiation shelter alert:** solar-particle-event warning with a countdown to shelter, from cumulative dose + spike detection.
- **Health forecast:** predict who is likely to decline in the next 14 days, with the evidence for the forecast — like a weather forecast for the body.
- **Medicine stock countdown:** which medicine runs out on which day, before it happens.
- **Daily exercise prescription:** today's workout auto-made from bone + muscle scores.
- **Crew handover / sync log:** what was synced to Earth, when, and what is still queued.

### Later — nice-to-have (do not start in the hackathon)

- Real wearable / on-board sensor integration (device adapters, Bluetooth HR, HealthKit / Health Connect).
- Lab markers (immune cells, bone biomarkers), FHIR lab import.
- Digital twin of each astronaut that ages/declines in parallel to predict problems.
- Voice check: 10-second voice test for fatigue / stress, no wearables needed.
- Multi-crew / multi-mission management, Earth mission-control dashboard, role-based access.
- Clinical validation with domain experts, and any regulatory work — only after V2, never in the hackathon.

---

## 5. User stories

**Astronaut (Kenji)**
- As an astronaut, I want to see my health status in green / amber / red in under 2 minutes, so that I know whether I need to act today.
- As an astronaut, I want each alert to explain what changed and what to do, so that I don't need a doctor to interpret it.
- As an astronaut, I want to log a daily self-check in under a minute, so that my mood, sleep and symptoms are part of my health picture.
- As an astronaut, I want to see my trends against my own normal band, so that I can see a slow drift before it becomes a problem.
- As an astronaut, I want the app to work with no Earth signal, so that I am not helpless when the link is down.

**Crew Medical Officer / Commander (Amara)**
- As the crew medical officer, I want the crew listed worst-first, so that I help the person who needs it most first.
- As the crew medical officer, I want to download a PDF report for any mission day, so that I can hand a clear summary to Earth when a link returns.
- As the crew medical officer, I want to see what action was already taken for a flag, so that I don't repeat or miss a step.

**Flight Surgeon on Earth (Dr. Rao)**
- As a flight surgeon, I want every flag to show its evidence (indicator, baseline, direction and size of change), so that I can trust it without OrbitCare claiming a diagnosis.
- As a flight surgeon, I want a report that says "synthetic data only / decision support only", so that I never mistake a prototype for a clinical record.

**Team / judges (hackathon)**
- As a judge, I want to replay Day 63 in one tap, so that I can see OrbitCare catch a decline live.
- As a judge, I want to see the AI disclosure and data sources, so that I know what was built, what was simulated, and what was AI-assisted.

---

## 6. Key user flows (step by step)

### Flow 1 — Daily check-in (astronaut, ~2 min)
1. Open OrbitCare → Crew View loads (works offline).
2. Tap your own card.
3. See today's status: 4 domain scores + any active flags.
4. Tap a flag → read "what we see / why it matters / what to do now".
5. Tap "Daily self-check" → log sleep, mood, stress, symptoms → Save.
6. Scores update. Close. Done.

### Flow 2 — Catching a decline (Day-63 demo story)
1. Open Crew View → Kenji is listed first, status Watch, score 78.
2. Tap Kenji → Dashboard shows Sleep & Mind and Immune drifting.
3. Tap Trends → 30-day chart, his sleep/HRV line leaves his normal band around Day 60–63.
4. Tap the Day-63 flag → evidence: "Sleep 5.2h vs your 7.4h baseline (−1.8 SD), HRV down, mood down for 3 days."
5. Tap Action Plan → rest, hydrate, light exercise, re-check tomorrow, contact flight surgeon if fever / chest pain.
6. Tap "Download PDF report" → 4-page report for Day 63, with the same evidence and plan.
7. By Day 90, replay the slider → Kenji recovers to Nominal. The story closes.

### Flow 3 — Emergency (V2, one-tap guide)
1. Tap the red EMERGENCY GUIDE button on any page.
2. Pick what happened (e.g. collapsed / not breathing).
3. Follow one big step at a time, with a progress bar.
4. CPR step shows the 110 bpm metronome.
5. Final screen: handover note for the next crew member / Earth.

### Flow 4 — Handover to Earth
1. Commander opens any astronaut → "Download PDF report".
2. Pick the mission day.
3. PDF is generated on-device (works offline).
4. When an Earth link returns, the PDF is the handover — no live connection needed to create it.

### Flow 5 — First run / setup (team, hackathon morning)
1. Create repo → seed simulated data (180 days, 3 crew, 3 baselines, 540 daily readings).
2. Open dashboard → verify Day 63 shows Kenji worst-first.
3. Verify PDF downloads, verify the app still works with wifi off.
4. Deploy live link, write README with AI disclosure, record the demo.

---

## 7. Data model (MVP, simulated only)

- **Crew (3):** id, name, role, baseline period (Days 1–21).
- **Baselines (3):** per astronaut, per indicator: mean + SD over Days 1–21.
- **Daily readings (540 = 3 crew × 180 days):** resting HR, HRV, systolic/diastolic BP, sleep hours, exercise minutes, body weight, grip strength, temperature, illness symptoms, mood, stress, reaction time, radiation dose.
- **Domain scores (4 per astronaut per day):** Heart, Bone & Muscle, Sleep & Mind, Immune/Radiation. Smoothed over 3 days.
- **Flags:** indicator, baseline, current value, direction-aware z-score, domain, status (Nominal / Watch / Alert), plain-language explanation, action plan, timestamp.
- **Self-checks:** date, astronaut, sleep, mood, stress, symptoms, notes.
- **Injected events (for testing the detector):** infection (Day 63, Kenji), solar-particle event (radiation spike), exercise slump, stress period, BP drift.

**Rules:** all data simulated, labelled on every screen. No real astronaut or patient data. No diagnosis: scores are risk signals, not clinical findings.

---

## 8. Success metrics

### Hackathon demo (14–15 Nov 2026)
- [ ] Day-63 replay: Kenji flagged worst-first, Watch, in one tap from Crew View.
- [ ] Every flag shown has evidence + an action plan (0 unexplained alerts).
- [ ] PDF report downloads and is a real report (crew + scores + flags + actions), not a demo file.
- [ ] App works with wifi off (offline check passes).
- [ ] Live link + demo (7 slides OR 30-sec video, public, no password) submitted by ~15:00 Sun 15 Nov, before 16:00 gates close.
- [ ] README includes AI disclosure, data sources, and "not a medical device / synthetic data only".

### Product (if taken beyond the hackathon)
- Daily check-in completed in < 2 minutes (target: 90% of check-ins).
- Time from a real drift starting to first Watch flag: < 3 days (on simulated data).
- % of flags with an action followed / acknowledged: track, don't guess.
- PDF report generated in < 10 seconds, on-device.
- 0 screens that present a score as a diagnosis.

---

## 9. Risks, assumptions and open questions

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Treated as a medical device / diagnosis by users or judges | High — safety + credibility | "Not a medical device / synthetic data only / decision support only" on every screen + PDF + README. No diagnosis language anywhere. |
| Black-box score nobody trusts | High | Every alert shows evidence (baseline, value, z-score, direction). No unexplained numbers. |
| Demo fails without internet | High | Offline-first by design; rehearse the wifi-off demo. Supabase version needs a connection — make the offline path the demo path. |
| Copying another team's repo / pre-built work | Disqualification | Build our own code during the hackathon. Reference repos for patterns only. Disclose AI use. |
| Demo format wrong (7 slides vs 30-sec video vs 2-min) | Submission rejected / down-scored | Submit the 7-slide deck as the demo; film 30-sec only if video is preferred. Confirm format in the Project Tab guide before filming. Don't do both at the last minute. |
| Supabase / deploy breaks on the day | Demo has no live link | Don't wait on Supabase to submit — submit the demo link already shared; keep the code zip as the repo backup. Test the live link in incognito. |
| Scope creep in 48 hours | Nothing shippable | Feature freeze Sat 8:00 PM. If behind, cut to Crew View + one dashboard + Day 63. |

### Assumptions
- All health data in the MVP is simulated; no real astronaut data is available or needed for the demo.
- The crew is 3 people, the mission is 180 days, the personal baseline is Days 1–21.
- The team is 4 people; roles are proposed (Frontend / Backend-Data / AI-ML / Design-Pitch), not yet team-confirmed.
- Judges value an explainable, working demo over a large feature list.
- A 20-minute Earth delay makes offline-first a core requirement, not a nice-to-have.

### Open questions
1. **Demo format (confirm before filming):** 7-slide deck OR 30-second video — which one does the Harohalli / Project Tab guide require for 2026? Official guide page was 404 on 14 Nov; confirm in the Project Tab.
2. **Harohalli Sunday cutoff:** the local page says submissions "by the end of day" with no clock time; gates close 16:00 Sun. Is the real cutoff 15:00 on-site, or later remotely? Confirm with Local Lead R D Lohith (rdlohith@gmail.com).
3. **Saturday evening work:** gates close 19:00 Sat — does work continue virtually after that, or stop?
4. **Supabase for the code version:** who creates the project and adds the keys? (User said they will do it themselves via API keys; no real keys in code, placeholders only.)
5. **After the hackathon:** is OrbitCare a portfolio project only, or will the team keep building V2 (Emergency Guide is already in; forecast / radiation alert are next)?

---

## 10. Out of scope — do not build in MVP

Real wearables, real telemetry, diagnosis, doctor chat, mobile app, multi-mission admin, clinical validation, payments, accounts beyond the demo crew.

---

*End of PRD v1.0. If a feature is not in Section 4 (MVP), it is not in the hackathon build. Cut it, don't debate it on Saturday.*
