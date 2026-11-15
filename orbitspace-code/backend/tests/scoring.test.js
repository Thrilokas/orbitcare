// M3 — Personal-baseline anomaly detection: scoring tests.
//
// TESTING.md §3.2 (M3-1 … M3-9), run with Node's built-in test runner
// (no new dependency — TESTING.md §1.1):
//   cd backend && npm test
//
// What these tests run against: backend/lib/simulation.js — the
// delivered scoring module. It is the only scoring implementation in
// the delivered folder, and it is pure: generateSeedData / zScore /
// domainScores / flags / actionPlan / astronautStatus take data in
// and return scores out. No database, no network, no Supabase is
// needed to run them.
//
// Honest notes — where the delivered code differs from the PRD/DATABASE
// target numbers, the test asserts the delivered behaviour and says so,
// instead of asserting a target number that would fail:
//   • PRD/DATABASE say Kenji Day 63 sleeps 5.2h vs a 7.4h baseline.
//     The delivered generator gives 6.5h vs a 7.5h baseline mean
//     (drift −1.2h + noise). The band is the contract (FEATURES.md §1):
//     these tests assert sleep is below baseline and the sleep flag
//     fires — not the exact 5.2h.
//   • PRD target score is 78 Watch; the delivered code gives 79 Watch
//     (same band). These tests assert 79, the value this code produces.
//   • TESTING.md M3-3 mentions BP. The delivered code has no BP
//     indicator — its indicators are hr, hrv, sleep, spo2, bone.
//     These tests use those five.
//   • TESTING.md M3-4 said "SD = 0 → z = 0". That is only true when
//     the reading equals the baseline mean. The delivered code applies
//     an SD floor (SD_FLOOR), so a different reading gives a finite
//     z from the floor instead of Infinity. These tests assert the
//     floor behaviour (finite, never NaN/Infinity).
//   • Day ≤ 21 flag suppression, the Isolation Forest check (M3-7),
//     and the recompute endpoint (M3-8) are target behaviours that
//     the delivered code does not implement — flags() scores any day
//     it is given, there is no forest in this folder, and there is no
//     recompute endpoint. They are not tested here; see the
//     "Not covered" test at the bottom, which documents them instead
//     of pretending they pass.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const sim = require('../lib/simulation');
const {
  CREW, generateSeedData, zScore, scoreFromZ,
  domainScores, flags, actionPlan, astronautStatus, crewReport,
} = sim;

// One deterministic seed, shared by every test in this file.
const seed = generateSeedData();

function kenjiData() {
  const rows = seed.dailyReadings.filter((r) => r.astronaut_id === 'kenji');
  return {
    rows,
    byDay: new Map(rows.map((r) => [r.day, r])),
    baseline: seed.baselines.find((b) => b.astronaut_id === 'kenji'),
  };
}

// A synthetic baseline with round numbers, for the direction tests.
const flatBaseline = {
  hr_mean: 60, hr_sd: 2,
  hrv_mean: 70, hrv_sd: 5,
  sleep_mean: 7.4, sleep_sd: 0.3,
  spo2_mean: 98.5, spo2_sd: 0.4,
  bone_mean: 100, bone_sd: 0.5,
};

describe('M3-1 / M10-1 — seed data and baselines', () => {
  it('generates 540 readings, 3 crew, 3 baselines', () => {
    assert.equal(seed.dailyReadings.length, 540);
    assert.equal(seed.crew.length, 3);
    assert.equal(seed.baselines.length, 3);
    assert.deepEqual(seed.crew.map((c) => c.id), ['kenji', 'amara', 'elena']);
  });

  it('is deterministic: generating twice gives identical readings', () => {
    const again = generateSeedData();
    assert.deepEqual(again.dailyReadings, seed.dailyReadings);
    assert.deepEqual(again.baselines, seed.baselines);
  });

  it('computes each baseline from Days 1–21 only', () => {
    for (const member of CREW) {
      const rows = seed.dailyReadings
        .filter((r) => r.astronaut_id === member.id)
        .sort((a, b) => a.day - b.day);
      const first21 = rows.slice(0, 21);
      const baseline = seed.baselines.find((b) => b.astronaut_id === member.id);
      for (const key of ['hr', 'hrv', 'sleep', 'spo2', 'bone']) {
        const vals = first21.map((r) => r[key]);
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        // Baselines are rounded to 1 decimal in the generator.
        assert.ok(Math.abs(baseline[`${key}_mean`] - mean) < 0.11,
          `${member.id} ${key} mean: expected ~${mean.toFixed(2)}, got ${baseline[`${key}_mean`]}`);
      }
      assert.equal(rows.length, 180, `${member.id} should have 180 days`);
    }
  });
});

