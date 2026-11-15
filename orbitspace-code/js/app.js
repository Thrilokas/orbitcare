/* Orbitspace — shared logic: mission day, crew switching, charts, flags, plans, self-check, report */
(function () {
  'use strict';
  var DAY_KEY = 'orbitspace-day';
  var WHO_KEY = 'orbitspace-crew';
  var CHECK_KEY = 'orbitspace-selfcheck-';

  function day() {
    var d = parseInt(localStorage.getItem(DAY_KEY) || '1', 10);
    return isNaN(d) ? 1 : Math.max(1, Math.min(180, d));
  }
  function setDay(d) {
    d = Math.max(1, Math.min(180, d));
    localStorage.setItem(DAY_KEY, String(d));
    renderAll();
  }
  function who() { return localStorage.getItem(WHO_KEY) || 'kenji'; }
  function setWho(id) { localStorage.setItem(WHO_KEY, id); renderAll(); }

  var playTimer = null;
  function togglePlay(btn) {
    if (playTimer) { clearInterval(playTimer); playTimer = null; if (btn) btn.textContent = '▶ Play mission'; return; }
    if (btn) btn.textContent = '⏸ Pause';
    playTimer = setInterval(function () {
      var d = day();
      if (d >= 180) { togglePlay(btn); return; }
      setDay(d + 1);
    }, 350);
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function pill(level) {
    var label = level === 'nominal' ? 'Nominal' : level === 'watch' ? 'Watch' : 'Attention';
    return '<span class="pill ' + level + '">' + label + '</span>';
  }
  function scoreBar(label, value) {
    return '<p><strong>' + label + '</strong> — ' + value + '/100</p><div class="bar"><i style="width:' + value + '%"></i></div>';
  }

  function lineChart(el, series, opts) {
    // series: [{label, values:[...], color}], opts: {min, max, unit}
    var W = 640, H = 180, P = 28;
    var min = opts.min, max = opts.max;
    function x(i) { return P + (i / (series[0].values.length - 1)) * (W - 2 * P); }
    function y(v) { return H - P - ((v - min) / (max - min)) * (H - 2 * P); }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.title || 'Trend chart') + '">';
    svg += '<line x1="' + P + '" y1="' + (H - P) + '" x2="' + (W - P) + '" y2="' + (H - P) + '" stroke="#1a335f"/>';
    if (opts.band) {
      svg += '<rect x="' + P + '" y="' + y(opts.band[1]) + '" width="' + (W - 2 * P) + '" height="' + (y(opts.band[0]) - y(opts.band[1])) + '" fill="#2e7fff" opacity="0.12"/>';
    }
    series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
      svg += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2"/>';
    });
    svg += '<text x="' + P + '" y="16" fill="#9db4d6" font-size="12">' + esc(opts.title || '') + ' — Day 1–180</text>';
    svg += '<text x="' + P + '" y="' + (H - 6) + '" fill="#9db4d6" font-size="11">Day 1</text>';
    svg += '<text x="' + (W - P - 40) + '" y="' + (H - 6) + '" fill="#9db4d6" font-size="11">Day 180</text>';
    svg += '</svg>';
    el.innerHTML = svg;
  }

  function crewCardsHtml(d) {
    return ORBIT.crewStatus(d).map(function (c, i) {
      var r = ORBIT.getDay(c.id, d);
      return '<button class="card crew" data-crew="' + c.id + '">' +
        '<div class="who"><div class="avatar ' + c.avatar + '">' + esc(c.name[0]) + '</div>' +
        '<div><h3>#' + (i + 1) + ' — ' + esc(c.name) + ' ' + pill(c.level) + '</h3>' +
        '<p class="muted">' + esc(c.role) + ' · Score ' + c.overall + '/100</p></div></div>' +
        '<p>Resting HR ' + r.hr + ' bpm · HRV ' + r.hrv + ' ms · Sleep ' + r.sleep + ' h</p>' +
        '<p class="muted">' + c.flags.length + ' flag(s) today — tap for their Astronaut page →</p></button>';
    }).join('');
  }

  function vitalsTable(id, d) {
    var r = ORBIT.getDay(id, d);
    var bl = ORBIT.baselines[id];
    function row(label, key, unit) {
      return '<tr><td>' + label + '</td><td>' + r[key] + ' ' + unit + '</td><td>' + bl[key].mean + ' ± ' + bl[key].sd + '</td><td>z ' + (ORBIT.z(id, d, key) >= 0 ? '+' : '') + ORBIT.z(id, d, key).toFixed(1) + '</td></tr>';
    }
    return '<table><tr><th>Vital</th><th>Today (Day ' + d + ')</th><th>Baseline (Days 1–21)</th><th>Direction-aware z</th></tr>' +
      row('Resting heart rate', 'hr', 'bpm') + row('Heart-rate variability', 'hrv', 'ms') +
      row('Sleep', 'sleep', 'h') + row('Blood oxygen (SpO2)', 'spo2', '%') + row('Bone density index', 'bone', '') +
      '<tr><td>Cumulative radiation</td><td>' + r.radiation + ' mSv</td><td>—</td><td>—</td></tr></table>';
  }

  function flagsHtml(id, d) {
    var f = ORBIT.flags(id, d);
    if (!f.length) return '<p>No flags today — all vitals are within baseline.</p>';
    return f.map(function (x) {
      return '<div class="flag ' + x.level + '"><strong>' + esc(x.title) + '</strong> (z +' + x.z + ')<br><span class="muted">' + esc(x.detail) + '</span></div>';
    }).join('');
  }

  function planHtml(id, d) {
    return ORBIT.actionPlan(id, d).map(function (p, i) {
      return '<div class="card"><h3>' + (i + 1) + '. ' + esc(p.title) + '</h3><p>' + esc(p.detail) + '</p></div>';
    }).join('');
  }

  function selfCheck(id, d) {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(CHECK_KEY + id + '-' + d) || 'null'); } catch (e) {}
    var html = '<p class="muted">Rate today (1–5). Saved on this device and shown in the report.</p>' +
      '<label class="field"><span>Energy</span><input type="range" min="1" max="5" value="' + (saved ? saved.energy : 3) + '" id="sc-energy"></label>' +
      '<label class="field"><span>Mood</span><input type="range" min="1" max="5" value="' + (saved ? saved.mood : 3) + '" id="sc-mood"></label>' +
      '<label class="field"><span>Stress (5 = very stressed)</span><input type="range" min="1" max="5" value="' + (saved ? saved.stress : 3) + '" id="sc-stress"></label>' +
      '<button id="sc-save">Save self-check</button> <span id="sc-status" class="muted">' + (saved ? 'Saved for Day ' + d + '.' : '') + '</span>';
    return html;
  }
  function bindSelfCheck(id, d) {
    var btn = document.getElementById('sc-save');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var v = {
        energy: +document.getElementById('sc-energy').value,
        mood: +document.getElementById('sc-mood').value,
        stress: +document.getElementById('sc-stress').value, day: d
      };
      localStorage.setItem(CHECK_KEY + id + '-' + d, JSON.stringify(v));
      document.getElementById('sc-status').textContent = 'Saved — stored on this device.';
    });
  }

  function reportText(d) {
    var lines = ['ORBITSPACE — CREW HEALTH REPORT', 'Mission day ' + d + ' of 180 (simulated data)', 'Decision support only — not a medical device.', ''];
    ORBIT.crewStatus(d).forEach(function (c) {
      var s = c.scores; var r = ORBIT.getDay(c.id, d);
      lines.push(c.name + ' (' + c.role + ') — ' + c.level.toUpperCase() + ' — ' + c.overall + '/100');
      lines.push('  Heart ' + s.heart + ' · Bone & Muscle ' + s.bone + ' · Sleep & Mind ' + s.sleep + ' · Immune/Radiation ' + s.immune);
      lines.push('  HR ' + r.hr + ' bpm · HRV ' + r.hrv + ' ms · Sleep ' + r.sleep + ' h · SpO2 ' + r.spo2 + '% · Bone ' + r.bone + ' · Radiation ' + r.radiation + ' mSv');
      c.flags.forEach(function (f) { lines.push('  FLAG: ' + f.title + ' (z +' + f.z + ')'); });
      lines.push('  Plan: ' + ORBIT.actionPlan(c.id, d).map(function (p) { return p.title; }).join('; '));
      lines.push('');
    });
    return lines.join('\n');
  }
  function downloadReport(d) {
    var blob = new Blob([reportText(d)], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'orbitspace-crew-report-day-' + d + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function bindCrewSwitch() {
    document.querySelectorAll('[data-crew]').forEach(function (el) {
      el.addEventListener('click', function () { setWho(el.getAttribute('data-crew')); location.href = 'astronaut.html'; });
    });
    document.querySelectorAll('[data-who]').forEach(function (el) {
      el.addEventListener('click', function () { setWho(el.getAttribute('data-who')); });
    });
  }

  function renderAll() {
    var d = day();
    // Mission control bar (present on every page)
    var slider = document.getElementById('day-slider');
    if (slider) { slider.value = d; }
    var label = document.getElementById('day-label');
    if (label) label.textContent = 'Day ' + d + ' of 180';
    // Overview
    var crew = document.getElementById('crew-list');
    if (crew) crew.innerHTML = crewCardsHtml(d);
    var over = document.getElementById('overview-summary');
    if (over) {
      var worst = ORBIT.crewStatus(d)[0];
      over.innerHTML = '<p><strong>Worst-first today:</strong> ' + esc(worst.name) + ' — ' + worst.overall + '/100 ' + pill(worst.level) + '</p><p class="muted">Day 63 demo: jump to Day 63 to see Kenji flag Priority #1 in Watch, then Day 90 for his recovery. Amara dips during the Day 118–131 schedule shift.</p>';
    }
    // Astronaut page
    var det = document.getElementById('astronaut-detail');
    if (det) {
      var id = who();
      var c = ORBIT.crew.find(function (x) { return x.id === id; });
      var st = ORBIT.status(id, d);
      det.innerHTML = '<h2>' + esc(c.name) + ' — ' + esc(c.role) + ' ' + pill(st.level) + '</h2>' +
        '<p class="muted">Overall score ' + st.overall + '/100 on Day ' + d + '</p>' +
        scoreBar('Heart', st.scores.heart) + scoreBar('Bone & Muscle', st.scores.bone) +
        scoreBar('Sleep & Mind', st.scores.sleep) + scoreBar('Immune / Radiation', st.scores.immune) +
        '<h3>Vitals vs baseline</h3>' + vitalsTable(id, d) + '<h3>Flags</h3>' + flagsHtml(id, d);
      var whoEl = document.getElementById('astronaut-who');
      if (whoEl) whoEl.textContent = c.name;
    }
    // Trends page
    var tr = document.getElementById('trends-charts');
    if (tr) {
      var id2 = who();
      var days = ORBIT.days[id2];
      var c2 = ORBIT.crew.find(function (x) { return x.id === id2; });
      var tEl = document.getElementById('trends-who');
      if (tEl) tEl.textContent = c2.name;
      lineChart(document.getElementById('chart-hr'), [{ label: 'HR', values: days.map(function (r) { return r.hr; }), color: '#5ea0ff' }], { min: 50, max: 85, title: 'Resting heart rate (bpm)', band: [ORBIT.baselines[id2].hr.mean - ORBIT.baselines[id2].hr.sd * 2, ORBIT.baselines[id2].hr.mean + ORBIT.baselines[id2].hr.sd * 2] });
      lineChart(document.getElementById('chart-hrv'), [{ label: 'HRV', values: days.map(function (r) { return r.hrv; }), color: '#2fbf8f' }], { min: 35, max: 85, title: 'Heart-rate variability (ms)' });
      lineChart(document.getElementById('chart-sleep'), [{ label: 'Sleep', values: days.map(function (r) { return r.sleep; }), color: '#f5b301' }], { min: 5, max: 9, title: 'Sleep (hours)' });
      lineChart(document.getElementById('chart-bone'), [{ label: 'Bone', values: days.map(function (r) { return r.bone; }), color: '#ff8a8a' }], { min: 90, max: 102, title: 'Bone density index' });
    }
    // Action Plan page
    var pl = document.getElementById('plan-detail');
    if (pl) {
      var id3 = who();
      var c3 = ORBIT.crew.find(function (x) { return x.id === id3; });
      var pEl = document.getElementById('plan-who');
      if (pEl) pEl.textContent = c3.name;
      pl.innerHTML = '<h3>Flags — Day ' + d + '</h3>' + flagsHtml(id3, d) +
        '<h3>Today\u2019s action plan</h3><div class="grid">' + planHtml(id3, d) + '</div>' +
        '<h3>Crew self-check</h3><div class="card">' + selfCheck(id3, d) + '</div>' +
        '<p style="margin-top:14px"><button id="dl-report">Download crew report (.txt)</button></p>';
      bindSelfCheck(id3, d);
      var dl = document.getElementById('dl-report');
      if (dl) dl.addEventListener('click', function () { downloadReport(d); });
    }
    bindCrewSwitch();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var slider = document.getElementById('day-slider');
    if (slider) slider.addEventListener('input', function () { setDay(+slider.value); });
    var play = document.getElementById('play-btn');
    if (play) play.addEventListener('click', function () { togglePlay(play); });
    document.querySelectorAll('[data-jump]').forEach(function (b) {
      b.addEventListener('click', function () { setDay(+b.getAttribute('data-jump')); });
    });
    renderAll();
  });

  window.OrbitApp = { day: day, setDay: setDay, who: who, setWho: setWho, downloadReport: downloadReport };
})();
