// Orbitspace — seed Supabase with the simulated mission.
// Usage:  cd backend && npm install && cp .env.example .env  (fill it in) && npm run seed
// Inserts 3 crew, 3 baselines, 540 daily readings (3 crew x 180 days).
// Safe to re-run: it upserts crew/baselines and replaces daily readings.
'use strict';
const { getSupabase } = require('./lib/supabase');
const { generateSeedData } = require('./lib/simulation');

async function chunkInsert(supabase, table, rows, size = 100) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: table === 'daily_readings' ? 'astronaut_id,day' : 'id' });
    if (error) throw new Error(`seed ${table} rows ${i}-${i + chunk.length}: ${error.message}`);
  }
}

async function main() {
  const supabase = getSupabase({ write: true });
  const { crew, baselines, dailyReadings } = generateSeedData();

  // Baselines conflict on astronaut_id, not id — upsert them separately.
  const { error: crewErr } = await supabase.from('crew').upsert(crew, { onConflict: 'id' });
  if (crewErr) throw new Error(`seed crew: ${crewErr.message}`);
  const { error: baseErr } = await supabase.from('baselines').upsert(baselines, { onConflict: 'astronaut_id' });
  if (baseErr) throw new Error(`seed baselines: ${baseErr.message}`);

  // Replace readings so a re-seed never duplicates the 540 rows.
  const { error: delErr } = await supabase.from('daily_readings').delete().neq('day', 0);
  if (delErr) throw new Error(`seed clear daily_readings: ${delErr.message}`);
  await chunkInsert(supabase, 'daily_readings', dailyReadings);

  console.log(`Seeded Supabase: ${crew.length} crew, ${baselines.length} baselines, ${dailyReadings.length} daily readings.`);
}

if (require.main === module) {
  main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
}
module.exports = { main };
