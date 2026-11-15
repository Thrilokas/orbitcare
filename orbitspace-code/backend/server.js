// Orbitspace backend — Node API backed by Supabase (Postgres).
// Storage is Supabase ONLY. There is no in-memory store and no JSON-file
// database here: every read/write below goes through the Supabase client.
// If SUPABASE_URL / keys are missing, the API returns a 503 explaining
// the setup instead of silently falling back to local data.
//
// Setup (see README): create a free Supabase project, run
//   backend/supabase/schema.sql  in the SQL Editor,
// copy backend/.env.example to backend/.env and fill in the keys,
// then seed:  cd backend && npm install && npm run seed
//
// Run:  npm start   (port 3000, or PORT env var)
// Endpoints: GET /api/health, POST /api/seed,
//   GET /api/crew-status?day=63, GET /api/astronaut/:id?day=63,
//   GET /api/trends/:id, GET /api/report?day=63, POST /api/self-check
'use strict';
const http = require('http');
const { getSupabase, isConfigured } = require('./lib/supabase');
const sim = require('./lib/simulation');
const { generateSeedData, astronautStatus, crewReport, CREW } = sim;

const PORT = process.env.PORT || 3000;
const clampDay = (v) => Math.max(1, Math.min(180, parseInt(v, 10) || 1));

function send(res, status, body, type = 'application/json') {
  const data = type === 'application/json' ? JSON.stringify(body) : body;
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  res.end(data);
}
function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}
function notConfigured(res) {
  return send(res, 503, {
    error: 'Supabase is not configured',
    setup: 'Create a free Supabase project, run backend/supabase/schema.sql, copy backend/.env.example to backend/.env, fill in SUPABASE_URL and keys, then run: cd backend && npm run seed',
  });
}
async function mustHaveClient(res, write) {
  if (!isConfigured()) { notConfigured(res); return null; }
  try { return getSupabase({ write }); } catch (e) { send(res, 503, { error: e.message }); return null; }
}

// Fetch everything needed to score one day: crew, baselines, readings for
// day-1..day+1 (3-day smoothing), and the latest self-check per astronaut.
async function loadDay(supabase, day) {
  const [crewRes, baseRes, readRes, checkRes] = await Promise.all([
    supabase.from('crew').select('*').order('id'),
    supabase.from('baselines').select('*'),
    supabase.from('daily_readings').select('*').gte('day', day - 1).lte('day', day + 1).order('astronaut_id').order('day').range(0, 999),
    supabase.from('self_checks').select('*').eq('day', day).order('created_at', { ascending: false }),
  ]);
  for (const r of [crewRes, baseRes, readRes, checkRes]) {
    if (r.error) throw new Error(r.error.message);
  }
  const baselines = new Map(baseRes.data.map((b) => [b.astronaut_id, b]));
  const byAstronaut = new Map();
  for (const row of readRes.data) {
    if (!byAstronaut.has(row.astronaut_id)) byAstronaut.set(row.astronaut_id, new Map());
    byAstronaut.get(row.astronaut_id).set(row.day, row);
  }
  const latestCheck = new Map();
  for (const c of checkRes.data) if (!latestCheck.has(c.astronaut_id)) latestCheck.set(c.astronaut_id, c);
  return { crew: crewRes.data, baselines, byAstronaut, latestCheck };
}

function statusesForDay(loaded, day) {
  return loaded.crew
    .map((c) => astronautStatus(c, loaded.byAstronaut.get(c.id) || new Map(), loaded.baselines.get(c.id), day, loaded.latestCheck.get(c.id) || null))
    .filter(Boolean)
    .sort((a, b) => a.scores.overall - b.scores.overall); // worst-first
}

