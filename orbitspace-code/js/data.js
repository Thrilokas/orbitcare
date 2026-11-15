/* Orbitspace — simulated mission data (all data simulated, decision support only) */
(function (global) {
  'use strict';

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function mean(arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; }
  function sd(arr, m) {
    var v = arr.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / arr.length;
    return Math.sqrt(v) || 1;
  }

  var CREW = [
    { id: 'kenji', name: 'Kenji', role: 'Mission Specialist', avatar: 'k' },
    { id: 'amara', name: 'Amara', role: 'Commander', avatar: 'a' },
    { id: 'elena', name: 'Elena', role: 'Flight Engineer', avatar: 'e' }
  ];

  var BASE = {
    kenji: { hr: 62, hrv: 68, sleep: 7.4, spo2: 98.5, bone: 100 },
    amara: { hr: 58, hrv: 72, sleep: 7.8, spo2: 98.7, bone: 100 },
    elena: { hr: 66, hrv: 60, sleep: 7.0, spo2: 98.2, bone: 100 }
  };

  // Drift profiles: 0 = normal, 1 = full effect. Day 63 is Kenji's peak.
  function drift(id, day) {
    if (id === 'kenji') {
      if (day < 50) return 0;
      if (day < 63) return (day - 50) / 13;          // gradual decline to Day 63
      if (day < 90) return Math.max(0, 1 - (day - 63) / 27); // recovery by Day 90
      return 0;
    }
    if (id === 'amara') {
      if (day < 118) return 0;
      if (day < 125) return (day - 118) / 7;         // schedule-shift dip
      if (day < 131) return 1;
      if (day < 140) return Math.max(0, 1 - (day - 131) / 9);
      return 0;
    }
    return 0;
  }

  function genCrew(id) {
    var rnd = mulberry32(id === 'kenji' ? 11 : id === 'amara' ? 23 : 37);
    var b = BASE[id];
    var out = [];
    var rad = 0;
    for (var day = 1; day <= 180; day++) {
      var d = drift(id, day);
      var boneLoss = id === 'elena' ? 0.055 * Math.max(0, day - 20) : 0.012 * Math.max(0, day - 20) * 0.4;
      var noise = function (s) { return (rnd() - 0.5) * 2 * s; };
      rad += 0.31 + noise(0.05) + (id === 'elena' ? 0.02 : 0);
      out.push({
        day: day,
        hr: Math.round((b.hr + d * 12 + noise(2.2)) * 10) / 10,
        hrv: Math.round((b.hrv - d * 18 + noise(3)) * 10) / 10,
        sleep: Math.round((b.sleep - d * 1.2 + noise(0.35)) * 10) / 10,
        spo2: Math.round((b.spo2 - d * 0.7 + noise(0.25)) * 10) / 10,
        bone: Math.round((b.bone - boneLoss - d * 0.4 + noise(0.15)) * 10) / 10,
        radiation: Math.round(rad * 10) / 10
      });
    }
    return out;
  }

  var DAYS = {};
  var BASELINES = {};
  CREW.forEach(function (c) {
    DAYS[c.id] = genCrew(c.id);
    var first21 = DAYS[c.id].slice(0, 21);
    var bl = {};
    ['hr', 'hrv', 'sleep', 'spo2', 'bone'].forEach(function (k) {
      var vals = first21.map(function (r) { return r[k]; });
      var m = mean(vals);
      bl[k] = { mean: Math.round(m * 10) / 10, sd: Math.round(sd(vals, m) * 100) / 100 };
    });
    BASELINES[c.id] = bl;
  });

  // Direction-aware z-score: positive = worse for every metric.
  // SD_FLOOR: the raw 21-day SD is tiny for slow metrics (bone, SpO2), so
  // without a floor a clinically small drift gives z = 10+. The floor keeps
  // z-scores in a realistic range while preserving the Day-63 story.
  var SD_FLOOR = { hr: 2.5, hrv: 4, sleep: 0.35, spo2: 0.4, bone: 0.6 };
  function z(id, day, key) {
    var r = DAYS[id][day - 1];
    var bl = BASELINES[id][key];
    var effSd = Math.max(bl.sd || 1, SD_FLOOR[key] || 1);
    var raw = (r[key] - bl.mean) / effSd;
    // hr: higher is worse. hrv/sleep/spo2/bone: lower is worse.
    return key === 'hr' ? raw : -raw;
  }

  function scoreFromZ(zv) {
    // z=0 -> 100, z=2 -> ~80, z=3 -> ~70 (capped: one bad metric cannot
    // drag a domain score below 70 on its own).
    var capped = Math.min(Math.abs(zv), 3);
    return clamp(Math.round(100 - capped * 10), 30, 100);
  }

  function domainScores(id, day) {
    // 3-day smoothing: average the metric over today +/- 1 day where available.
    function avgZ(key) {
      var vals = [];
      for (var d = Math.max(1, day - 1); d <= Math.min(180, day + 1); d++) vals.push(z(id, d, key));
      return mean(vals);
    }
    var heart = Math.round((scoreFromZ(avgZ('hr')) + scoreFromZ(avgZ('hrv'))) / 2);
    var bone = scoreFromZ(avgZ('bone'));
    var sleep = Math.round((scoreFromZ(avgZ('sleep')) + scoreFromZ(avgZ('hrv'))) / 2);
    var immune = Math.round((scoreFromZ(avgZ('spo2')) + clamp(100 - DAYS[id][day - 1].radiation / 0.9, 55, 100)) / 2);
    // Radiation score is a slow cumulative term, not a z-score; blend it in.
    immune = Math.round((scoreFromZ(avgZ('spo2')) * 0.4 + clamp(100 - DAYS[id][day - 1].radiation * 0.55, 55, 100) * 0.6));
    var overall = Math.round((heart + bone + sleep + immune) / 4);
    return { heart: heart, bone: bone, sleep: sleep, immune: immune, overall: overall };
  }

  function flags(id, day) {
    var out = [];
    var r = DAYS[id][day - 1];
    var checks = [
      ['hr', 'Resting heart rate elevated', 'Resting heart rate is above this astronaut\u2019s own 21-day baseline.'],
      ['hrv', 'Heart-rate variability low', 'HRV is below baseline — recovery is reduced today.'],
      ['sleep', 'Sleep below baseline', 'Sleep was shorter than this astronaut\u2019s usual baseline.'],
      ['spo2', 'Blood oxygen slightly low', 'SpO2 is below baseline. Check again at rest.'],
      ['bone', 'Bone density trending down', 'Bone density is drifting below baseline — important on long missions.']
    ];
    checks.forEach(function (c) {
      var zv = z(id, day, c[0]);
      if (zv >= 1.5) {
        out.push({ key: c[0], title: c[1], detail: c[2], z: Math.round(zv * 10) / 10, level: zv >= 2.5 ? 'attention' : 'watch' });
      }
    });
    out.sort(function (a, b) { return b.z - a.z; });
    return out;
  }

  function status(id, day) {
    var s = domainScores(id, day);
    var f = flags(id, day);
    // Level comes from the overall score only: one severely-off metric can
    // be an "attention" flag while the crew member is still Watch overall.
    var level = s.overall >= 90 ? 'nominal' : s.overall >= 78 ? 'watch' : 'attention';
    return { overall: s.overall, level: level, flags: f, scores: s };
  }

  function crewStatus(day) {
    return CREW.map(function (c) {
      var st = status(c.id, day);
      return { id: c.id, name: c.name, role: c.role, avatar: c.avatar, overall: st.overall, level: st.level, flags: st.flags, scores: st.scores };
    }).sort(function (a, b) { return a.overall - b.overall; }); // worst-first
  }

  function actionPlan(id, day) {
    var f = flags(id, day);
    var s = domainScores(id, day);
    var plan = [];
    if (f.length === 0) {
      plan.push({ title: 'Stay the course', detail: 'All vitals are within this astronaut\u2019s baseline. Keep the normal schedule, sleep and exercise plan.' });
    }
    if (f.some(function (x) { return x.key === 'hr' || x.key === 'hrv'; })) {
      plan.push({ title: 'Ease the workload today', detail: 'Reduce high-intensity exercise. Add a 20-minute rest window and re-check resting heart rate tomorrow.' });
    }
    if (f.some(function (x) { return x.key === 'sleep'; })) {
      plan.push({ title: 'Protect sleep tonight', detail: 'Keep lights dim 1 hour before sleep, avoid late caffeine, and aim for the baseline sleep duration.' });
    }
    if (f.some(function (x) { return x.key === 'bone'; }) || s.bone < 85) {
      plan.push({ title: 'Bone & muscle session', detail: 'Do the planned resistance session and check calcium / vitamin D intake. Bone loss accumulates quietly — do not skip it.' });
    }
    if (s.immune < 85) {
      plan.push({ title: 'Radiation & immune check', detail: 'Review cumulative radiation dose and recent illness symptoms with the crew medical lead.' });
    }
    plan.push({ title: 'Re-check tomorrow', detail: 'Compare tomorrow\u2019s readings with the 21-day baseline before changing the plan.' });
    return plan;
  }

  global.ORBIT = {
    crew: CREW, days: DAYS, baselines: BASELINES,
    getDay: function (id, day) { return DAYS[id][clamp(day, 1, 180) - 1]; },
    z: z, domainScores: domainScores, flags: flags, status: status,
    crewStatus: crewStatus, actionPlan: actionPlan
  };
})(typeof window !== 'undefined' ? window : globalThis);
