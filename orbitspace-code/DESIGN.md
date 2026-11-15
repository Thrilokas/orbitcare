# OrbitCare — UI Design System (DESIGN.md)

**Version:** 1.0 — 15 Nov 2026
**Source of truth:** `PRD.md` v1.0 (15 Nov 2026). This file is the only design authority for OrbitCare / Orbitspace.
**Rule — read this first:** Every UI built later must follow this file strictly. Do not invent new colors or fonts outside it. If a color, font, size, radius or shadow is not in this file, do not use it. Ask / update DESIGN.md first, then build.
**Product:** OrbitCare — offline-first astronaut health dashboard, 180-day simulated mission, 3 crew, personal-baseline anomaly detection, decision support only. Simulated data only. Not a medical device.

---

## 1. Brand feel

**Feel in one line:** A calm mission-control console for a spacecraft — deep space, quiet confidence, nothing shouting except the one thing that needs attention right now.

- **Deep space, not hospital white.** Dark first. The interface should feel like it belongs on a spacecraft at night: near-black blue, deep-blue panels, one vivid blue for action.
- **Calm until it matters.** Most of the screen is quiet and low-contrast. Only status, a declining trend, and the Emergency button are allowed to be loud.
- **Plain language, big numbers.** A tired astronaut at 02:00 must read their status in 2 seconds. No medical jargon, no dense tables as the first thing, no unexplained score.
- **Trust through evidence.** Every number shows its baseline next to it. Nothing is a black box. The design makes the evidence visible, not hidden behind a tooltip.

### 3 design principles

1. **Worst-first, always.** The most important person / flag is first, biggest, and highest-contrast. Crew View is sorted worst-first. A dashboard never buries an Alert below Nominal cards. If two things compete for attention, the worse one wins.
2. **Baseline beats average.** A vital is never shown alone. Every vital, chart and score shows "you vs your own Days 1–21 baseline" — value, baseline, and direction of change, in the same row. A number without its baseline is a design bug.
3. **Offline is normal, not an error.** The app must look complete with no connection. LIVE / STALE / OFFLINE is a quiet status label in the header, never a red error banner, never a blocking modal. Sync is background work; the crew's work is not.

---

## 2. Color palette

All HEX codes are fixed. Use the token names in code (`--color-*`), never hard-code a new HEX.

### Dark mode — DEFAULT (primary theme, chosen 14 Nov 2026: deep blue + black)

| Token | HEX | Use |
|---|---|---|
| `--color-bg` | `#020612` | Page background, near-black blue |
| `--color-bg-elevated` | `#050B1A` | App shell / raised page background |
| `--color-surface` | `#081630` | Cards, panels |
| `--color-surface-2` | `#0B1E42` | Raised cards, table header, modal surface |
| `--color-surface-3` | `#10264F` | Hover surface, selected row, chart grid area |
| `--color-border` | `#1E3A66` | Card borders, dividers, input borders |
| `--color-border-strong` | `#2E4A7A` | Focus-adjacent borders, active tab underline |
| `--color-primary` | `#2E7FFF` | Primary actions, links, Play, Download, selected state, chart main line |
| `--color-primary-hover` | `#5C9DFF` | Primary hover |
| `--color-primary-pressed` | `#1F68E0` | Primary pressed / active |
| `--color-primary-soft` | `#12294F` | Primary soft background (chips, info banners) |
| `--color-secondary` | `#7FB3FF` | Secondary text links, secondary chart line, info accents |
| `--color-text` | `#EAF1FF` | Primary text |
| `--color-text-secondary` | `#A9BCE0` | Secondary text, labels, metadata |
| `--color-text-muted` | `#6E84B3` | Muted text, captions, placeholders |
| `--color-success` | `#2FD6A3` | Nominal status — do NOT use plain green; this teal-green is the Nominal colour |
| `--color-success-soft` | `#0A2E25` | Nominal chip / banner background |
| `--color-warning` | `#FFB020` | Watch status |
| `--color-warning-soft` | `#33260A` | Watch chip / banner background |
| `--color-error` | `#FF4D5E` | Alert / Attention status, Emergency, destructive actions |
| `--color-error-soft` | `#3A0F16` | Alert chip / banner background |
| `--color-emergency` | `#E11D2E` | Emergency Guide button only (see §7) |
| `--color-focus` | `#7FB3FF` | Focus ring (see §9) |

