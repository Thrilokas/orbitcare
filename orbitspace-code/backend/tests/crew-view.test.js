// M1 — Crew View (worst-first): tests.
//
// TESTING.md §3.4 (M1-1 … M1-10), run with Node's built-in test runner:
//   cd backend && npm test
//
// What these tests run against:
//   • The frontend's ordering: ORBIT.crewStatus() in js/data.js — the
//     same function index.html renders as the #1, #2, #3 crew cards
//     (js/app.js maps the array order straight into the cards, so
//     array order IS the visual order). data.js is a browser script,
//     not a module, so it is loaded here with require() — it attaches
//     ORBIT to globalThis and uses no DOM.
//   • The backend's ordering: statusesForDay() + clampDay() in
//     server.js, exported for these tests. That is the sort behind
//     GET /api/crew-status?day=63.
//
// Honest notes — where the delivered code differs from the
// PRD/FEATURES target, the test asserts the delivered behaviour:
//   • TESTING.md M1-2 said "a tie breaks by name". There is no
//     name tiebreak in either layer: Array.sort is stable, so a tie
//     keeps the input order — and the input order differs between
//     layers. Frontend CREW order is Kenji, Amara, Elena; backend
//     loadDay() orders crew by id (Amara, Elena, Kenji). On Day 90
//     Kenji and Amara both score 95: the frontend puts Kenji first,
//     the backend puts Amara first. Both are asserted below, and
//     the inconsistency is documented, not hidden.
//   • TESTING.md M1-6 ("All crew Nominal today."), M1-8 (skeleton
//     loading), M1-9 ("No mission data yet — run the seed") and
//     M1-10 (OFFLINE chip) are UI states that do not exist in the
//     delivered frontend. index.html and js/app.js contain none of
//     those strings (verified by grep, 15 Nov 2026): the frontend
//     renders from its in-browser copy of the data and has no
//     loading, empty, or offline state at all. They are documented
//     in the "Not covered" test, not asserted as passing.
//   • TESTING.md M1-5 (unknown slug → 404) is an API integration
//     test: it needs the server running against the live Supabase
//     project. It is documented, not run, in this file.
//   • TESTING.md M1-7 (non-integer day → Day 1) is the backend
//     behaviour (clampDay). The frontend's getDay() with a
//     non-numeric day returns undefined — also documented below;
//     it is only reachable via a crafted URL, since the slider
//     always gives a number.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const sim = require('../lib/simulation');
const server = require('../server');
const { statusesForDay, clampDay } = server;

// Load the frontend's data module: it attaches ORBIT to globalThis.
require(path.join(__dirname, '..', '..', 'js', 'data.js'));
const ORBIT = globalThis.ORBIT;

const seed = generateSeedDataFixed();

// Build the `loaded` object server.js loadDay() returns, from the seed.
// Crew is ordered by id here, exactly as loadDay() does
// (supabase .order('id')).
function generateSeedDataFixed() {
  return sim.generateSeedData();
}

function loadedForSeed() {
  const crew = [...seed.crew].sort((a, b) => a.id.localeCompare(b.id));
  const baselines = new Map(seed.baselines.map((b) => [b.astronaut_id, b]));
  const byAstronaut = new Map();
  for (const row of seed.dailyReadings) {
    if (!byAstronaut.has(row.astronaut_id)) byAstronaut.set(row.astronaut_id, new Map());
    byAstronaut.get(row.astronaut_id).set(row.day, row);
  }
  return { crew, baselines, byAstronaut, latestCheck: new Map() };
}

