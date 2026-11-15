# OrbitCare — API Specification (API.md)

**Version:** 1.0 — 15 Nov 2026
**Sources of truth:** `PRD.md` v1.0, `ARCHITECTURE.md` v1.0, `DATABASE.md` v1.0 (all 15 Nov 2026). If this file conflicts with any of them, PRD wins on what an endpoint does, DATABASE wins on what it reads/writes, ARCHITECTURE wins on how it is served.
**Product:** OrbitCare (working build name: Orbitspace) — offline-first astronaut health dashboard, 180-day simulated mission, 3 crew, personal-baseline anomaly detection, decision support only. Simulated data only. Not a medical device.
**Stack for these endpoints:** Next.js 14 API Routes (ARCHITECTURE §1) on Vercel, backed by Supabase (Postgres). The same paths work against the plain-HTML `orbitspace-code/` Node backend — the route shape is the contract, not the framework.
**Rule:** Follow REST conventions. Every endpoint must map to a feature in PRD.md and a table in DATABASE.md — anything that does not is **flagged ⚠️** in §2 and in its own section. Do not add an endpoint without adding its PRD + table mapping here first.

---

## 1. Base URL, versioning and global rules

### 1.1 Base URL
- Production: `https://<your-vercel-app>.vercel.app/api/v1`
- Local: `http://localhost:3000/api/v1`
- All paths in this file are relative to `/api/v1`, e.g. `GET /crew` means `GET /api/v1/crew`.

### 1.2 API versioning rules
1. **Version in the URL, always.** `/api/v1/…`. Never version with a header, a query param, or a body field.
2. **v1 is the only version in the MVP.** Do not create v2 until a breaking change is unavoidable.
3. **Breaking change = new major version.** Changing a field name, removing a field, changing a status code, changing a required field to optional (or the reverse), or changing the error format is breaking → `/api/v2/…`.
4. **Non-breaking changes stay in v1:** adding a new endpoint, adding a new optional query param, adding a new field to a response (clients must ignore unknown fields), adding a new `status` value (clients must handle unknown values as "unknown", never crash).
5. **Old versions live for one release after the new version ships**, then return `410 Gone` with the standard error format (§4) and a `message` pointing at the new version. No version is ever deleted without a `410` first.
6. **Every response carries `X-API-Version: v1`.** Every error response also carries it.
7. **Changelog:** any change to this file is a new version line at the top (`Version: 1.1 — <date> — <what changed>`). Do not edit v1.0 in place after it ships.

### 1.3 Global request / response rules (REST)
- **Methods mean what REST says:** `GET` = read (safe, idempotent), `POST` = create, `PATCH` = partial update, `DELETE` = soft delete (see §1.4). No `PUT` in this API — a full replace is never needed for these resources. No `GET` with a body. No action verbs in URLs (`/crew/kenji/acknowledge` is forbidden — use `PATCH /flags/{id}` with `{"is_acknowledged": true}`).
- **Resources are plural nouns, `kebab-case`:** `/crew-members`, `/daily-readings`, `/domain-scores`, `/self-checks`, `/action-plan-items`, `/sync-log`. IDs in the path are the stable slug where one exists (`kenji`, `amara`, `elena`) or a UUID otherwise — see each endpoint.
- **JSON only.** Request and response bodies are `application/json`, except `GET /reports/{id}/download`, which returns `application/pdf` (§9.3).
- **IDs:** `id` is a UUID in responses. In request paths, crew is addressed by `slug` (`kenji`), everything else by UUID. A client that sends a UUID where a slug is expected gets `400 VALIDATION_ERROR`.
- **Dates/times:** `timestamptz` as ISO 8601 UTC, e.g. `2026-11-15T04:15:00.000Z`. Mission time is **not** a wall-clock date — it is `mission_day` (integer 1–180). Never send a calendar date where a mission day belongs.
- **Numbers:** scores are integers 0–100; z-scores are numbers with 2 decimal places; vitals keep the units in DATABASE.md (`resting_heart_rate_bpm`, `sleep_hours`, …). Never send a bare number without its unit in the field name.
- **Trailing slash:** `/crew` and `/crew/` are the same. The server normalises to no trailing slash.

### 1.4 Soft delete
- `DELETE` never hard-deletes. It sets `deleted_at` (DATABASE §1.3) and returns `200` with the resource and `deleted_at` set. A second `DELETE` on the same resource returns `404 NOT_FOUND`.
- Soft delete applies only to: `self_checks`, `action_plan_items`, `reports`. No `DELETE` endpoint exists for `daily_readings`, `domain_scores`, `flags`, `baselines`, `crew_members`, or `missions` in the MVP — history is immutable (DATABASE §1.3). A client that calls `DELETE` on one of those gets `405 METHOD_NOT_ALLOWED`.
- List endpoints never return soft-deleted rows. A single-item `GET` on a soft-deleted row returns `404 NOT_FOUND`.

### 1.5 Offline-first note (read before building a client)
Most reads in this API are also served from the on-device cache (ARCHITECTURE §3.2). The API is the **sync** path, not the only path. A client must render from cache first, call the API in the background, and never block the UI on a failed API call. A `503 SERVICE_UNAVAILABLE` or a timeout is a normal offline state, not a crash — see §4.4.

---

## 2. Endpoint index — every endpoint, its PRD feature and its table

**⚠️ = flagged: does not map cleanly to a PRD feature or a DATABASE table.** See §11 for the full flag list. Every other endpoint maps to both.