**Status mapping — fixed, never change per screen:**
- Nominal = `--color-success` `#2FD6A3` (bright, but in the Orbitspace build retuned as bright blue for Nominal — use `#2FD6A3` here for status text/chips, and `#2E7FFF` for the Nominal chart line; do not swap them)
- Watch = `--color-warning` `#FFB020`
- Alert / Attention = `--color-error` `#FF4D5E`
- In the built Orbitspace theme, Nominal was shown in bright blue; that is an alias, not a new colour: use `--color-primary` for Nominal *chart lines only*, `--color-success` for Nominal *chips/text*.

**Chart palette (only these 5):** main line `#2E7FFF`, baseline band `#2E7FFF` at 12% opacity, secondary line `#7FB3FF`, Watch marker `#FFB020`, Alert marker `#FF4D5E`. No other chart colours.

### Light mode — secondary (print / PDF / daylight review only)

Light mode is for the PDF report and for printing. It is NOT the app theme. Do not ship the app in light mode unless DESIGN.md is updated first.

| Token | HEX | Use |
|---|---|---|
| `--color-bg-light` | `#F4F7FE` | Page background |
| `--color-surface-light` | `#FFFFFF` | Cards, panels |
| `--color-surface-2-light` | `#EAF0FB` | Raised cards, table header |
| `--color-border-light` | `#CBD8EE` | Borders, dividers |
| `--color-primary-light` | `#1F68E0` | Primary actions, links |
| `--color-secondary-light` | `#2E7FFF` | Secondary accents |
| `--color-text-light` | `#0B1E42` | Primary text |
| `--color-text-secondary-light` | `#44587E` | Secondary text |
| `--color-text-muted-light` | `#6E84B3` | Muted text |
| `--color-success-light` | `#0E7A5C` | Nominal |
| `--color-warning-light` | `#8A5A00` | Watch |
| `--color-error-light` | `#C8102E` | Alert / Attention |

**Forbidden colours:** no purple, no pink, no orange (except `#FFB020` Watch), no teal backgrounds, no gradients except the single hero gradient in §8.1 (deep blue → black only). No new status colours.

---

## 3. Typography

**Font families — only these two. No other fonts.**
- **Display / headings:** `Inter`, system fallback: `-apple-system, "Segoe UI", Roboto, sans-serif`
- **Body / UI:** `Inter`, same fallback
- **Numbers / data / code:** `"IBM Plex Mono", "SFMono-Regular", Consolas, monospace` — use for scores, vitals, z-scores, mission day, and code only. Never for body copy.

**Why Inter:** legible at small sizes, clear numerals, works offline when bundled. Do not use a display / serif / rounded font.

### Size scale (px / rem, line-height, weight, use)

| Token | Size | Line-height | Weight | Use |
|---|---|---|---|---|
| `--text-display` | 32px / 2rem | 40px / 1.25 | 700 | Page hero title only (Overview / cover) |
| `--text-h1` | 24px / 1.5rem | 32px / 1.33 | 700 | Page title |
| `--text-h2` | 20px / 1.25rem | 28px / 1.4 | 700 | Section title, card title |
| `--text-h3` | 16px / 1rem | 24px / 1.5 | 600 | Sub-section, table title |
| `--text-body` | 16px / 1rem | 24px / 1.5 | 400 | Body copy, flag explanations |
| `--text-body-sm` | 14px / 0.875rem | 20px / 1.43 | 400 | Secondary copy, table cells, card body |
| `--text-caption` | 12px / 0.75rem | 16px / 1.33 | 500 | Labels, captions, metadata, "Simulated" tag |
| `--text-score` | 36px / 2.25rem | 40px / 1.11 | 700, mono | Domain score number only |
| `--text-vital` | 24px / 1.5rem | 28px / 1.17 | 700, mono | Vital value only |
| `--text-button` | 14px / 0.875rem | 20px / 1.43 | 600 | Buttons, nav |