describe('M1-1 — worst-first, Day 63 (frontend)', () => {
  it('Kenji is first, Watch, 79; Elena 90 Nominal; Amara 98 Nominal', () => {
    const list = ORBIT.crewStatus(63);
    assert.deepEqual(list.map((c) => [c.id, c.overall, c.level]), [
      ['kenji', 79, 'watch'],
      ['elena', 90, 'nominal'],
      ['amara', 98, 'nominal'],
    ]);
  });

  it('the array is sorted ascending by overall score (worst first)', () => {
    for (let day = 1; day <= 180; day++) {
      const list = ORBIT.crewStatus(day);
      assert.equal(list.length, 3, `day ${day} must list all 3 crew`);
      for (let i = 1; i < list.length; i++) {
        assert.ok(list[i - 1].overall <= list[i].overall,
          `day ${day}: ${list[i - 1].id} (${list[i - 1].overall}) must come before ${list[i].id} (${list[i].overall})`);
      }
    }
  });

  it('the array order is the visual order: app.js renders it as cards #1, #2, #3', () => {
    // js/app.js maps ORBIT.crewStatus(d) straight into the crew cards,
    // with '#' + (i + 1) as the rank, so array order = DOM order.
    // There is no separate visual sort to drift from this one.
    const list = ORBIT.crewStatus(63);
    assert.equal(list[0].id, 'kenji');
    assert.equal(list[0].name, 'Kenji');
  });
});

describe('M1-2 — sorting rule and ties', () => {
  it('a lower score always comes first (79 before 90 before 98 on Day 63)', () => {
    const list = ORBIT.crewStatus(63);
    assert.ok(list[0].overall < list[1].overall && list[1].overall < list[2].overall);
  });

  it('a tie keeps the input order — frontend: Kenji before Amara on Day 90 (both 95)', () => {
    const list = ORBIT.crewStatus(90);
    assert.deepEqual(list.map((c) => [c.id, c.overall, c.level]), [
      ['elena', 88, 'watch'],
      ['kenji', 95, 'nominal'],
      ['amara', 95, 'nominal'],
    ]);
  });

  it('a tie keeps the input order — backend: Amara before Kenji on Day 90 (both 95)', () => {
    // The backend loads crew ordered by id (Amara, Elena, Kenji), so
    // the stable sort keeps Amara ahead of Kenji on a tie. This
    // DIFFERS from the frontend (previous test). There is no name
    // tiebreak in either layer — the difference is the input order.
    const loaded = loadedForSeed();
    const list = statusesForDay(loaded, 90);
    assert.deepEqual(list.map((c) => [c.id, c.scores.overall]), [
      ['elena', 88],
      ['amara', 95],
      ['kenji', 95],
    ]);
  });

  it('backend and frontend agree on the worst score on every day (ties are input order, not a bug)', () => {
    const loaded = loadedForSeed();
    for (let day = 1; day <= 180; day++) {
      const front = ORBIT.crewStatus(day);
      const back = statusesForDay(loaded, day);
      // The worst SCORE must agree. The worst PERSON need not: on a
      // full tie (e.g. Day 5, all three score 99) the stable sort
      // keeps each layer's input order — frontend CREW order puts
      // Kenji first, backend id order puts Amara first. Same score,
      // different name. That is the documented tie behaviour, not
      // a scoring disagreement: the probe on 15 Nov 2026 confirmed
      // the scores match on every sampled day.
      assert.equal(back[0].scores.overall, front[0].overall,
        `day ${day}: backend worst score is ${back[0].scores.overall}, frontend worst score is ${front[0].overall}`);
      assert.equal(back[0].level, front[0].level);
    }
  });
});

describe('M1-3 — the order changes on Day 90', () => {
  it('Kenji is no longer first on Day 90 (he recovered to Nominal)', () => {
    const d63 = ORBIT.crewStatus(63);
    const d90 = ORBIT.crewStatus(90);
    assert.equal(d63[0].id, 'kenji');
    assert.notEqual(d90[0].id, 'kenji');
    assert.equal(d90[0].id, 'elena');
    assert.equal(d90.find((c) => c.id === 'kenji').level, 'nominal');
  });
});

