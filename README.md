# 🚀 OrbitCare — Orbitspace

### 🧑‍🚀 Astronaut health monitoring, built for deep space.

**Orbitspace** is our entry for the **NASA Space Apps Challenge 2026 — Harohalli Local Event**, built by **Team Alpha** ✨

On a long mission, Earth is minutes away — there is no hospital. Orbitspace watches over the crew, spots health changes early, and turns them into plain-language action plans. 🛰️

---

## 🌍 The Problem

Long-duration space missions bring radiation ☢️, isolation 🤫, altered gravity 🌑 and a closed, hostile environment. Astronauts face immune changes, bone loss, heart strain and mental-health pressure — and they must be able to spot changes in themselves before they become emergencies.

## ✨ What Orbitspace Does

- 👀 **Crew View, worst-first** — the astronaut who needs attention most is always on top
- 📈 **Vitals vs your own baseline** — every astronaut is compared to their own first 21 days, not to an average person
- 🚨 **Smart flags with evidence** — every alert shows exactly which vital drifted and by how much
- 🧠 **4 domain scores** — ❤️ Heart · 🦴 Bone & Muscle · 😴 Sleep & Mind · 🛡️ Immune / Radiation
- 📝 **Plain-language action plans** — rest, hydrate, protect sleep, re-check tomorrow
- 📉 **Trends with normal bands** — see a vital leave its normal range, day by day
- ✅ **Daily self-check** — sleep, mood, stress and symptoms, recorded by the astronaut
- 📄 **Downloadable crew health report** — the full picture, on one page
- 🔌 **Offline-first** — the dashboard works with no connection to Earth

## 🧑‍🚀 Meet the Crew

| Astronaut | Role |
|---|---|
| **Kenji** | Mission Specialist |
| **Amara** | Commander |
| **Elena** | Flight Engineer |

## 🎬 The Demo Story

> **Day 63** — Kenji's resting heart rate climbs, his HRV drops and his sleep falls below baseline. He jumps to **#1 in the crew view — Watch, 79/100** 🚨

> **Day 90** — Kenji follows the action plan and **recovers to Nominal, 95/100** 💚

> **Day 118–131** — Amara dips during a schedule shift. **Day 180** — Elena's slow bone decline shows up. The system catches all of it, early.

## 🛠️ How It Works

```
Simulate 180 days → Personal 21-day baseline → Direction-aware z-scores
→ 4 domain scores → Flags with evidence → Action plan → Crew report
```

- 🧪 **540 daily readings** across 3 astronauts, generated and seeded into Supabase
- 🎯 **Direction-aware scoring** — a low HRV is bad, a low heart rate is good; the maths knows the difference
- 🧘 **3-day smoothing** — one bad night doesn't cause a panic, a real trend does
- 🗄️ **Backend:** Node.js + Supabase (Postgres) · **Frontend:** plain HTML, CSS & JavaScript

## 💻 Run It Locally

```bash
cd orbitspace-code/backend
npm install
npm run seed      # Seeds Supabase: 3 crew, 3 baselines, 540 daily readings
npm start         # Backend on http://localhost:3000

# In a second terminal, from the orbitspace-code folder:
python -m http.server 8000
```

Then open **http://localhost:8000** and jump to **Day 63** 🎯

## 🧪 Tested, Not Just Built

✅ **64 automated tests, all passing** — run them with `cd backend && npm test`

- Scoring, domain scores and the worst-first crew sort are all verified against the real data
- Day 63: Kenji first, 79 Watch · Day 90: Kenji 95 Nominal · every score stays in range across all 180 days

## ⚠️ Important

- All health data in this project is **simulated** and clearly labelled — no real health data anywhere
- Orbitspace is **decision support only, not a medical device** — it never diagnoses or treats

## 🤖 AI Disclosure

AI tools assisted with code, tests and documentation for this project, as permitted by the challenge rules. All AI-assisted work was reviewed and tested by the team.

## 👥 Team Alpha

Built with 💙 for the NASA Space Apps Challenge 2026 — Harohalli.

**🔗 Live Demo:** _( https://orbitcare-xi.vercel.app/ )_