**Rules:**
- Body copy is never below 14px. Captions are never below 12px.
- Score / vital numbers are always mono. Body copy is never mono.
- Headings: sentence case, never ALL CAPS except the `SIMULATED` / `OFFLINE` / `LIVE` status tags (12px, 600, letter-spacing 0.08em).
- Line length for explanations: max 68 characters. Flag explanations are 2–3 short sentences maximum.

---

## 4. Spacing, radius, shadows, breakpoints

### Spacing scale (px)
`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`
- Use only these values. Card padding: 16px (mobile) / 24px (desktop). Section gap: 24px. Page padding: 16px (mobile) / 32px (desktop). Gap between cards in a grid: 16px.

### Border radius
- `--radius-sm: 6px` — chips, inputs, small badges
- `--radius-md: 10px` — buttons, cards (small)
- `--radius-lg: 14px` — cards, modals, panels
- `--radius-full: 999px` — status chips, avatars, toggle pills
- No other radii. No sharp 0px corners on cards, no fully-rounded cards.

### Shadows (dark mode only — subtle, blue-tinted, never black-only)
- `--shadow-sm: 0 1px 2px rgba(2, 6, 18, 0.6)`
- `--shadow-md: 0 4px 12px rgba(2, 6, 18, 0.6)`
- `--shadow-lg: 0 12px 32px rgba(2, 6, 18, 0.7)`
- Light mode: `--shadow-md-light: 0 4px 12px rgba(11, 30, 66, 0.08)`
- Do not use coloured glows except: primary button hover `0 0 0 1px #2E7FFF` (see §7.1), Emergency button `0 0 0 1px #E11D2E`.

### Breakpoints
- **Mobile:** < 640px — single column, nav collapses to bottom / hamburger, mission-day slider full width
- **Tablet:** 640–1023px — 2-column grids
- **Desktop:** 1024–1439px — 3-column grids, max content width 1200px, centred
- **Wide:** ≥ 1440px — max content width 1200px, centred (do not stretch)
- Layouts must not break at 360px wide. Tables scroll horizontally on mobile, never shrink text below 12px.

### Grid
- 12-column grid on desktop, 4px baseline. Cards: 1fr / 1fr / 1fr on desktop for Crew View; 2fr / 1fr for Dashboard (main + side).

---

## 5. Iconography, imagery and data visualisation

- **Icons:** line icons only, 1.5px stroke, 20px (16px in chips). One icon set only. No emoji in the UI (except in copy-paste sample data, never in the product).
- **Avatars:** initials in a circle, deep-blue shades only: Kenji `#2E7FFF`, Amara `#7FB3FF`, third crew `#5C9DFF` — on `#081630`. No photos.
- **Charts:** Recharts only. Line charts with the normal band as a shaded area (primary at 12% opacity). Always show: current line, baseline band, Watch/Alert markers. Axis labels 12px muted. No 3D, no pie charts for health scores.
- **No stock photos, no astronaut illustrations in the app UI.** The PPT may use one cover image; the app may not.

---

## 6. States — global rules (apply to every component)

| State | Rule |
|---|---|
| Default | As specified in §7 |
| Hover | Background lightens one surface step (`#081630` → `#0B1E42`), or primary lightens to `#5C9DFF`. Cursor: pointer on clickable, default otherwise. No hover-only information — everything hover reveals must also be visible on focus / tap. |
| Focus | **Visible always.** 2px solid `--color-focus` `#7FB3FF` outline, offset 2px, radius matches the component. Never `outline: none` without a replacement. Focus order follows visual order, top → bottom, left → right. |
| Disabled | Opacity 0.5, cursor `not-allowed`, no hover, no focus ring. Text remains readable (contrast ≥ 4.5:1 on the disabled background — do not grey text to invisibility). |
| Loading | Button shows spinner (16px, white / primary) + label "Loading…" and is disabled. Cards show skeleton bars in `--color-surface-2`, never blank white. Page loading: skeleton, never a spinner alone for > 1s. |
| Error | Field border `#FF4D5E`, error text 12px `#FF4D5E` below the field, icon in the field. Error messages are plain language: what went wrong + what to do. Never a raw error code as the only message. |
| Empty | Empty state: 1 icon, 1 line ("No flags today — all Nominal."), 1 action if useful. Never a blank card. |
| Offline | Header shows OFFLINE in a muted chip. Data shown is the last synced data, with "Last sync: Day X, HH:MM" in caption text. Actions that need a connection are disabled with "Needs connection — will sync later" text. |

