// Orbitspace — Supabase client factory.
// Reads SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
// from the environment, or from backend/.env / backend/.env.local
// (or the project-root .env.local). Never put real keys in source control:
// copy backend/.env.example to backend/.env and fill it in locally, and
// set the same vars in Vercel (Project Settings → Environment Variables).
'use strict';
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile(file) {
  try {
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (e) { /* env file is optional */ }
}

loadEnvFile(path.join(__dirname, '..', '.env'));
loadEnvFile(path.join(__dirname, '..', '.env.local'));
loadEnvFile(path.join(__dirname, '..', '..', '.env.local'));

function config() {
  return {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.url && (c.anonKey || c.serviceKey));
}

// Writes (seed, self-check) use the service-role key when set, so they
// are not blocked by row-level security. Reads use the anon key.
// The service-role key must NEVER be shipped to the browser.
function getSupabase({ write = false } = {}) {
  const c = config();
  if (!c.url) throw new Error('SUPABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in (see README).');
  const key = write && c.serviceKey ? c.serviceKey : c.anonKey || c.serviceKey;
  if (!key) throw new Error('No Supabase key set. Set SUPABASE_ANON_KEY (reads) and SUPABASE_SERVICE_ROLE_KEY (seed/writes) in backend/.env.');
  return createClient(c.url, key, { auth: { persistSession: false } });
}

module.exports = { getSupabase, isConfigured, config };