| # | Method + URL | Purpose | PRD | Table(s) |
|---|---|---|---|---|
| 1 | `GET /health` ⚠️ | Liveness check | — (infrastructure) | — (no table) |
| 2 | `GET /missions` | List missions | M10 (simulated mission) | `missions` |
| 3 | `GET /missions/{mission_id}` | Get one mission | M10 | `missions` |
| 4 | `GET /crew-members` | List crew, worst-first | M1 | `crew_members`, `domain_scores` |
| 5 | `GET /crew-members/{slug}` | Get one astronaut (dashboard) | M2 | `crew_members`, `daily_readings`, `domain_scores`, `flags` |
| 6 | `GET /crew-members/{slug}/baselines` | Get one astronaut's baselines | M3 | `baselines`, `indicators` |
| 7 | `GET /crew-members/{slug}/readings` | List daily readings (range) | M2, M6 | `daily_readings` |
| 8 | `GET /crew-members/{slug}/readings/{mission_day}` | Get one day's reading | M2 | `daily_readings` |
| 9 | `GET /crew-members/{slug}/domain-scores` | List domain scores (range) | M4 | `domain_scores`, `domains` |
| 10 | `GET /crew-members/{slug}/domain-scores/{mission_day}` | Get 4 scores for one day | M4 | `domain_scores` |
| 11 | `GET /crew-members/{slug}/flags` | List flags for one astronaut | M5 | `flags`, `action_plan_items` |
| 12 | `GET /flags/{flag_id}` | Get one flag | M5 | `flags`, `action_plan_items` |
| 13 | `PATCH /flags/{flag_id}` | Acknowledge a flag | M5 | `flags` |
| 14 | `GET /crew-members/{slug}/action-plan` | Get action plan for a day | M5 | `flags`, `action_plan_items` |
| 15 | `PATCH /action-plan-items/{item_id}` | Check off one action item | M5 | `action_plan_items` |
| 16 | `GET /crew-members/{slug}/self-checks` | List self-checks | M7 | `self_checks` |
| 17 | `POST /crew-members/{slug}/self-checks` | Create a self-check | M7 | `self_checks` |
| 18 | `GET /crew-members/{slug}/self-checks/{mission_day}` | Get one day's self-check | M7 | `self_checks` |
| 19 | `PATCH /crew-members/{slug}/self-checks/{mission_day}` | Edit a self-check | M7 | `self_checks` |
| 20 | `DELETE /crew-members/{slug}/self-checks/{mission_day}` | Withdraw a self-check | M7 | `self_checks` |
| 21 | `GET /trends` ⚠️ | Trend series + normal band (derived) | M6 | — (derived from `daily_readings` + `baselines`, no own table) |
| 22 | `GET /reports` | List generated reports | M8 | `reports` |
| 23 | `POST /reports` | Create (register) a report | M8 | `reports` |
| 24 | `GET /reports/{report_id}` | Get report metadata | M8 | `reports` |
| 25 | `GET /reports/{report_id}/download` | Download the PDF | M8, Flow 4 | `reports` (metadata only; the file is built on-device) |
| 26 | `DELETE /reports/{report_id}` | Soft-delete a report record | M8 | `reports` |
| 27 | `GET /sync/status` | LIVE / STALE / OFFLINE + last sync | M9 | `sync_log` |
| 28 | `POST /sync` | Sync queued items to Earth | M9, V2 handover log | `sync_log`, `self_checks` |
| 29 | `GET /sync-log` | List sync history | V2 (handover log) | `sync_log` |
| 30 | `GET /emergency` | List emergency situations (V2) | V2 Emergency Guide | `emergency_guide_steps` |
| 31 | `GET /emergency/{situation_slug}` | Get steps for one situation (V2) | V2 Emergency Guide | `emergency_guide_steps` |
| 32 | `GET /indicators` | List indicators | M3 (reference) | `indicators` |
| 33 | `GET /domains` | List domains | M4 (reference) | `domains` |
| 34 | `POST /admin/scoring/recompute` ⚠️ | Recompute scores + flags (admin/seed only) | — (no PRD feature; supports M3/M4) | `domain_scores`, `flags` |

Total: **34 endpoints** — 29 MVP, 3 V2 (`/emergency` ×2, `/sync-log`), 2 flagged infrastructure/admin (`/health`, `/admin/scoring/recompute`), 1 flagged derived (`/trends`).

---

## 3. Authentication and authorisation

### 3.1 MVP (what ships for the hackathon)
**Auth required: No — for reads. Yes, anon key, for the one write.**

There is no auth in the MVP (ARCHITECTURE §1.2, decision 5; DATABASE §7). The demo crew is fixed and all data is simulated.

| Caller | What they send | What they can do |
|---|---|---|
| Browser / app (anon) | `apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>` (see §3.3) | `GET` everything (simulated data only). `POST` one self-check. Nothing else. |
| Server / seed script | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` + `apikey` | Everything, including seed and recompute. **Never sent from a browser.** |

- No login, no user account, no role in the MVP. A request without an `apikey` header gets `401 UNAUTHENTICATED`.
- The anon key is **public by design** (Supabase). It is not a secret. Row-Level Security (DATABASE §7) is what stops the browser from writing to readings/scores/flags — not the absence of a key.
- **V2 roles (defined now, enforced later — do not implement in the MVP):**

| Role | Can read | Can write |
|---|---|---|
| `astronaut` | Own crew's rows only | Own `self_checks` only |
| `medical_officer` (Amara / Commander) | All crew in their mission | `flags.is_acknowledged`, `action_plan_items.is_done` |
| `flight_surgeon` (Dr. Rao, Earth) | Only `sync_status = 'synced'` rows, in assigned missions | Nothing |
| `service_role` | Everything | Everything (seed, recompute) |

When auth ships, the header becomes `Authorization: Bearer <supabase_jwt>` and the `apikey` header stays. A request with a valid key but the wrong role gets `403 FORBIDDEN` (not `401`).

### 3.2 Roles in this document
Each endpoint below says **Auth** in one of these forms:
- `No — anon key only` — any browser with the anon key.
- `No — anon key only (write: self-check only)` — the one MVP write.
- `Yes — service_role only` — server/seed only, never the browser.
- `V2 — <role>` — defined for a future version; in v1 it behaves as `No — anon key only` and is labelled as such.

### 3.3 Request headers (every endpoint)
| Header | Required | Value / notes |
|---|---|---|
| `Content-Type` | Yes on POST/PATCH | `application/json` |
| `Accept` | No | `application/json` (default). `application/pdf` only for §9.3. |
| `apikey` | Yes | Supabase anon key (MVP) or the same key + JWT in V2. |
| `Authorization` | Only for service_role / V2 | `Bearer <key-or-jwt>`. Never send the service-role key from a browser. |
| `X-Request-Id` | No | Client-generated UUID, echoed back in every response and in every error (`request_id`). Send it — it is how a bug is traced. |
| `Idempotency-Key` | Yes on `POST /self-checks` and `POST /reports` | Client-generated UUID. Retrying the same key returns the original response, not a duplicate row. See §7.3. |

### 3.4 Common response headers (every endpoint)
`Content-Type: application/json`, `X-API-Version: v1`, `X-Request-Id: <echo>`, and on list endpoints the pagination headers in §5.1. On `429` responses: `Retry-After: <seconds>`.

---

## 4. Standard formats — success, error, pagination

### 4.1 Success envelope (every JSON response)
```json
{
  "data": { },
  "meta": {
    "api_version": "v1",
    "request_id": "req_9f2c1a7b-4d1e-4a3f-9c2b-1a2b3c4d5e6f",
    "generated_at": "2026-11-15T04:15:00.000Z",
    "is_simulated": true,
    "disclaimer": "Simulated data only. Decision support only. Not a medical device."
  }
}
```
- `data` is an object for a single resource, an array for a list, or `null` for a delete that returns no body (this API returns the deleted resource instead — see §1.4 — so `data` is never `null` on success except `POST /sync` when nothing was queued).
- `meta.is_simulated` is always `true` in the MVP. `meta.disclaimer` is on **every** response, including errors.
- List responses add `meta.pagination` (see §5.1) inside `meta`, not at the top level.

### 4.2 Standard error format — used everywhere, no exceptions
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Sleep is required — pick a value to save.",
    "details": [
      { "field": "sleep_hours", "issue": "required", "message": "sleep_hours is required." }
    ],
    "request_id": "req_9f2c1a7b-4d1e-4a3f-9c2b-1a2b3c4d5e6f",
    "documentation": "https://<your-app>/docs/api#error-VALIDATION_ERROR"
  },
  "meta": {
    "api_version": "v1",
    "request_id": "req_9f2c1a7b-4d1e-4a3f-9c2b-1a2b3c4d5e6f",
    "generated_at": "2026-11-15T04:15:00.000Z",
    "is_simulated": true,
    "disclaimer": "Simulated data only. Decision support only. Not a medical device."
  }
}
```
Rules: `error.code` is a stable `SCREAMING_SNAKE_CASE` string (never a number, never a raw Postgres / Supabase message). `error.message` is plain language: what happened + what to do next. `error.details` is an array (empty `[]` when there is no field-level detail). No stack trace, no SQL, no secret, no health value beyond the one the client just sent, in any error response.