---

## 7. Component specs

### 7.1 Buttons

| Variant | Default | Hover | Focus | Disabled | Loading |
|---|---|---|---|---|---|
| **Primary** | bg `#2E7FFF`, text `#FFFFFF`, 600, 14px, padding 10px 16px, radius 10px | bg `#5C9DFF` | 2px `#7FB3FF` outline, offset 2px | bg `#1E3A66`, text `#A9BCE0`, opacity 0.5 | Spinner + "Loading…", disabled |
| **Secondary** | bg transparent, border 1px `#1E3A66`, text `#EAF1FF` | bg `#0B1E42`, border `#2E4A7A` | Same focus ring | Opacity 0.5 | Same as Primary |
| **Ghost / text** | bg transparent, text `#7FB3FF`, no border | bg `#12294F` | Same focus ring | Opacity 0.5 | — |
| **Destructive** | bg `#FF4D5E`, text `#FFFFFF` | bg `#FF6B78` | 2px `#FF4D5E` outline | Opacity 0.5 | Same as Primary |
| **Emergency** | bg `#E11D2E`, text `#FFFFFF`, 700, padding 12px 20px, radius 999px, uppercase, letter-spacing 0.04em | bg `#FF2E42`, shadow `0 0 0 1px #E11D2E` | 2px `#FFFFFF` outline, offset 2px | Never disabled in the app (Emergency must always work offline) | Never loading |

- Button height: 40px (default), 32px (small), 48px (Emergency / primary on mobile).
- Only one primary button per screen section. Secondary for everything else.
- Icon + label: icon 16px, gap 8px. Icon-only buttons: 40×40px, aria-label required, focus ring required.

### 7.2 Inputs, selects, sliders, toggles

- **Text input / select / textarea:** bg `#050B1A`, border 1px `#1E3A66`, radius 10px, padding 10px 12px, text 14px `#EAF1FF`, placeholder `#6E84B3`. Height 40px.
  - Hover: border `#2E4A7A`.
  - Focus: border `#2E7FFF` + 2px `#7FB3FF` outline offset 2px.
  - Error: border `#FF4D5E`, error text below (see §6).
  - Disabled: bg `#081630`, text `#6E84B3`, opacity 0.5.
- **Labels:** 12px, 600, `#A9BCE0`, above the field, gap 4px. Required fields: `*` in `#FF4D5E`, with "(required)" in the label for screen readers.
- **Mission-day slider (core control):** full-width track 4px `#1E3A66`, thumb 20px circle `#2E7FFF` with 2px `#FFFFFF` border, fill to thumb `#2E7FFF`. Labels: "Day 1" left, "Day 180" right, current day in mono 16px 700 above the thumb. Play button: primary, 40px, icon only.
- **Segmented control (7-day / 30-day):** container bg `#081630`, radius 999px, padding 4px. Selected segment: bg `#2E7FFF`, text `#FFFFFF`. Unselected: text `#A9BCE0`.
- **Toggle:** track 40×24px, off bg `#1E3A66`, on bg `#2E7FFF`, thumb 20px `#FFFFFF`.

### 7.3 Cards

- **Base card:** bg `#081630`, border 1px `#1E3A66`, radius 14px, padding 16px (mobile) / 24px (desktop), shadow `--shadow-sm`.
- **Raised card:** bg `#0B1E42`.
- **Crew card (Crew View):** avatar 48px, name 16px 700, role 12px muted, score mono 36px, status chip top-right, 4 domain dots below. Sorted worst-first — the DOM order is the visual order. Tap / Enter opens the Astronaut page. Hover: bg `#0B1E42`, border `#2E4A7A`. Focus: focus ring.
- **Flag card:** left border 4px in status colour (`#FFB020` Watch / `#FF4D5E` Alert / `#2FD6A3` Nominal), title 16px 600, evidence 14px body, action 14px with a "What to do" label in 12px 600 muted. Never show a flag without its action.
- **Domain score card:** domain name 14px 600, score mono 36px, status chip, 1-line reason 14px secondary, mini trend sparkline (primary line only).