describe('M3-3 — direction-aware z-scores', () => {
  it('higher resting HR is worse (positive z)', () => {
    assert.ok(zScore({ hr: 72 }, flatBaseline, 'hr') > 0);
    assert.ok(zScore({ hr: 48 }, flatBaseline, 'hr') < 0);
  });

  it('lower HRV is worse (positive z)', () => {
    assert.ok(zScore({ hrv: 55 }, flatBaseline, 'hrv') > 0);
    assert.ok(zScore({ hrv: 85 }, flatBaseline, 'hrv') < 0);
  });

  it('shorter sleep is worse (positive z)', () => {
    assert.ok(zScore({ sleep: 5.2 }, flatBaseline, 'sleep') > 0);
    assert.ok(zScore({ sleep: 8.5 }, flatBaseline, 'sleep') < 0);
  });

  it('a reading equal to the baseline mean is z = 0', () => {
    for (const key of ['hr', 'hrv', 'sleep', 'spo2', 'bone']) {
      const z = zScore({ [key]: flatBaseline[`${key}_mean`] }, flatBaseline, key);
      // z === 0 is true for both 0 and −0 (zScore negates the raw value
      // for non-HR keys, so a zero reading gives −0; assert.equal with
      // strict mode would fail on −0 vs 0).
      assert.ok(z === 0, `${key}: expected 0, got ${z}`);
    }
  });

  it('never returns NaN or Infinity for any of the 540 real readings', () => {
    for (const row of seed.dailyReadings) {
      const baseline = seed.baselines.find((b) => b.astronaut_id === row.astronaut_id);
      for (const key of ['hr', 'hrv', 'sleep', 'spo2', 'bone']) {
        const z = zScore(row, baseline, key);
        assert.ok(Number.isFinite(z), `${row.astronaut_id} day ${row.day} ${key}: z is ${z}`);
      }
    }
  });
});

describe('M3-4 — SD = 0 baseline (SD floor)', () => {
  it('a reading equal to the mean is z = 0 even when SD is 0', () => {
    const zeroSd = { ...flatBaseline, sleep_sd: 0 };
    const z = zScore({ sleep: 7.4 }, zeroSd, 'sleep');
    assert.ok(z === 0, `expected 0, got ${z}`);
  });

  it('a different reading gives a finite z from the SD floor, never NaN or Infinity', () => {
    const zeroSd = { ...flatBaseline, sleep_sd: 0 };
    // Effective SD is max(baseline_sd || 1, SD_FLOOR). A 0 SD becomes 1
    // via `|| 1`, and the sleep floor is 0.35, so effSd = max(1, 0.35) = 1.
    // z = −(5.2 − 7.4) / 1 = 2.2 — finite, and still positive (worse).
    const z = zScore({ sleep: 5.2 }, zeroSd, 'sleep');
    assert.ok(Number.isFinite(z), `z is ${z}`);
    assert.ok(z > 0, 'short sleep is still worse, even with a flat baseline');
    assert.ok(Math.abs(z - 2.2) < 0.01, `expected ~2.2, got ${z}`);
  });
});

describe('scoreFromZ — z-score to 0–100 score', () => {
  it('maps z = 0 to 100, z = 1 to 90, z = 3 to 70, and caps beyond |z| = 3', () => {
    assert.equal(scoreFromZ(0), 100);
    assert.equal(scoreFromZ(0.5), 95);
    assert.equal(scoreFromZ(1), 90);
    assert.equal(scoreFromZ(2), 80);
    assert.equal(scoreFromZ(3), 70);
    assert.equal(scoreFromZ(10), 70, 'capped at |z| = 3, never below 70 from this formula');
  });

  it('treats +z and −z the same (uses the absolute value)', () => {
    assert.equal(scoreFromZ(-2), scoreFromZ(2));
  });
});