### 4.3 Error codes (the complete list)
| HTTP | `code` | When | `retryable` in `details`? |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad / missing field, bad enum, `mission_day` out of 1–180, `per_page` > 100, unknown query param value | No |
| 400 | `INVALID_JSON` | Body is not valid JSON, or `Content-Type` is not `application/json` | No |
| 401 | `UNAUTHENTICATED` | Missing / invalid `apikey` or `Authorization` | No |
| 403 | `FORBIDDEN` | Valid auth, wrong role (V2) or RLS denies the write (e.g. browser tries to write a reading) | No |
| 404 | `NOT_FOUND` | Unknown crew slug, unknown UUID, unknown mission day with no data, soft-deleted row | No |
| 405 | `METHOD_NOT_ALLOWED` | e.g. `DELETE` on `daily_readings` (history is immutable) | No |
| 409 | `CONFLICT` | A self-check already exists for that crew-day (unique constraint), or an `Idempotency-Key` was reused with a different body | No — use `PATCH` to edit, or a new key |
| 410 | `GONE` | An old API version after its sunset (see §1.2 rule 5) | No |
| 422 | `UNPROCESSABLE` | Body is valid JSON but semantically impossible, e.g. `baseline_end_day <= baseline_start_day` (admin only) | No |
| 429 | `RATE_LIMITED` | Rate limit hit (see §5.4). Response carries `Retry-After`. | Yes — after `Retry-After` seconds |
| 500 | `SERVER_ERROR` | Unexpected server error. `message` is always "Something went wrong. Your saved data is safe — try again." | Yes |
| 503 | `SERVICE_UNAVAILABLE` | Supabase unreachable / timeout after 5s. The client must fall back to its offline cache (ARCHITECTURE §5). | Yes |

**Every endpoint below lists its applicable errors from this table.** An endpoint never returns an error code that is not in this table, and never returns a raw database error.

### 4.4 Offline behaviour
A `503` or a network timeout is not an error to show as a red banner. The client shows the cached data + the STALE/OFFLINE chip (DESIGN §6) and retries in the background. `GET /sync/status` (§10.1) is the only endpoint whose job is to report that state.

---

## 5. Pagination, filtering, sorting, rate limits

### 5.1 Pagination (list endpoints only)
- Query params: `page` (integer, ≥ 1, default `1`), `per_page` (integer, 1–100, default `20`).
- Response `meta.pagination`:
```json
{ "page": 1, "per_page": 20, "total_items": 180, "total_pages": 9, "has_next": true, "has_prev": false }
```
- Response headers: `X-Total-Count: 180`, `Link: <…?page=2>; rel="next"` (only when `has_next`).
- **Exceptions (no pagination):** `GET /crew-members` (3 rows), `GET /crew-members/{slug}/baselines` (14 rows), `GET /indicators`, `GET /domains` (small reference lists — return all rows, `total_items` = row count), and `GET /trends` (range-based, see §8.1 — use `from_day`/`to_day`, not pages).
- `page` beyond `total_pages` returns `200` with `data: []`, not `404`.

### 5.2 Filtering
- Common filters, per endpoint (see each endpoint): `status` (`nominal`/`watch`/`alert`), `domain` (slug), `mission_day`, `from_day` + `to_day` (inclusive range), `is_acknowledged` (`true`/`false`), `sync_status` (`pending`/`synced`/`failed`).
- Unknown filter names are ignored; unknown filter *values* return `400 VALIDATION_ERROR` with the field named in `details`.
- Filters combine with AND. There is no OR filter in v1.

### 5.3 Sorting
- Query params: `sort_by` + `sort_dir` (`asc`/`desc`, default per endpoint — see each endpoint).
- Allowed `sort_by` values are listed per endpoint. Anything else returns `400 VALIDATION_ERROR`.
- Default sorts: Crew View = worst-first (`status` Alert → Watch → Nominal, then lowest score); flags = `priority` asc; readings/scores = `mission_day` asc; self-checks = `mission_day` desc; sync-log = `created_at` desc.
- Sorting is stable: a tie is broken by `id` asc, so the same query always returns the same order.

### 5.4 Rate limits
| Caller | Limit | Window |
|---|---|---|
| Anon key (browser) | 60 requests | per minute, per key + IP |
| Authenticated (V2) | 300 requests | per minute, per user |
| Service role | 1,000 requests | per minute |