### 7.4 Status chips

- Height 24px, padding 4px 10px, radius 999px, 12px 600, letter-spacing 0.04em.
- Nominal: bg `#0A2E25`, text `#2FD6A3`, border 1px `#2FD6A3` at 40% opacity.
- Watch: bg `#33260A`, text `#FFB020`, border 1px `#FFB020` at 40%.
- Alert: bg `#3A0F16`, text `#FF4D5E`, border 1px `#FF4D5E` at 40%.
- Simulated / Offline / Live tags: bg `#081630`, text `#A9BCE0`, border 1px `#1E3A66`, uppercase.
- Chips are never the only way status is shown — the score + text also state it (see §9).

### 7.5 Modals

- Overlay: `rgba(2, 6, 18, 0.8)`, click-outside closes (except Emergency — see §8.6), Esc closes, focus is trapped inside, focus returns to the trigger on close.
- Modal: bg `#0B1E42`, border 1px `#1E3A66`, radius 14px, padding 24px, max-width 560px, centred, shadow `--shadow-lg`.
- Title 20px 700, body 14px, actions right-aligned: Secondary "Cancel" + Primary confirm. Destructive confirm uses Destructive button.
- States: default / loading (confirm shows spinner, disabled) / error (inline error text, modal stays open).

### 7.6 Navbar / header

- Height 64px, bg `#020612`, border-bottom 1px `#1E3A66`, sticky top.
- Left: wordmark "OrbitCare" 16px 700, primary colour for "Orbit" + white for "Care" (no logo image in the app). Next to it, 12px muted tag: "SIMULATED DATA".
- Centre / right (desktop): nav links Overview, Astronaut, Trends, Action Plan, How It Works — 14px 600, default `#A9BCE0`, hover `#EAF1FF`, active `#FFFFFF` + 2px `#2E7FFF` underline, padding 8px 12px, radius 10px.
- Right: sync status chip (LIVE / STALE / OFFLINE) + red EMERGENCY GUIDE button (see §7.1).
- Mobile (< 640px): nav collapses to a bottom bar with 5 icons + labels, or a hamburger → full-screen menu in `#020612`. Emergency button stays visible in the header.
- Back button: ghost button, "< Back", 14px 600, on every sub-page.

### 7.7 Tables

- Header: 12px 600 uppercase, `#A9BCE0`, bg `#0B1E42`, padding 12px 16px, border-bottom 1px `#1E3A66`.
- Rows: 14px, padding 12px 16px, border-bottom 1px `#1E3A66`. Alternate rows: no zebra — keep `#081630` throughout.
- Hover row: bg `#0B1E42`. Selected row: bg `#10264F` + left border 2px `#2E7FFF`.
- Numbers: mono, right-aligned. Status in a chip, not colour alone.
- Mobile: horizontal scroll, sticky first column, min column width 120px. Never shrink below 12px.

### 7.8 Toasts

- Position: bottom-right (desktop), bottom-centre full-width (mobile). Max-width 360px.
- bg `#0B1E42`, border 1px `#1E3A66`, radius 10px, padding 12px 16px, shadow `--shadow-md`, icon 20px left, text 14px, close button right.
- Success: left border 4px `#2FD6A3`. Warning: `#FFB020`. Error: `#FF4D5E`. Info: `#2E7FFF`.
- Auto-dismiss 5s (success/info), 8s (warning/error), pause on hover/focus. Never auto-dismiss an error that blocks a submit — those stay as inline errors (§6).

### 7.9 Charts, sliders, progress

- See §5 for chart colours. Progress bar: track 8px `#1E3A66`, fill `#2E7FFF`, radius 999px. Emergency progress: fill `#E11D2E`.
- Skeleton: bg `#0B1E42`, radius 10px, pulse opacity 0.6 → 1.0, 1.2s. Never use a spinner as the only loading state for a card.

---

## 8. Page layouts (every screen in PRD.md)

All pages share: header (§7.6), mission-day slider + Play at the top (except How It Works), footer disclaimer on every page: "Simulated data only · Decision support only · Not a medical device" in 12px muted, centred. Max width 1200px, padding 16px / 32px.