async function seedSupabase(supabase) {
  const { crew, baselines, dailyReadings } = generateSeedData();
  const { error: crewErr } = await supabase.from('crew').upsert(crew, { onConflict: 'id' });
  if (crewErr) throw new Error(`seed crew: ${crewErr.message}`);
  const { error: baseErr } = await supabase.from('baselines').upsert(baselines, { onConflict: 'astronaut_id' });
  if (baseErr) throw new Error(`seed baselines: ${baseErr.message}`);
  const { error: delErr } = await supabase.from('daily_readings').delete().neq('day', 0);
  if (delErr) throw new Error(`seed clear daily_readings: ${delErr.message}`);
  for (let i = 0; i < dailyReadings.length; i += 100) {
    const { error } = await supabase.from('daily_readings').insert(dailyReadings.slice(i, i + 100));
    if (error) throw new Error(`seed daily_readings: ${error.message}`);
  }
  return { crew: crew.length, baselines: baselines.length, dailyReadings: dailyReadings.length };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const day = clampDay(url.searchParams.get('day') || '1');

    if (req.method === 'GET' && url.pathname === '/api/health') {
      if (!isConfigured()) return notConfigured(res);
      const supabase = getSupabase();
      const { count, error } = await supabase.from('daily_readings').select('*', { count: 'exact', head: true });
      if (error) return send(res, 500, { ok: false, error: error.message });
      return send(res, 200, { ok: true, storage: 'supabase', dailyReadings: count || 0, seeded: (count || 0) >= 540 });
    }

    if (req.method === 'POST' && url.pathname === '/api/seed') {
      const supabase = await mustHaveClient(res, true);
      if (!supabase) return;
      const counts = await seedSupabase(supabase);
      return send(res, 200, { ok: true, storage: 'supabase', ...counts });
    }

    if (req.method === 'GET' && url.pathname === '/api/crew-status') {
      const supabase = await mustHaveClient(res);
      if (!supabase) return;
      const loaded = await loadDay(supabase, day);
      return send(res, 200, { day, crew: statusesForDay(loaded, day) });
    }

    const astro = url.pathname.match(/^\/api\/astronaut\/([a-z]+)$/);
    if (req.method === 'GET' && astro) {
      const supabase = await mustHaveClient(res);
      if (!supabase) return;
      const loaded = await loadDay(supabase, day);
      const one = statusesForDay(loaded, day).find((s) => s.id === astro[1]);
      if (!one) return send(res, 404, { error: 'unknown astronaut or no data — run POST /api/seed first' });
      return send(res, 200, one);
    }

    const trends = url.pathname.match(/^\/api\/trends\/([a-z]+)$/);
    if (req.method === 'GET' && trends) {
      const supabase = await mustHaveClient(res);
      if (!supabase) return;
      const [rows, base] = await Promise.all([
        supabase.from('daily_readings').select('*').eq('astronaut_id', trends[1]).order('day').range(0, 999),
        supabase.from('baselines').select('*').eq('astronaut_id', trends[1]).single(),
      ]);
      if (rows.error) throw new Error(rows.error.message);
      if (!rows.data.length) return send(res, 404, { error: 'unknown astronaut or no data — run POST /api/seed first' });
      return send(res, 200, { astronautId: trends[1], days: rows.data, baselines: base.data || null });
    }

    if (req.method === 'GET' && url.pathname === '/api/report') {
      const supabase = await mustHaveClient(res);
      if (!supabase) return;
      const loaded = await loadDay(supabase, day);
      return send(res, 200, crewReport(day, statusesForDay(loaded, day)), 'text/plain');
    }

    if (req.method === 'POST' && url.pathname === '/api/self-check') {
      const supabase = await mustHaveClient(res, true);
      if (!supabase) return;
      const b = await readBody(req);
      if (!b.astronautId || !CREW.some((c) => c.id === b.astronautId)) {
        return send(res, 400, { error: 'astronautId required (kenji | amara | elena)' });
      }
      const entry = {
        astronaut_id: b.astronautId, day: clampDay(b.day || day),
        energy: Math.max(1, Math.min(5, +b.energy || 3)),
        mood: Math.max(1, Math.min(5, +b.mood || 3)),
        stress: Math.max(1, Math.min(5, +b.stress || 3)),
      };
      const { data, error } = await supabase.from('self_checks').insert(entry).select().single();
      if (error) throw new Error(error.message);
      return send(res, 200, { ok: true, storage: 'supabase', ...data });
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Orbitspace backend (Supabase) listening on http://localhost:${PORT}`));
}
module.exports = server;
// Exported for the tests (backend/tests/crew-view.test.js, M1):
// statusesForDay is the worst-first sort, clampDay is the day clamp.
// Nothing else in this file reads them.
module.exports.statusesForDay = statusesForDay;
module.exports.clampDay = clampDay;