- Exceeding the limit returns `429 RATE_LIMITED` with `Retry-After: <seconds>` and the standard error format. The limit is per key, not per endpoint — a client that polls the slider on every pixel will hit it; debounce slider calls to 200 ms (ARCHITECTURE §8).
- `GET /health` is exempt from rate limiting.

---

## 6. Endpoints by resource

*For every endpoint: **Purpose** is one line; **Auth** is from §3.2; **Request headers** are §3.3 unless stated; **Request body** is shown only for POST/PATCH (GETs have no body); **Success** shows the status code and the `data` shape; **Errors** list every applicable status + `code` from §4.3. `meta` (§4.1) is on every response and is not repeated in each example.*

### 6.1 Meta — ⚠️ flagged

#### `GET /health`
- **Purpose:** Liveness check — is the API up?
- **PRD:** — (no feature; infrastructure only, flagged §11)
- **Table:** — (no table; flagged §11)
- **Auth:** No — no key required. Exempt from rate limiting.
- **Request headers:** None.
- **Request body:** None.
- **Success — `200 OK`:**
```json
{ "data": { "status": "ok", "service": "orbitcare-api", "api_version": "v1", "database": "connected" } }
```
- **Errors:** `503 SERVICE_UNAVAILABLE` — database unreachable (`"database": "unreachable"` in `data` is not returned on a 503; the error body is the standard format).

---

### 6.2 Missions — PRD M10, table `missions`

#### `GET /missions`
- **Purpose:** List missions (MVP: exactly one).
- **Auth:** No — anon key only.
- **Query:** `page`, `per_page` (§5.1). No filters in v1.
- **Success — `200 OK`:**
```json
{ "data": [{ "id": "a1b2c3d4-…", "name": "Mars Transit 2026", "code": "MARS-2026", "mission_length_days": 180, "baseline_days": 21, "start_date": null, "is_simulated": true, "status": "active", "created_at": "2026-11-14T09:00:00.000Z", "updated_at": "2026-11-14T09:00:00.000Z" }] }
```
- **Errors:** `401 UNAUTHENTICATED`, `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `GET /missions/{mission_id}`
- **Purpose:** Get one mission.
- **Auth:** No — anon key only.
- **Success — `200 OK`:** Same object as above.
- **Errors:** `400 VALIDATION_ERROR` (bad UUID), `401 UNAUTHENTICATED`, `404 NOT_FOUND`, `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

---

### 6.3 Crew — PRD M1 + M2, tables `crew_members`, `domain_scores`, `daily_readings`, `flags`

#### `GET /crew-members`
- **Purpose:** Crew View — all crew, worst-first, for a mission day.
- **Auth:** No — anon key only.
- **Query:** `mission_day` (integer 1–180, default: latest day with data), `mission_id` (UUID, optional — default is the active mission), `status` (filter: `nominal`/`watch`/`alert`).
- **Sorting:** worst-first always (Alert → Watch → Nominal, then lowest overall score, then name). `sort_by` is not accepted on this endpoint — sending it returns `400 VALIDATION_ERROR`.
- **Success — `200 OK`:**
```json
{ "data": [
  { "id": "…", "slug": "kenji", "display_name": "Kenji", "role": "Mission Specialist", "avatar_initial": "K", "avatar_colour": "#2E7FFF", "is_medical_officer": false, "mission_day": 63, "overall_score": 78, "overall_status": "watch", "domain_scores": [ { "domain": "sleep_mind", "score": 78, "status": "watch" } ], "flag_count": 3 }
] }
```
- **Errors:** `400 VALIDATION_ERROR` (`mission_day` out of range, bad `status`), `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown `mission_id`), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `GET /crew-members/{slug}`
- **Purpose:** Astronaut Dashboard — one astronaut, one day: vitals vs baseline, 4 domain scores, active flags.
- **Auth:** No — anon key only.
- **Query:** `mission_day` (integer 1–180, default: latest day).
- **Success — `200 OK`:**
```json
{ "data": {
  "crew": { "id": "…", "slug": "kenji", "display_name": "Kenji", "role": "Mission Specialist", "avatar_initial": "K", "avatar_colour": "#2E7FFF", "is_medical_officer": false },
  "mission_day": 63,
  "overall_score": 78, "overall_status": "watch",
  "domain_scores": [ { "domain": "heart", "display_name": "Heart", "score": 84, "status": "watch", "reason": "Resting heart rate above your baseline for 3 days." } ],
  "vitals": [ { "indicator": "resting_heart_rate", "display_name": "Resting heart rate", "unit": "bpm", "current_value": 74, "baseline_mean": 62.0, "z_score": 1.85, "direction_worse": "higher" } ],
  "flags": [ { "id": "…", "title": "Resting heart rate elevated", "status": "watch", "priority": 1 } ]
} }
```
- **Errors:** `400 VALIDATION_ERROR` (`mission_day` out of range), `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown slug, or no data for that day), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

---

### 6.4 Baselines — PRD M3, tables `baselines`, `indicators`

