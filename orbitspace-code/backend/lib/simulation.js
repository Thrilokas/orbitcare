// Orbitspace — simulated mission data + scoring (Node version).
// Mirrors js/data.js exactly (same seeds, same drift profiles, same
// SD floors and z-cap), so the Supabase backend and the browser frontend
// agree on every score, flag and demo day. All data is simulated.
'use strict';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a, m) => Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length) || 1;

const CREW = [
  { id: 'kenji', name: 'Kenji', role: 'Mission Specialist', avatar: 'k' },
  { id: 'amara', name: 'Amara', role: 'Commander', avatar: 'a' },
  { id: 'elena', name: 'Elena', role: 'Flight Engineer', avatar: 'e' },
];
const BASE = {
  kenji: { hr: 62, hrv: 68, sleep: 7.4, spo2: 98.5, bone: 100 },
  amara: { hr: 58, hrv: 72, sleep: 7.8, spo2: 98.7, bone: 100 },
  elena: { hr: 66, hrv: 60, sleep: 7.0, spo2: 98.2, bone: 100 },
};
const SD_FLOOR = { hr: 2.5, hrv: 4, sleep: 0.35, spo2: 0.4, bone: 0.6 };

// Drift profiles: 0 = normal, 1 = full effect. Day 63 is Kenji's peak.
function drift(id, day) {
  if (id === 'kenji') {
    if (day < 50) return 0;
    if (day < 63) return (day - 50) / 13;
    if (day < 90) return Math.max(0, 1 - (day - 63) / 27);
    return 0;
  }
  if (id === 'amara') {
    if (day < 118) return 0;
    if (day < 125) return (day - 118) / 7;
    if (day < 131) return 1;
    if (day < 140) return Math.max(0, 1 - (day - 131) / 9);
    return 0;
  }
  return 0;
}

function genCrew(id) {
  const rnd = mulberry32(id === 'kenji' ? 11 : id === 'amara' ? 23 : 37);
  const b = BASE[id];
  const out = []; let rad = 0;
  for (let day = 1; day <= 180; day++) {
    const d = drift(id, day);
    const boneLoss = id === 'elena' ? 0.055 * Math.max(0, day - 20) : 0.012 * Math.max(0, day - 20) * 0.4;
    const noise = (s) => (rnd() - 0.5) * 2 * s;
    rad += 0.31 + noise(0.05) + (id === 'elena' ? 0.02 : 0);
    out.push({
      astronaut_id: id, day,
      hr: Math.round((b.hr + d * 12 + noise(2.2)) * 10) / 10,
      hrv: Math.round((b.hrv - d * 18 + noise(3)) * 10) / 10,
      sleep: Math.round((b.sleep - d * 1.2 + noise(0.35)) * 10) / 10,
      spo2: Math.round((b.spo2 - d * 0.7 + noise(0.25)) * 10) / 10,
      bone: Math.round((b.bone - boneLoss - d * 0.4 + noise(0.15)) * 10) / 10,
      radiation: Math.round(rad * 10) / 10,
    });
  }
  return out;
}

// Full seed payload in the exact shape of the Supabase tables.
function generateSeedData() {
  const dailyReadings = [];
  const baselines = [];
  for (const c of CREW) {
    const rows = genCrew(c.id);
    dailyReadings.push(...rows);
    const first21 = rows.slice(0, 21);
    const bl = { astronaut_id: c.id };
    for (const k of ['hr', 'hrv', 'sleep', 'spo2', 'bone']) {
      const vals = first21.map((r) => r[k]);
      const m = mean(vals);
      bl[`${k}_mean`] = Math.round(m * 10) / 10;
      bl[`${k}_sd`] = Math.round(sd(vals, m) * 100) / 100;
    }
    baselines.push(bl);
  }
  return { crew: CREW, baselines, dailyReadings };
}

// ---- Scoring over rows fetched from Supabase ---------------------------
// `byDay` is a Map: day -> reading row. `baseline` is one baselines row.
function zScore(reading, baseline, key) {
  const effSd = Math.max(baseline[`${key}_sd`] || 1, SD_FLOOR[key] || 1);
  const raw = (reading[key] - baseline[`${key}_mean`]) / effSd;
  return key === 'hr' ? raw : -raw;
}
const scoreFromZ = (zv) => clamp(Math.round(100 - Math.min(Math.abs(zv), 3) * 10), 30, 100);

function domainScores(byDay, baseline, day, reading) {
  const avgZ = (key) => {
    const vals = [];
    for (let d = Math.max(1, day - 1); d <= Math.min(180, day + 1); d++) {
      if (byDay.has(d)) vals.push(zScore(byDay.get(d), baseline, key));
    }
    return mean(vals);
  };
  const heart = Math.round((scoreFromZ(avgZ('hr')) + scoreFromZ(avgZ('hrv'))) / 2);
  const bone = scoreFromZ(avgZ('bone'));
  const sleep = Math.round((scoreFromZ(avgZ('sleep')) + scoreFromZ(avgZ('hrv'))) / 2);
  const immune = Math.round(scoreFromZ(avgZ('spo2')) * 0.4 + clamp(100 - reading.radiation * 0.55, 55, 100) * 0.6);
  return { heart, bone, sleep, immune, overall: Math.round((heart + bone + sleep + immune) / 4) };
}