describe('M1-4 / M1-7 — day clamping (backend clampDay)', () => {
  it('clamps 0 → 1 and 200 → 180', () => {
    assert.equal(clampDay(0), 1);
    assert.equal(clampDay(200), 180);
    assert.equal(clampDay(-5), 1);
    assert.equal(clampDay(1), 1);
    assert.equal(clampDay(180), 180);
    assert.equal(clampDay(63), 63);
  });

  it('a numeric string works, a non-numeric day becomes Day 1', () => {
    assert.equal(clampDay('63'), 63);
    assert.equal(clampDay('abc'), 1);
    assert.equal(clampDay(null), 1);
    assert.equal(clampDay(undefined), 1);
    assert.equal(clampDay(1.5), 1, 'parseInt truncates the fraction');
  });

  it('frontend getDay() clamps the same way for numbers (0 → day 1, 200 → day 180)', () => {
    assert.equal(ORBIT.getDay('kenji', 0).day, 1);
    assert.equal(ORBIT.getDay('kenji', 200).day, 180);
    assert.equal(ORBIT.getDay('kenji', 63).day, 63);
  });

  it('frontend getDay() with a non-numeric day returns undefined (documented gap)', () => {
    // clamp() in js/data.js does Math.max(1, Math.min(180, 'abc')),
    // which is NaN — so DAYS[id][NaN - 1] is undefined. Only reachable
    // via a crafted URL (?day=abc), since the slider always gives a
    // number; the backend (clampDay) returns Day 1 for the same input.
    assert.equal(ORBIT.getDay('kenji', 'abc'), undefined);
  });
});

describe('M1 — the backend sort (statusesForDay)', () => {
  it('Day 63: Kenji first, Watch 79, via the API sort path', () => {
    const loaded = loadedForSeed();
    const list = statusesForDay(loaded, 63);
    assert.equal(list[0].id, 'kenji');
    assert.equal(list[0].level, 'watch');
    assert.equal(list[0].scores.overall, 79);
    assert.deepEqual(list.map((c) => c.id), ['kenji', 'elena', 'amara']);
  });

  it('a crew member with no reading that day is left out, not crashed on', () => {
    const loaded = loadedForSeed();
    loaded.byAstronaut.set('elena', new Map());
    const list = statusesForDay(loaded, 63);
    assert.equal(list.length, 2);
    assert.equal(list[0].id, 'kenji');
  });

  it('an empty crew list returns an empty list (no crash)', () => {
    const list = statusesForDay(
      { crew: [], baselines: new Map(), byAstronaut: new Map(), latestCheck: new Map() }, 63);
    assert.deepEqual(list, []);
  });
});

describe('Not covered by these tests — documented, not hidden', () => {
  it('documents the M1 behaviours the delivered code does not have', () => {
    // TESTING.md M1-5: unknown slug → 404. That is the
    // GET /api/astronaut/:id route in server.js (it returns 404
    // 'unknown astronaut or no data — run POST /api/seed first').
    // It is an integration test: it needs the server running
    // against the live Supabase project, so it cannot run in
    // this offline unit file.
    // TESTING.md M1-6: "All crew Nominal today." — no such string
    // exists in index.html or js/app.js. On an all-Nominal day
    // (e.g. Day 1) the frontend lists the three cards with
    // Nominal pills and no summary line.
    // TESTING.md M1-8: skeleton loading — there is no loading
    // state in the delivered frontend (the data is in-browser,
    // so there is nothing to wait for).
    // TESTING.md M1-9: "No mission data yet — run the seed" — no
    // such string exists in the frontend; with an empty database
    // the API returns an empty crew list, which the frontend
    // (reading its own in-browser copy) never sees.
    // TESTING.md M1-10: OFFLINE chip — there is no sync chip and
    // no offline state in the delivered frontend; it does not
    // call the API at all, so "offline" is its normal state.
    // M1-6 / M1-8 / M1-9 / M1-10 belong in the Next.js target's
    // component + E2E tests (TESTING.md §2.2, §2.4), not here.
    assert.equal(typeof ORBIT.crewStatus, 'function');
    assert.equal(typeof statusesForDay, 'function');
    assert.equal(typeof clampDay, 'function');
  });
});