#### `GET /crew-members/{slug}/baselines`
- **Purpose:** One astronaut's personal baselines (mean + SD, Days 1–21) for every indicator.
- **Auth:** No — anon key only.
- **Query:** `indicator` (slug, optional — filter to one indicator).
- **Success — `200 OK`:**
```json
{ "data": [ { "indicator": "sleep_hours", "display_name": "Sleep", "unit": "h", "baseline_start_day": 1, "baseline_end_day": 21, "mean_value": 7.40, "std_dev": 0.45, "sample_count": 21, "direction_worse": "lower" } ] }
```
- **Errors:** `400 VALIDATION_ERROR` (unknown `indicator`), `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown slug), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

---

### 6.5 Daily readings — PRD M2 + M6, table `daily_readings`

#### `GET /crew-members/{slug}/readings`
- **Purpose:** List daily readings for one astronaut over a range (feeds Trends and the vitals table).
- **Auth:** No — anon key only.
- **Query:** `from_day` + `to_day` (integers 1–180, default: `1`–`180`; max range 180 days), `page`, `per_page` (§5.1), `sort_by` (`mission_day`), `sort_dir` (default `asc`).
- **Success — `200 OK`:**
```json
{ "data": [ { "crew_slug": "kenji", "mission_day": 63, "resting_heart_rate_bpm": 74, "heart_rate_variability_ms": 52, "systolic_bp_mmhg": 122, "diastolic_bp_mmhg": 78, "sleep_hours": 5.2, "exercise_minutes": 20, "body_weight_kg": 77.1, "grip_strength_kg": 46.0, "body_temperature_c": 37.40, "illness_symptoms": 2, "mood_score": 2, "stress_score": 4, "reaction_time_ms": 290, "radiation_dose_msv": 0.410, "cumulative_radiation_dose_msv": 25.310, "data_quality": "good", "source": "simulated", "is_simulated": true } ] }
```
- **Errors:** `400 VALIDATION_ERROR` (`from_day` > `to_day`, day out of range, bad `sort_by`), `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown slug), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `GET /crew-members/{slug}/readings/{mission_day}`
- **Purpose:** One day's reading for one astronaut.
- **Auth:** No — anon key only.
- **Success — `200 OK`:** Same object as above, single object (not an array).
- **Errors:** `400 VALIDATION_ERROR` (day out of range), `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown slug, or no reading that day — a `missing` day returns `404`, not an empty object), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

---

### 6.6 Domain scores — PRD M4, tables `domain_scores`, `domains`

#### `GET /crew-members/{slug}/domain-scores`
- **Purpose:** List domain scores for one astronaut over a range.
- **Auth:** No — anon key only.
- **Query:** `from_day`, `to_day` (default `1`–`180`), `domain` (slug filter: `heart`/`bone_muscle`/`sleep_mind`/`immune_radiation`), `status` (filter), `page`, `per_page`, `sort_by` (`mission_day`), `sort_dir` (default `asc`).
- **Success — `200 OK`:**
```json
{ "data": [ { "crew_slug": "kenji", "domain": "sleep_mind", "display_name": "Sleep & Mind", "mission_day": 63, "score": 78, "status": "watch", "smoothed_z_score": 1.80, "reason": "Sleep and HRV below your baseline for 3 days.", "computed_at": "2026-11-14T09:00:00.000Z" } ] }
```
- **Errors:** `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown slug), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `GET /crew-members/{slug}/domain-scores/{mission_day}`
- **Purpose:** The 4 domain scores for one astronaut on one day.
- **Auth:** No — anon key only.
- **Success — `200 OK`:** `{ "data": { "crew_slug": "kenji", "mission_day": 63, "overall_score": 78, "overall_status": "watch", "domains": [ { "domain": "heart", "score": 84, "status": "watch", "reason": "…" } ] } }`
- **Errors:** `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown slug, or no scores that day), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

---

### 6.7 Flags — PRD M5, tables `flags`, `action_plan_items`

#### `GET /crew-members/{slug}/flags`
- **Purpose:** Active flags for one astronaut (optionally for one day).
- **Auth:** No — anon key only.
- **Query:** `mission_day` (optional), `status` (`watch`/`alert`), `is_acknowledged` (`true`/`false`), `page`, `per_page`, `sort_by` (`priority`/`mission_day`), `sort_dir` (default: `priority` asc).
- **Success — `200 OK`:**
```json
{ "data": [ { "id": "…", "crew_slug": "kenji", "domain": "heart", "indicator": "resting_heart_rate", "mission_day": 63, "status": "watch", "priority": 1, "current_value": 74, "baseline_mean": 62.0, "z_score": 1.85, "title": "Resting heart rate elevated", "evidence_text": "Sleep 5.2h vs your 7.4h baseline (−1.8 SD), HRV down, mood down for 3 days.", "why_it_matters": "A rising resting heart rate can be an early sign of infection.", "action_text": "Rest today, hydrate, and re-check tomorrow.", "contact_flight_surgeon_if": "Contact the flight surgeon if fever or chest pain appears.", "is_acknowledged": false, "acknowledged_at": null } ] }
```
- **Errors:** `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown slug), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `GET /flags/{flag_id}`
- **Purpose:** One flag, with its action-plan items.
- **Auth:** No — anon key only.
- **Success — `200 OK`:** Same flag object as above, plus `"action_plan_items": [ { "id": "…", "sort_order": 1, "item_text": "Rest today — no heavy exercise.", "is_done": false, "done_at": null } ]`.
- **Errors:** `400 VALIDATION_ERROR` (bad UUID), `401 UNAUTHENTICATED`, `404 NOT_FOUND`, `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `PATCH /flags/{flag_id}`
- **Purpose:** Acknowledge a flag (the crew has seen / acted on it). The only write on `flags` in the MVP.
- **Auth:** No — anon key only (V2: `medical_officer`).
- **Request headers:** `Content-Type: application/json` (see §3.3).
- **Request body:**
```json
{ "is_acknowledged": true }
```
- **Success — `200 OK`:** The flag object, with `"is_acknowledged": true, "acknowledged_at": "2026-11-15T04:15:00.000Z"`.
- **Errors:** `400 VALIDATION_ERROR` (missing `is_acknowledged`, or any other field sent — only that field is accepted), `401 UNAUTHENTICATED`, `403 FORBIDDEN` (V2: wrong role), `404 NOT_FOUND`, `409 CONFLICT` (flag already acknowledged — send the current state instead of erroring is forbidden; the client must `GET` first), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

---

### 6.8 Action plan — PRD M5, tables `flags`, `action_plan_items`

#### `GET /crew-members/{slug}/action-plan`
- **Purpose:** Action Plan page — all flags + their checklist items for one astronaut on one day, in priority order.
- **Auth:** No — anon key only.
- **Query:** `mission_day` (integer 1–180, default: latest day).
- **Success — `200 OK`:**
```json
{ "data": { "crew_slug": "kenji", "mission_day": 63, "flags": [ { "id": "…", "title": "Resting heart rate elevated", "status": "watch", "priority": 1, "evidence_text": "…", "action_text": "…", "contact_flight_surgeon_if": "…", "action_plan_items": [ { "id": "…", "sort_order": 1, "item_text": "Rest today — no heavy exercise.", "is_done": false } ] } ] } }
```
- **Errors:** `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown slug), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `PATCH /action-plan-items/{item_id}`
- **Purpose:** Check off (or uncheck) one action-plan item.
- **Auth:** No — anon key only (V2: `medical_officer` or the owning `astronaut`).
- **Request headers:** `Content-Type: application/json`.
- **Request body:**
```json
{ "is_done": true }
```
- **Success — `200 OK`:**
```json
{ "data": { "id": "…", "flag_id": "…", "sort_order": 1, "item_text": "Rest today — no heavy exercise.", "is_done": true, "done_at": "2026-11-15T04:15:00.000Z" } }
```
- **Errors:** `400 VALIDATION_ERROR` (missing `is_done`, or any other field), `401 UNAUTHENTICATED`, `403 FORBIDDEN` (V2: wrong role), `404 NOT_FOUND`, `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

---

### 6.9 Self-checks — PRD M7, table `self_checks`

#### `GET /crew-members/{slug}/self-checks`
- **Purpose:** List self-checks for one astronaut.
- **Auth:** No — anon key only (V2: the owning `astronaut`, or `medical_officer`).
- **Query:** `from_day`, `to_day`, `sync_status` (filter), `page`, `per_page`, `sort_by` (`mission_day`), `sort_dir` (default `desc`).
- **Success — `200 OK`:**
```json
{ "data": [ { "id": "…", "crew_slug": "kenji", "mission_day": 63, "sleep_hours": 5.2, "mood_score": 2, "stress_score": 4, "symptoms": ["fatigue", "headache"], "notes": null, "sync_status": "synced", "synced_at": "2026-11-15T04:15:00.000Z", "created_at": "…", "updated_at": "…" } ] }
```
- **Errors:** `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN` (V2: wrong crew), `404 NOT_FOUND` (unknown slug), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `POST /crew-members/{slug}/self-checks`
- **Purpose:** Create a self-check — the **only** browser write in the MVP. Writes locally first, then syncs (ARCHITECTURE §3.3).
- **Auth:** No — anon key only (write: self-check only). V2: the owning `astronaut`.
- **Request headers:** `Content-Type: application/json`, `Idempotency-Key: <uuid>` (required — see §3.3).
- **Request body:**
```json
{
  "mission_day": 63,
  "sleep_hours": 5.2,
  "mood_score": 2,
  "stress_score": 4,
  "symptoms": ["fatigue", "headache"],
  "notes": "Woke up tired, mild headache."
}
```
Field rules: `mission_day` required, 1–180. `sleep_hours` required, 0–24. `mood_score` required, 1–5. `stress_score` optional, 1–5. `symptoms` optional, array of strings (max 10). `notes` optional, string (max 500 chars). No other fields are accepted.
- **Success — `201 Created`:**
```json
{ "data": { "id": "…", "crew_slug": "kenji", "mission_day": 63, "sleep_hours": 5.2, "mood_score": 2, "stress_score": 4, "symptoms": ["fatigue", "headache"], "notes": "Woke up tired, mild headache.", "sync_status": "pending", "synced_at": null, "created_at": "2026-11-15T04:15:00.000Z", "updated_at": "2026-11-15T04:15:00.000Z" } }
```
- **Errors:** `400 VALIDATION_ERROR` (missing `sleep_hours`/`mood_score`, `mood_score` out of 1–5, `notes` > 500 chars, unknown field), `400 INVALID_JSON`, `401 UNAUTHENTICATED`, `403 FORBIDDEN` (V2: wrong crew), `404 NOT_FOUND` (unknown slug), `409 CONFLICT` (a self-check already exists for that crew-day — use `PATCH` to edit), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `GET /crew-members/{slug}/self-checks/{mission_day}`
- **Purpose:** One day's self-check.
- **Auth:** No — anon key only.
- **Success — `200 OK`:** Same object as above.
- **Errors:** `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown slug, or no self-check that day), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `PATCH /crew-members/{slug}/self-checks/{mission_day}`
- **Purpose:** Edit a self-check for a day (replaces the fields sent; fields not sent are unchanged).
- **Auth:** No — anon key only (V2: the owning `astronaut`).
- **Request headers:** `Content-Type: application/json`.
- **Request body (example — any subset of the POST fields except `mission_day`):**
```json
{ "mood_score": 3, "notes": "Feeling a bit better after resting." }
```
- **Success — `200 OK`:** The updated self-check object, with `sync_status` reset to `pending` (it must sync again).
- **Errors:** `400 VALIDATION_ERROR`, `400 INVALID_JSON`, `401 UNAUTHENTICATED`, `403 FORBIDDEN` (V2), `404 NOT_FOUND`, `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `DELETE /crew-members/{slug}/self-checks/{mission_day}`
- **Purpose:** Withdraw a self-check (soft delete — sets `deleted_at`).
- **Auth:** No — anon key only (V2: the owning `astronaut`).
- **Request body:** None.
- **Success — `200 OK`:** The self-check object, with `"deleted_at": "2026-11-15T04:15:00.000Z"`.
- **Errors:** `401 UNAUTHENTICATED`, `403 FORBIDDEN` (V2), `404 NOT_FOUND` (unknown slug, or no self-check / already deleted), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

---

### 6.10 Trends — PRD M6, ⚠️ derived (no own table)

#### `GET /trends`
- **Purpose:** Trend series for one astronaut: values + normal band over a range, for one or all domains. This is a **derived** endpoint — it is computed from `daily_readings` + `baselines` + `domain_scores` and has no table of its own (flagged §11).
- **Auth:** No — anon key only.
- **Query:** `crew_slug` (required: `kenji`/`amara`/`elena`), `from_day` + `to_day` (default: last 30 days, max range 180), `domain` (optional — one domain, or omit for all 4), `indicator` (optional — one indicator's series instead of domain scores).
- **Pagination:** none — use `from_day`/`to_day`. Max 180 points per series.
- **Success — `200 OK`:**
```json
{ "data": { "crew_slug": "kenji", "from_day": 34, "to_day": 63, "series": [
  { "domain": "sleep_mind", "points": [ { "mission_day": 60, "value": 82, "score": 82, "status": "watch", "baseline_mean": 7.4, "baseline_low": 6.5, "baseline_high": 8.3 } ] }
] } }
```
The `baseline_low` / `baseline_high` are the normal band (mean ± 1 SD, from `baselines`).
- **Errors:** `400 VALIDATION_ERROR` (`crew_slug` missing/unknown, range > 180 days, `from_day` > `to_day`, unknown `domain`/`indicator`), `401 UNAUTHENTICATED`, `404 NOT_FOUND` (no data in range), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

---

## 7. Reports, sync, emergency, reference

### 7.1 Reports — PRD M8 + Flow 4, table `reports`

#### `GET /reports`
- **Purpose:** List generated report records (metadata only — the PDF file is not stored).
- **Auth:** No — anon key only (V2: `medical_officer` / `flight_surgeon`).
- **Query:** `mission_id` (optional), `mission_day` (optional), `page`, `per_page`, `sort_by` (`mission_day`/`created_at`), `sort_dir` (default `created_at` desc).
- **Success — `200 OK`:**
```json
{ "data": [ { "id": "…", "mission_id": "…", "mission_day": 63, "crew_slugs": ["kenji", "amara", "elena"], "file_name": "OrbitCare-Day-63-report.pdf", "page_count": 4, "generated_by": "on-device", "created_at": "…", "updated_at": "…" } ] }
```
- **Errors:** `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown `mission_id`), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `POST /reports`
- **Purpose:** Register a report that was generated on-device (the PDF is built in the browser with @react-pdf/renderer — the API only records that it exists, so Earth can see the handover happened).
- **Auth:** No — anon key only (V2: `medical_officer`).
- **Request headers:** `Content-Type: application/json`, `Idempotency-Key: <uuid>` (required).
- **Request body:**
```json
{ "mission_id": "a1b2c3d4-…", "mission_day": 63, "crew_slugs": ["kenji", "amara", "elena"], "file_name": "OrbitCare-Day-63-report.pdf", "page_count": 4 }
```
- **Success — `201 Created`:** The report object, as in `GET /reports`.
- **Errors:** `400 VALIDATION_ERROR` (missing `mission_day`, empty `crew_slugs`, `page_count` ≤ 0, unknown slug), `400 INVALID_JSON`, `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown `mission_id`), `409 CONFLICT` (same `Idempotency-Key` with a different body), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `GET /reports/{report_id}`
- **Purpose:** Get report metadata.
- **Auth:** No — anon key only.
- **Success — `200 OK`:** The report object.
- **Errors:** `400 VALIDATION_ERROR` (bad UUID), `401 UNAUTHENTICATED`, `404 NOT_FOUND`, `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `GET /reports/{report_id}/download`
- **Purpose:** Download the PDF. **Note:** in the MVP the PDF is built on-device, so this endpoint returns the *registered* report's download only if the server has a copy; otherwise it returns `404` with a message telling the client to generate it on-device. Do not treat this as the primary PDF path — the primary path is on-device (PRD M8, ARCHITECTURE §3.4).
- **Auth:** No — anon key only.
- **Request headers:** `Accept: application/pdf`.
- **Success — `200 OK`:** `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="OrbitCare-Day-63-report.pdf"`, body = the PDF bytes. No JSON envelope on this endpoint.
- **Errors (JSON, standard format):** `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 NOT_FOUND` (unknown report, or no server copy — regenerate on-device), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `DELETE /reports/{report_id}`
- **Purpose:** Soft-delete a report record (the PDF file on the device is unaffected).
- **Auth:** No — anon key only (V2: `medical_officer`).
- **Success — `200 OK`:** The report object, with `deleted_at` set.
- **Errors:** `401 UNAUTHENTICATED`, `403 FORBIDDEN` (V2), `404 NOT_FOUND` (unknown / already deleted), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