function flags(byDay, baseline, day, reading) {
  const checks = [
    ['hr', 'Resting heart rate elevated', 'Resting heart rate is above this astronaut\u2019s own 21-day baseline.'],
    ['hrv', 'Heart-rate variability low', 'HRV is below baseline — recovery is reduced today.'],
    ['sleep', 'Sleep below baseline', 'Sleep was shorter than this astronaut\u2019s usual baseline.'],
    ['spo2', 'Blood oxygen slightly low', 'SpO2 is below baseline. Check again at rest.'],
    ['bone', 'Bone density trending down', 'Bone density is drifting below baseline — important on long missions.'],
  ];
  return checks
    .map(([key, title, detail]) => {
      const zv = zScore(reading, baseline, key);
      return { key, title, detail, z: Math.round(zv * 10) / 10, level: zv >= 2.5 ? 'attention' : 'watch' };
    })
    .filter((f) => f.z >= 1.5)
    .sort((a, b) => b.z - a.z);
}

function actionPlan(fl, scores) {
  const plan = [];
  if (fl.length === 0) plan.push({ title: 'Stay the course', detail: 'All vitals are within this astronaut\u2019s baseline. Keep the normal schedule, sleep and exercise plan.' });
  if (fl.some((x) => x.key === 'hr' || x.key === 'hrv')) plan.push({ title: 'Ease the workload today', detail: 'Reduce high-intensity exercise. Add a 20-minute rest window and re-check resting heart rate tomorrow.' });
  if (fl.some((x) => x.key === 'sleep')) plan.push({ title: 'Protect sleep tonight', detail: 'Keep lights dim 1 hour before sleep, avoid late caffeine, and aim for the baseline sleep duration.' });
  if (fl.some((x) => x.key === 'bone') || scores.bone < 85) plan.push({ title: 'Bone & muscle session', detail: 'Do the planned resistance session and check calcium / vitamin D intake. Bone loss accumulates quietly — do not skip it.' });
  if (scores.immune < 85) plan.push({ title: 'Radiation & immune check', detail: 'Review cumulative radiation dose and recent illness symptoms with the crew medical lead.' });
  plan.push({ title: 'Re-check tomorrow', detail: 'Compare tomorrow\u2019s readings with the 21-day baseline before changing the plan.' });
  return plan;
}

// Full status for one astronaut on one day, from DB rows.
// `selfCheck` is the latest self_checks row for that astronaut+day, or null.
function astronautStatus(crewMember, byDay, baseline, day, selfCheck) {
  const reading = byDay.get(day);
  if (!reading) return null;
  const scores = domainScores(byDay, baseline, day, reading);
  const fl = flags(byDay, baseline, day, reading);
  if (selfCheck) {
    const adj = Math.round(((selfCheck.energy + selfCheck.mood) / 2 - 3) * 3 - (selfCheck.stress - 3) * 2);
    scores.sleep = clamp(scores.sleep + adj, 30, 100);
    scores.overall = Math.round((scores.heart + scores.bone + scores.sleep + scores.immune) / 4);
  }
  const level = scores.overall >= 90 ? 'nominal' : scores.overall >= 78 ? 'watch' : 'attention';
  return {
    id: crewMember.id, name: crewMember.name, role: crewMember.role, avatar: crewMember.avatar,
    day, scores, flags: fl, level, reading,
    plan: actionPlan(fl, scores),
    selfCheckApplied: !!selfCheck,
  };
}

function crewReport(day, statuses) {
  const lines = ['ORBITSPACE — CREW HEALTH REPORT', `Mission day ${day} of 180 (simulated data)`, 'Decision support only — not a medical device.', ''];
  for (const c of statuses) {
    lines.push(`${c.name} (${c.role}) — ${c.level.toUpperCase()} — ${c.scores.overall}/100`);
    lines.push(`  HR ${c.reading.hr} bpm · HRV ${c.reading.hrv} ms · Sleep ${c.reading.sleep} h · SpO2 ${c.reading.spo2}% · Bone ${c.reading.bone} · Radiation ${c.reading.radiation} mSv`);
    c.flags.forEach((f) => lines.push(`  FLAG: ${f.title} (z +${f.z})`));
    lines.push(`  Plan: ${c.plan.map((p) => p.title).join('; ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  CREW, generateSeedData, zScore, scoreFromZ, domainScores, flags, actionPlan, astronautStatus, crewReport,
};