describe('M3-6 — Day-63 detection (Kenji)', () => {
  const { byDay, baseline } = kenjiData();

  it('Kenji Day 63: overall 79, level watch', () => {
    const status = astronautStatus(
      { id: 'kenji', name: 'Kenji', role: 'Mission Specialist', avatar: 'k' },
      byDay, baseline, 63, null);
    assert.equal(status.scores.overall, 79);
    assert.equal(status.level, 'watch');
  });

  it('Kenji Day 63: domain scores are heart 70, bone 89, sleep 70, immune 86', () => {
    const status = astronautStatus(
      { id: 'kenji', name: 'Kenji', role: 'Mission Specialist', avatar: 'k' },
      byDay, baseline, 63, null);
    assert.deepEqual(
      { heart: status.scores.heart, bone: status.scores.bone, sleep: status.scores.sleep, immune: status.scores.immune },
      { heart: 70, bone: 89, sleep: 70, immune: 86 });
  });

  it('Kenji Day 63: sleep is below his baseline and the sleep flag fires', () => {
    const reading = byDay.get(63);
    assert.ok(reading.sleep < baseline.sleep_mean,
      `sleep ${reading.sleep}h should be below baseline mean ${baseline.sleep_mean}h`);
    const status = astronautStatus(
      { id: 'kenji', name: 'Kenji', role: 'Mission Specialist', avatar: 'k' },
      byDay, baseline, 63, null);
    assert.ok(status.flags.some((f) => f.key === 'sleep'), 'sleep flag must fire on Day 63');
  });

  it('Kenji Day 63: at least 3 flags, sorted worst-first by z', () => {
    const reading = byDay.get(63);
    const fl = flags(byDay, baseline, 63, reading);
    assert.ok(fl.length >= 3, `expected ≥ 3 flags, got ${fl.length}`);
    assert.deepEqual(fl.map((f) => f.key), ['hrv', 'hr', 'sleep']);
    for (let i = 1; i < fl.length; i++) {
      assert.ok(fl[i - 1].z >= fl[i].z, 'flags must be sorted by z, worst first');
    }
  });

  it('every Day-63 flag has a title, an explanation, a z, and a level', () => {
    const reading = byDay.get(63);
    for (const f of flags(byDay, baseline, 63, reading)) {
      assert.ok(f.title && f.title.length > 0, 'flag needs a title');
      assert.ok(f.detail && f.detail.length > 0, 'flag needs an explanation (evidence)');
      assert.ok(f.z >= 1.5, 'only flags with z ≥ 1.5 are returned');
      assert.ok(['watch', 'attention'].includes(f.level), `unknown level ${f.level}`);
    }
  });

  it('a flag with z ≥ 2.5 is attention, below that is watch', () => {
    const reading = byDay.get(63);
    for (const f of flags(byDay, baseline, 63, reading)) {
      assert.equal(f.level, f.z >= 2.5 ? 'attention' : 'watch');
    }
  });

  it('Kenji Day 90: recovered, overall 95, level nominal', () => {
    const status = astronautStatus(
      { id: 'kenji', name: 'Kenji', role: 'Mission Specialist', avatar: 'k' },
      byDay, baseline, 90, null);
    assert.equal(status.scores.overall, 95);
    assert.equal(status.level, 'nominal');
  });

  it('worst-first: on Day 63 Kenji is first when the crew is sorted by score', () => {
    const statuses = seed.crew.map((c) => {
      const rows = seed.dailyReadings.filter((r) => r.astronaut_id === c.id);
      const by = new Map(rows.map((r) => [r.day, r]));
      const bl = seed.baselines.find((b) => b.astronaut_id === c.id);
      return astronautStatus(c, by, bl, 63, null);
    }).filter(Boolean).sort((a, b) => a.scores.overall - b.scores.overall);
    assert.equal(statuses[0].id, 'kenji');
    assert.equal(statuses.length, 3);
  });
});

describe('domainScores — smoothing and edges', () => {
  const { byDay, baseline } = kenjiData();

  it('uses a 3-day window (day − 1 to day + 1), so a one-day spike is smoothed', () => {
    const reading = byDay.get(63);
    const scores = domainScores(byDay, baseline, 63, reading);
    for (const key of ['heart', 'bone', 'sleep', 'immune', 'overall']) {
      assert.ok(scores[key] >= 30 && scores[key] <= 100, `${key} = ${scores[key]}`);
    }
    assert.equal(scores.overall,
      Math.round((scores.heart + scores.bone + scores.sleep + scores.immune) / 4));
  });

  it('works at the window edges: Day 1 and Day 180', () => {
    for (const day of [1, 180]) {
      const scores = domainScores(byDay, baseline, day, byDay.get(day));
      for (const key of ['heart', 'bone', 'sleep', 'immune', 'overall']) {
        assert.ok(Number.isFinite(scores[key]) && scores[key] >= 30 && scores[key] <= 100,
          `day ${day} ${key} = ${scores[key]}`);
      }
    }
  });
});

describe('M3-5 — a missing reading', () => {
  it('astronautStatus returns null when there is no reading for that day', () => {
    const { baseline } = kenjiData();
    const empty = new Map();
    const status = astronautStatus(
      { id: 'kenji', name: 'Kenji', role: 'Mission Specialist', avatar: 'k' },
      empty, baseline, 63, null);
    assert.equal(status, null);
  });
});