### 7.2 Sync — PRD M9 + V2 handover log, tables `sync_log`, `self_checks`

#### `GET /sync/status`
- **Purpose:** Sync state for the header chip: LIVE / STALE / OFFLINE + last-sync time.
- **Auth:** No — anon key only.
- **Success — `200 OK`:**
```json
{ "data": { "status": "live", "last_synced_at": "2026-11-15T04:15:00.000Z", "last_synced_mission_day": 63, "pending_count": 0, "failed_count": 0 } }
```
`status` is `live` (synced in the last 5 minutes), `stale` (last sync > 5 minutes ago), or `offline` (no connection / Supabase unreachable).
- **Errors:** `401 UNAUTHENTICATED`, `429 RATE_LIMITED`, `500 SERVER_ERROR`. A database failure returns `503 SERVICE_UNAVAILABLE` with `status: "offline"` in the error `details` — the client treats that as OFFLINE, not as a crash (see §4.4).

#### `POST /sync`
- **Purpose:** Sync queued items (self-checks, reports) to Earth. Called when a connection returns.
- **Auth:** No — anon key only (V2: `medical_officer`).
- **Request headers:** `Content-Type: application/json`, `Idempotency-Key: <uuid>` (recommended).
- **Request body:**
```json
{ "items": [ { "entity_type": "self_check", "entity_id": "…", "mission_day": 63 } ] }
```
`items` is an array, max 100 items per call. An empty array is valid and returns `200` with `synced: 0`.
- **Success — `200 OK`:**
```json
{ "data": { "synced": 1, "failed": 0, "results": [ { "entity_type": "self_check", "entity_id": "…", "sync_status": "synced", "synced_at": "2026-11-15T04:15:00.000Z" } ] } }
```
- **Errors:** `400 VALIDATION_ERROR` (> 100 items, unknown `entity_type`, unknown `entity_id`), `400 INVALID_JSON`, `401 UNAUTHENTICATED`, `404 NOT_FOUND` (an `entity_id` does not exist — the whole call fails, no partial sync), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE` (no connection — the queue stays, retry later; never delete queued items on a 503).

#### `GET /sync-log`
- **Purpose:** Sync history (V2 handover log) — what was synced, when, what is still queued.
- **Auth:** No — anon key only (V2: `medical_officer` / `flight_surgeon`).
- **Query:** `sync_status` (filter), `entity_type` (filter), `page`, `per_page`, `sort_by` (`created_at`), `sort_dir` (default `desc`).
- **Success — `200 OK`:**
```json
{ "data": [ { "id": "…", "mission_id": "…", "entity_type": "self_check", "entity_id": "…", "sync_status": "synced", "attempt_count": 1, "last_error": null, "synced_at": "2026-11-15T04:15:00.000Z", "created_at": "…" } ] }
```
- **Errors:** `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