### 8.1 Overview / Crew View (PRD M1)
- **Hero (top):** 1 line — "Crew health at a glance" (24px 700) + date / mission day in mono + sync chip. Background: deep blue → black gradient only here (`#0B1E42` → `#020612`), no other gradients.
- **Grid:** 3 crew cards, worst-first, 1 column mobile / 3 columns desktop. Worst card first in DOM.
- **Below:** "Today's flags" list (flag cards, §7.3) + "Download PDF report" primary button, right-aligned.
- **Empty state:** if all Nominal: "All crew Nominal today." + 1-line summary.

### 8.2 Astronaut Dashboard (PRD M2, M3, M4)
- **Header row:** avatar 64px, name 24px 700, role 14px secondary, status chip, mission day in mono.
- **Layout:** 2fr main / 1fr side (desktop), stacked on mobile.
- **Main:** 4 domain-score cards in a 2×2 grid (Heart, Bone & Muscle, Sleep & Mind, Immune/Radiation), then vitals table (vital | today | your baseline | change, with z-score in mono).
- **Side:** active flags (flag cards), then Daily self-check card, then "Download PDF report".
- **Rule:** every vital row shows baseline + change. A vital without a baseline is not shipped.

### 8.3 Trends (PRD M6)
- **Controls top:** astronaut selector (segmented), 7-day / 30-day segmented control, mission-day slider + Play.
- **Charts:** one chart per domain (4 charts, stacked, full width). Each: title 16px 600, normal band shaded, current line primary, Watch/Alert markers, axis 12px muted.
- **Below:** "What changed" — 3 bullet lines in plain language, generated from the flags.
- **Day-63 story:** a "Jump to Day 63" chip button that sets the slider to 63.

### 8.4 Action Plan (PRD M5)
- **Top:** astronaut selector + mission day.
- **List:** one action-plan card per active flag, in priority order. Each card: flag title, evidence, "What to do now" checklist (checkboxes, 14px, unchecked by default), "Contact flight surgeon if…" line in warning colour.
- **Bottom:** "Mark all done" secondary button + "Download PDF report" primary button.
- **Empty state:** "No actions needed today."

### 8.5 Daily self-check (PRD M7)
- **Form card (max-width 560px, centred):** sleep (slider, hours), mood (5-option segmented: 1–5), stress (5-option segmented), symptoms (checkbox list), notes (textarea, optional).
- **Submit:** primary "Save self-check". On save: toast "Saved — your Sleep & Mind score will update." + return to Dashboard. Saved state persists — a saved check shows "Saved Day X" and can be edited.
- **States:** all §6 states apply. No field is required except sleep + mood.

### 8.6 Emergency Guide (PRD V2)
- **Trigger:** red EMERGENCY GUIDE button, every page, always visible, never disabled.
- **Situation picker:** 6 large cards (2 columns), each with icon + name: Collapsed / not breathing, Choking, Chest pain / can't breathe, Severe bleeding, Burn / electric shock, Radiation shelter.
- **Step view:** one big step at a time, 20px 600 step title, 16px body, progress bar top, "Previous" ghost + "Next step" primary. CPR step: 110 bpm metronome (visual pulse + count, mono).
- **End:** handover note card, "Call / signal Earth when link returns" + "Back to dashboard" primary.
- **Modal rules do NOT apply here:** Emergency is a full page, not a modal, and Esc / click-outside never closes it mid-step. It works fully offline.

### 8.7 PDF report / Handover (PRD M8, Flow 4)
- **In-app:** "Download PDF report" button → generates on-device, shows a toast on success, downloads a file named `OrbitCare-Day-<day>-report.pdf`.
- **PDF layout (light mode, §2):** Page 1: cover — title, mission day, crew at a glance (table). Page 2: per-astronaut scores. Page 3: vitals vs baseline + flags with full explanations. Page 4: complete action plan + disclaimer + AI disclosure. Footer on every page: "Simulated data only · Decision support only · Not a medical device" + page number.
- **PDF typography:** same Inter, same sizes as §3, light-mode colours only.