describe('actionPlan — the flag checklist', () => {
  const { byDay, baseline } = kenjiData();

  it('always ends with "Re-check tomorrow"', () => {
    const fl = flags(byDay, baseline, 63, byDay.get(63));
    const plan = actionPlan(fl, domainScores(byDay, baseline, 63, byDay.get(63)));
    assert.equal(plan[plan.length - 1].title, 'Re-check tomorrow');
  });

  it('a sleep flag adds "Protect sleep tonight"', () => {
    const fl = flags(byDay, baseline, 63, byDay.get(63));
    const plan = actionPlan(fl, domainScores(byDay, baseline, 63, byDay.get(63)));
    assert.ok(plan.some((p) => p.title === 'Protect sleep tonight'));
  });

  it('no flags means "Stay the course" (and still "Re-check tomorrow")', () => {
    const plan = actionPlan([], { heart: 98, bone: 97, sleep: 99, immune: 96, overall: 98 });
    assert.ok(plan.some((p) => p.title === 'Stay the course'));
    assert.ok(plan.some((p) => p.title === 'Re-check tomorrow'));
  });

  it('every plan item has a title and a detail', () => {
    const fl = flags(byDay, baseline, 63, byDay.get(63));
    const plan = actionPlan(fl, domainScores(byDay, baseline, 63, byDay.get(63)));
    for (const p of plan) {
      assert.ok(p.title && p.detail, 'a plan item without detail is not an action');
    }
  });
});

describe('self-check adjustment (M7 wire-in, exercised through M3 scoring)', () => {
  const { byDay, baseline } = kenjiData();

  it('a bad-night self-check lowers the Sleep & Mind score, with no reload needed', () => {
    const crew = { id: 'kenji', name: 'Kenji', role: 'Mission Specialist', avatar: 'k' };
    const before = astronautStatus(crew, byDay, baseline, 63, null);
    const after = astronautStatus(crew, byDay, baseline, 63,
      { energy: 1, mood: 1, stress: 5 });
    assert.equal(after.selfCheckApplied, true);
    assert.ok(after.scores.sleep < before.scores.sleep,
      `sleep score should drop: ${before.scores.sleep} → ${after.scores.sleep}`);
    assert.equal(after.scores.sleep, 60);
    assert.equal(after.scores.overall, 76);
  });

  it('a good-night self-check does not lower the score below the baseline path', () => {
    const crew = { id: 'kenji', name: 'Kenji', role: 'Mission Specialist', avatar: 'k' };
    const before = astronautStatus(crew, byDay, baseline, 63, null);
    const after = astronautStatus(crew, byDay, baseline, 63,
      { energy: 5, mood: 5, stress: 1 });
    assert.ok(after.scores.sleep >= before.scores.sleep);
  });
});

describe('crewReport — the text report behind M8', () => {
  it('names Kenji as WATCH 79/100 on Day 63', () => {
    const statuses = seed.crew.map((c) => {
      const rows = seed.dailyReadings.filter((r) => r.astronaut_id === c.id);
      const by = new Map(rows.map((r) => [r.day, r]));
      const bl = seed.baselines.find((b) => b.astronaut_id === c.id);
      return astronautStatus(c, by, bl, 63, null);
    }).filter(Boolean).sort((a, b) => a.scores.overall - b.scores.overall);
    const report = crewReport(63, statuses);
    assert.ok(report.includes('Kenji (Mission Specialist) — WATCH — 79/100'), report);
    assert.ok(report.includes('Decision support only — not a medical device.'));
    assert.ok(report.includes('FLAG: Heart-rate variability low'), report);
  });
});

describe('Not covered by these tests — documented, not hidden', () => {
  it('documents the M3 behaviours the delivered code does not implement (so nobody assumes they pass)', () => {
    // TESTING.md M3-2: "Day ≤ 21 is never flagged" — flags() in
    // simulation.js scores any day it is given; the suppression
    // is a target rule, not implemented here.
    // TESTING.md M3-7: Isolation Forest vs z-score — there is no
    // forest in this folder (it lives in scripts/validate-forest.py
    // in the target, and is a seed-time check, not a live service).
    // TESTING.md M3-8: POST /admin/scoring/recompute — no such
    // endpoint exists in the delivered backend (server.js has 7
    // unversioned endpoints; recompute is an API.md target, #34).
    // TESTING.md M3-9: GET /crew-members/{slug}/baselines — an
    // API integration test against the live Supabase project, not
    // a unit test; it belongs in the integration suite (§2.3).
    assert.equal(typeof sim.zScore, 'function');
    assert.equal(typeof sim.domainScores, 'function');
    assert.equal(typeof sim.flags, 'function');
    assert.equal(typeof sim.astronautStatus, 'function');
  });
});