### 7.3 Emergency — PRD V2, table `emergency_guide_steps`

#### `GET /emergency`
- **Purpose:** List the 6 emergency situations (V2 — the endpoint exists in v1 so the guide can ship without an API change, but it returns the static guide data).
- **Auth:** No — anon key only.
- **Success — `200 OK`:**
```json
{ "data": [ { "situation_slug": "collapsed", "situation_name": "Collapsed / not breathing", "step_count": 5, "has_metronome": true } ] }
```
- **Errors:** `401 UNAUTHENTICATED`, `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`. (Offline: the client must have this data cached — the Emergency Guide must work with no connection, so a `503` here is never blocking.)

#### `GET /emergency/{situation_slug}`
- **Purpose:** Steps for one situation, one step at a time.
- **Auth:** No — anon key only.
- **Success — `200 OK`:**
```json
{ "data": { "situation_slug": "collapsed", "situation_name": "Collapsed / not breathing", "steps": [ { "step_number": 1, "step_title": "Check for breathing", "step_body": "Look, listen and feel for breathing for 10 seconds.", "has_metronome": false } ] } }
```
- **Errors:** `400 VALIDATION_ERROR` (unknown slug), `401 UNAUTHENTICATED`, `404 NOT_FOUND`, `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

### 7.4 Reference — PRD M3/M4, tables `indicators`, `domains`

#### `GET /indicators`
- **Purpose:** List all indicators with units and direction (for the vitals table and for scoring).
- **Auth:** No — anon key only.
- **Success — `200 OK`:**
```json
{ "data": [ { "id": "…", "slug": "sleep_hours", "display_name": "Sleep", "unit": "h", "direction_worse": "lower", "is_active": true } ] }
```
- **Errors:** `401 UNAUTHENTICATED`, `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `GET /domains`
- **Purpose:** List the 4 domains in display order.
- **Auth:** No — anon key only.
- **Success — `200 OK`:**
```json
{ "data": [ { "id": "…", "slug": "heart", "display_name": "Heart", "sort_order": 1 } ] }
```
- **Errors:** `401 UNAUTHENTICATED`, `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

---

## 8. Admin — ⚠️ flagged

#### `POST /admin/scoring/recompute`
- **Purpose:** Recompute `domain_scores` + `flags` from `baselines` + `daily_readings` + `self_checks` for a mission / crew / day range. Seed and recovery only — never called by the app during normal use.
- **PRD:** — (no PRD feature; supports M3/M4. Flagged §11.)
- **Table:** `domain_scores`, `flags`.
- **Auth:** **Yes — service_role only.** A browser call gets `403 FORBIDDEN` (or `401` without a key).
- **Request headers:** `Content-Type: application/json`, `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
- **Request body:**
```json
{ "mission_id": "a1b2c3d4-…", "crew_slug": "kenji", "from_day": 1, "to_day": 180 }
```
`crew_slug` is optional (omit = all crew). `from_day`/`to_day` are optional (omit = whole mission).
- **Success — `200 OK`:**
```json
{ "data": { "recomputed_scores": 720, "recomputed_flags": 12, "from_day": 1, "to_day": 180 } }
```
- **Errors:** `400 VALIDATION_ERROR`, `400 INVALID_JSON`, `401 UNAUTHENTICATED`, `403 FORBIDDEN` (anon key, or any non-service role), `404 NOT_FOUND` (unknown mission/crew), `429 RATE_LIMITED`, `500 SERVER_ERROR`, `503 SERVICE_UNAVAILABLE`.