### 8.8 How It Works (PRD Flow 5 / explainer)
- **Layout:** single column, max-width 720px, centred.
- **Sections:** 1. The problem (Earth is 20 minutes away). 2. Your baseline (Days 1–21). 3. How a flag is made (z-score + Isolation Forest, in plain language, no maths beyond "how far from your normal"). 4. What OrbitCare is not (not a diagnosis, not a medical device, simulated data). 5. Demo: "Jump to Day 63" primary button.
- **No charts on this page except one small example trend** (same chart rules as §5).

---

## 9. Accessibility rules (non-negotiable)

1. **Contrast (WCAG AA, minimum):**
   - Normal text (14px+): ≥ 4.5:1. Large text (18px+ / 14px bold+): ≥ 3:1.
   - Checked pairs: `#EAF1FF` on `#020612` / `#081630` (passes), `#A9BCE0` on `#081630` (passes for secondary), `#6E84B3` on `#081630` is muted-only — never use it for body copy, only captions / placeholders.
   - Status text on its soft background passes: `#2FD6A3` on `#0A2E25`, `#FFB020` on `#33260A`, `#FF4D5E` on `#3A0F16`. Do not put warning/error text on the page background without the soft chip behind it.
   - **Never use colour alone** to show status. Every status has a chip label + text + (in tables) a score. Charts have markers + labels, not colour alone.
2. **Focus:** visible 2px `#7FB3FF` ring, offset 2px, on every interactive element (see §6). Focus order = visual order. No keyboard traps (except modal focus trap, which must return focus on close). Skip link "Skip to main content" as the first focusable element on every page.
3. **Keyboard navigation:** all actions work with Tab / Enter / Space / arrow keys (slider, segmented control, tabs). No hover-only actions. Esc closes modals / toasts, never the Emergency Guide mid-step.
4. **Screen readers:** every icon button has an aria-label. Status chips have `role="status"` and text, not just colour. Charts have a text summary ("Sleep is below your baseline for 3 days") next to them. The mission-day slider has `aria-valuetext="Day 63 of 180"`. Images / avatars have alt text or are aria-hidden with the name in text.
5. **Motion:** respect `prefers-reduced-motion` — disable Play auto-advance, chart animation, and skeleton pulse; show the final state immediately. No flashing above 3 flashes/second. The CPR metronome pulses at 110 bpm — it is user-started only, never auto-playing, and stops on "Next" / "Exit".
6. **Touch targets:** minimum 44×44px on mobile. Buttons, chips, nav links and slider thumbs all meet this.
7. **Language:** plain English, reading age ~12. No jargon without a plain-language line next to it. "z-score" is always followed by "(how far from your normal, in standard deviations)" on first use per page.

---

## 10. Do / Don't

**Do:** dark blue + black only · one primary action per section · baseline next to every number · worst-first everywhere · plain-language flags with actions · visible focus rings · test with wifi off.

**Don't:** new colours / fonts · gradients (except §8.1 hero) · diagnosis language ("you have…", "you are suffering from…") · black-box scores · colour-only status · hover-only information · emoji in the UI · stock photos in the app · light-mode app theme.

---

## 11. Tokens — copy-paste reference (CSS custom properties)

```css
:root {
  --color-bg: #020612;
  --color-bg-elevated: #050B1A;
  --color-surface: #081630;
  --color-surface-2: #0B1E42;
  --color-surface-3: #10264F;
  --color-border: #1E3A66;
  --color-border-strong: #2E4A7A;
  --color-primary: #2E7FFF;
  --color-primary-hover: #5C9DFF;
  --color-primary-pressed: #1F68E0;
  --color-primary-soft: #12294F;
  --color-secondary: #7FB3FF;
  --color-text: #EAF1FF;
  --color-text-secondary: #A9BCE0;
  --color-text-muted: #6E84B3;
  --color-success: #2FD6A3;
  --color-success-soft: #0A2E25;
  --color-warning: #FFB020;
  --color-warning-soft: #33260A;
  --color-error: #FF4D5E;
  --color-error-soft: #3A0F16;
  --color-emergency: #E11D2E;
  --color-focus: #7FB3FF;
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px; --radius-full: 999px;
  --font-display: Inter, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
}
```

*End of DESIGN.md v1.0. This file + PRD.md are the source of truth. Change the design here first, then change the UI — never the other way round.*