---

## 9. Worked examples (end to end)

### 9.1 Day-63 demo (the PRD Flow 2, as API calls)
1. `GET /crew-members?mission_day=63` → Kenji first, `overall_status: "watch"`, `overall_score: 78`.
2. `GET /crew-members/kenji?mission_day=63` → dashboard: 4 domain scores, vitals vs baseline, 3 flags.
3. `GET /trends?crew_slug=kenji&from_day=34&to_day=63` → 30-day series; sleep/HRV leave the normal band around Day 60–63.
4. `GET /flags/{flag_id}` → evidence: "Sleep 5.2h vs your 7.4h baseline (−1.8 SD), HRV down, mood down for 3 days."
5. `GET /crew-members/kenji/action-plan?mission_day=63` → rest / hydrate / light exercise + "contact flight surgeon if fever / chest pain".
6. `POST /reports` (on-device PDF, then register it) → `201 Created`, then `GET /reports/{id}/download` if a server copy exists.

### 9.2 Daily check-in (PRD Flow 1)
1. `GET /crew-members/kenji/self-checks/63` → `404 NOT_FOUND` (no check yet today — that is expected).
2. `POST /crew-members/kenji/self-checks` with `Idempotency-Key` → `201 Created`, `sync_status: "pending"`.
3. `POST /sync` when a connection returns → `200 OK`, `synced: 1`.
4. `GET /crew-members/kenji?mission_day=63` → Sleep & Mind score updated.

### 9.3 A request that fails (and how the client must handle it)
`GET /crew-members/nope?mission_day=63` → `404 NOT_FOUND`, standard error format, `message: "No crew member found with slug 'nope'. Check the slug and try again."` The client shows "Crew member not found — back to Crew View" with a Back button, not a raw code.

---

## 10. What is deliberately NOT in this API

- **No `PUT`, no `DELETE` on history tables** (§1.4) — readings, scores, flags, baselines are immutable.
- **No login / signup / password endpoints** — no auth in the MVP (ARCHITECTURE §1.2, decision 5).
- **No diagnosis, treatment, or prescription endpoints** — forbidden by PRD. Any endpoint that returned one would be removed, not documented.
- **No real-time / websocket endpoints** — no doctor chat, no live telemetry (PRD non-goals).
- **No file-upload endpoint** — the PDF is built on-device; `POST /reports` registers metadata only.
- **No analytics endpoint** — no tracking in the MVP.
- **No `GET /users`, no admin panel, no multi-mission management** — out of scope (PRD §10).

---

## 11. Flagged endpoints — do not map cleanly (per the user's rule)

| Endpoint | Flag | Why it exists anyway |
|---|---|---|
| `GET /health` | ⚠️ No PRD feature, no table | Infrastructure: Vercel / uptime checks need a liveness endpoint that touches no product data. |
| `GET /trends` | ⚠️ No own table (derived) | PRD M6 needs a series + normal band in one call. It is computed from `daily_readings` + `baselines` + `domain_scores` — it must never be given its own table. |
| `POST /admin/scoring/recompute` | ⚠️ No PRD feature | Seed / recovery only. It supports M3/M4 by rebuilding their cached tables, but no user flow calls it. Service-role only, never from a browser. |

**Everything else in §2 maps to at least one PRD feature (M1–M10 or a named V2 feature) and at least one DATABASE.md table.** If a new endpoint is proposed and cannot name both, it does not ship — update PRD and DATABASE first, then this file.

---

*End of API.md v1.0. This file is the contract. Change the API here first, then change the code — never the other way round. A client built against v1.0 must keep working against any later v1.x.*
