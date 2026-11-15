# OrbitCare — AUTH_SECURITY.md

**Authentication and security design. V2 only — do not build this
for the hackathon.**

**Version:** 1.0 — 15 Nov 2026
**Sources of truth:** `PRD.md` v1.0, `ARCHITECTURE.md` v1.0,
`DATABASE.md` v1.0, `API.md` v1.0, `PLAN.md` v1.0 (all 15 Nov 2026).
If this file conflicts with any of those, that file wins.
**Status:** design only. Nothing in this file is implemented.

---

## 0. Read this first — the MVP has no auth

- **The MVP ships with no login, no user accounts, no roles.**
  (PRD §3 non-goals; ARCHITECTURE §1.2 decision 5: "No auth in
  the MVP"; API.md §3.1; DATABASE.md §7, §10: "No `users` / `auth`
  table in the MVP — no auth, no passwords, no roles table".)
- The demo crew is fixed (Kenji, Amara, Elena), all data is
  simulated, and the only browser write is one self-check
  (`POST /api/v1/crew-members/{slug}/self-checks`, anon key only).
- **This file designs auth for V2 only** (PLAN Phase 6), to be
  built only if real users appear after the hackathon.
  Do not start PLAN Phase 6 before Phase 4 is done and submitted.
- The delivered code folder (`orbitspace-code/`) has **no auth at
  all**: no login page, no `users` table, no password code, no JWT
  code. Its backend only knows the Supabase anon key (reads) and
  the service-role key (server-only seed/writes).
- **This file contains no real passwords, keys, or secrets.**
  Every value shown is a placeholder. Never store a plain-text
  password or a secret in code, in Git, in a screenshot, or in
  this file — that rule is the whole point of §7 below.

**How to read the "choice" lines:** the user's rule for this file
is that every design choice is explained in one line. Each choice
below therefore has exactly one line starting with `Choice:`.
If a choice needs more than one line to explain, the choice is
wrong — simplify it first.

---

## 1. Authentication methods

Supabase Auth is the only auth provider. No home-grown auth server,
no custom password code, no separate auth service in V2 either.

| Method | Who it is for | Status in V2 |
|---|---|---|
| Email + password | Astronaut, medical officer (crew accounts created by the mission admin) | Primary method |
| OAuth (Google) | Flight surgeon / Earth staff with a Google account; crew if the mission uses Google Workspace | Secondary method |
| Magic link (email) | Anyone who forgets a password, or a crew member on a shared on-board terminal who should not type a password where others can see it | Recovery / low-friction sign-in |

- **Supabase Auth, not a custom system.**
  `Choice:` Supabase already stores the database, so its Auth
  gives us hashed passwords, JWTs, email delivery and RLS
  integration without a second system to secure.
- **One identity per person, linked to the crew.**
  `Choice:` one account maps to one `profiles` row, so a role and
  a crew can never drift apart.
- **No social login beyond Google in V2.**
  `Choice:` one well-tested OAuth provider is easier to audit
  than five, and Earth staff already have Google accounts.
- **No anonymous accounts, no guest mode in V2.**
  `Choice:` an unnamed session cannot be held accountable for a
  self-check or an acknowledgement, so every write needs a named user.
- **No username — email is the identifier.**
  `Choice:` an email is unique, verifiable, and is the channel
  used for reset and magic-link messages.

### 1.1 The `profiles` table (the only new table auth needs)

From DATABASE.md §7 (V2 policies) and PLAN 6.1:

```sql
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  crew_id text references crew_members (slug) on delete set null,
  mission_id uuid references missions (id) on delete cascade,
  role text not null check (role in
    ('astronaut', 'medical_officer', 'flight_surgeon')),
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- `Choice:` `profiles.id` is `auth.users.id`, so deleting the
  auth user deletes the profile with it and no orphaned role survives.
- `Choice:` the role lives in `profiles`, not in the JWT alone,
  so a role change takes effect without waiting for a token to expire.
- `Choice:` `crew_id` is nullable, so a flight surgeon (who is
  not crew) can have a profile with no crew row.
- There is **no `password` column anywhere** — Supabase Auth
  stores the hash in its own `auth.users` table, never in ours.

---

## 2. Auth flows — login, signup, logout, password reset

All flows run through Supabase Auth (`@supabase/supabase-js` on
the client for the browser flow, and the server client for
verification). The app never sees, logs, or stores a password.

### 2.1 Signup (email + password)

Applies to: a mission admin creating a crew account, or a flight
surgeon self-registering for an assigned mission.

1. User opens `/signup`, enters display name, email, password.
2. Client validates (§6): email format, password ≥ 12 characters
   with the rules in §4.1, name 1–100 characters.
3. Client calls `supabase.auth.signUp({ email, password })`.
4. Supabase Auth creates the user in `auth.users` (email
   unconfirmed) and sends a confirmation email with a link.
5. User clicks the link → Supabase confirms the email → the
   app creates the `profiles` row (role + `crew_id` + `mission_id`,
   service-role only — see §2.5: the browser never writes `profiles`).
6. User is signed in and redirected to the Crew View.

- `Choice:` email confirmation is required before any write,
  so a mistyped address can never own a crew account.
- `Choice:` the `profiles` row is created server-side only, so
  a user cannot grant themself the medical-officer role.
- **What the UI shows on failure:** "That email is already
  registered — try signing in, or reset your password." — the
  same message whether the email exists or not (see §4.4: no
  user enumeration).

### 2.2 Login (email + password)

1. User opens `/login`, enters email + password.
2. Client validates format only (never reveals which field was wrong).
3. Client calls `supabase.auth.signInWithPassword({ email, password })`.
4. On success Supabase returns an access token + refresh token
   (§3) and the app sets the session cookie (§3.3).
5. On failure the UI shows one generic message: "Email or
   password is incorrect." (see §4.4), and the attempt is
   rate-limited (§4.3).
6. The app reads the user's `profiles` row (role + crew) and
   redirects: astronaut → own Dashboard; medical officer →
   Crew View; flight surgeon → Crew View (synced rows only, §5).

- `Choice:` one generic login error for both a bad email and a
  bad password, so an attacker cannot probe which emails exist.

### 2.3 Login (OAuth — Google)

1. User clicks "Continue with Google" on `/login`.
2. Client calls `supabase.auth.signInWithOAuth({ provider: 'google' })`.
3. Browser goes to Google, the user consents, Google returns to
   Supabase, Supabase returns the session (§3).
4. If no `profiles` row exists for that Google email, the app
   shows "No OrbitCare account for this Google account — ask
   your mission admin to create one." and does **not** create one.
5. Otherwise the user is signed in exactly as in §2.2, step 6.

- `Choice:` OAuth never auto-creates an account, so a stranger
  with a Google account cannot walk into a mission.
- `Choice:` Google is the only OAuth provider in V2, so there
  is one consent screen and one token flow to audit.

### 2.4 Login (magic link)

1. User opens `/login`, enters only their email, clicks
   "Email me a sign-in link".
2. Client calls `supabase.auth.signInWithOtp({ email })`.
3. Supabase emails a link that is valid for **1 hour, one use**.
4. User clicks the link → Supabase verifies it → session is
   created (§3) → redirect as in §2.2, step 6.
5. The UI always shows the same message, whether the email
   exists or not: "If that email has an account, a sign-in
   link is on its way." (see §4.4).

- `Choice:` magic links are single-use and expire in 1 hour, so
  a forwarded or leaked email cannot be reused later.
- `Choice:` magic link is for sign-in and recovery, never for
  creating an account, so it cannot be used to register.

### 2.5 Logout

1. User clicks "Log out" (header menu, on every page).
2. Client calls `supabase.auth.signOut()`.
3. The app clears the session cookie (§3.3) and the offline
   cache's user-scoped entries (see §2.6).
4. The user is redirected to `/login`. The access token is
   discarded; the refresh token is revoked server-side by
   Supabase (see §3.4).
5. A "Log out on all devices" action (in account settings) revokes
   **all** refresh tokens for that user.

- `Choice:` logout revokes the refresh token instead of only
  deleting a cookie, so a stolen token cannot be reused after logout.

### 2.6 Password reset

1. User clicks "Forgot password?" on `/login`, enters their email.
2. Client calls `supabase.auth.resetPasswordForEmail(email)`.
3. The UI shows the same message whether the email exists or not:
   "If that email has an account, a reset link is on its way."
4. Supabase emails a reset link, valid for **1 hour, one use**.
5. User clicks the link, enters a new password (same rules as
   §4.1, and it must differ from the last 3 passwords — enforced
   by Supabase Auth's password history where available, otherwise
   by the app refusing a reuse it can see only as a hash match).
6. The new password is hashed by Supabase Auth (§4.1). All
   other sessions for that user are revoked (see §3.4).
7. The user is signed in with the new password and redirected
   as in §2.2, step 6.

- `Choice:` a reset always revokes other sessions, so a reset
  after a suspected compromise locks the attacker out everywhere.
- `Choice:` the reset link expires in 1 hour and is single-use,
  so a leaked email cannot reset the account days later.

### 2.7 What the app must never do in any flow

- Never log, store, or display a password, a reset link, a
  magic-link token, or a refresh token.
- Never put a token in a URL that can be copied, bookmarked, or
  leaked in a referrer header — except the one-time Supabase
  email link, which Supabase itself issues and expires.
- Never tell the user whether an email exists (see §4.4).
- Never create a `profiles` row from the browser — only the
  server (service role) writes it.

---

## 3. JWT design

Supabase Auth issues the tokens. The app does not mint, sign, or
verify JWTs by hand — it asks Supabase to do it.

### 3.1 The two tokens

| Token | Lifetime | What it is | Where it lives |
|---|---|---|---|
| **Access token** (JWT) | **1 hour** (Supabase default; do not lengthen it) | Short-lived proof of who the user is: `sub` = `auth.users.id`, `role` = `authenticated`, plus the app's `profiles` role read from the database on each request (never trusted from the token alone) | `httpOnly`, `Secure`, `SameSite=Lax` cookie — **never** `localStorage` (§3.3) |
| **Refresh token** | **7 days**, rotating (see §3.4) | Long-lived credential used only to get a new access token; it proves nothing by itself and carries no permissions | `httpOnly`, `Secure`, `SameSite=Lax` cookie, separate cookie from the access token |

- `Choice:` a 1-hour access token limits how long a stolen
  token is useful, while a 7-day refresh token keeps a real
  astronaut signed in for a whole mission week.
- `Choice:` the role is read from `profiles` on the server on
  each request, so a role change takes effect immediately and a
  tampered token cannot grant a role.

### 3.2 What is (and is not) in the access token

In the token (claims): `sub` (user id), `email`, `aud`
(`authenticated`), `exp` (1 hour), `iat`, `iss` (Supabase).

Not in the token: the user's role, crew, mission, health data,
or any permission list.

- `Choice:` keeping the token minimal means there is nothing
  sensitive to leak if it is ever exposed, and no stale role
  to honour after a demotion.

### 3.3 Storage — cookies, not localStorage

- **Access + refresh tokens live in `httpOnly`, `Secure`,
  `SameSite=Lax` cookies, set by the Next.js server (Route
  Handlers / middleware), never by browser JavaScript.**
  `Choice:` an `httpOnly` cookie cannot be read by JavaScript,
  so an XSS flaw cannot steal the tokens the way it could from `localStorage`.
- **Never store a token in `localStorage`, `sessionStorage`, or
  a plain (non-`httpOnly`) cookie.**
  `Choice:` `localStorage` is readable by any script on the page,
  so it turns every XSS bug into a full account takeover.
- **`Secure` is always on in production; `SameSite=Lax` is the
  default.**
  `Choice:` `Secure` stops the cookie travelling over plain HTTP,
  and `Lax` stops it being sent on cross-site top-level GETs.
- **CSRF protection for cookie auth is in §4.5** — cookies alone
  are not the whole answer.
- **The offline cache (§ M9) stores mission data, never tokens.**
  `Choice:` cached health data is labelled simulated and is
  useless without a session, while a cached token would be a
  live credential on a shared device.

### 3.4 Rotation and revocation

- **Refresh-token rotation (on):** every time a refresh token
  is used to mint a new access token, Supabase issues a **new**
  refresh token and invalidates the old one.
  `Choice:` rotation means a stolen refresh token stops working
  the moment the real user refreshes, and a replayed old token
  is detectable.
- **Reuse detection:** if an already-rotated (old) refresh token
  is presented again, Supabase treats it as theft and revokes
  **the whole token family** for that user, forcing a re-login.
  `Choice:` detecting reuse turns a silent theft into a visible
  lockout instead of letting two holders share a session.
- **Logout revokes** the current refresh token (§2.5).
- **Password reset revokes all** refresh tokens for that user (§2.6).
- **Role change / account disable revokes all** refresh tokens
  for that user — the next request after the change gets `401`.
  `Choice:` revoking on a role change closes the window in which
  a demoted user keeps acting with the old role.
- **Absolute session limit:** 30 days, even with rotation.
  `Choice:` a hard limit bounds the damage if rotation is ever
  bypassed, at the cost of one re-login a month.

### 3.5 How the server checks a request (V2)

1. Read the access-token cookie; no cookie → `401 UNAUTHENTICATED`.
2. Ask Supabase Auth to verify the JWT (signature, issuer,
   audience, expiry). An expired token → try one refresh with
   the refresh-token cookie; if that fails → `401`.
3. Load the user's `profiles` row (role + `crew_id` +
   `mission_id`). No profile → `403 FORBIDDEN` (the account
   exists but has no OrbitCare role).
4. Check the role against the permissions matrix (§5) for the
   endpoint + resource. Wrong role → `403 FORBIDDEN`.
5. Apply the RLS policy (DATABASE.md §7, V2) as the last check
   in the database itself — the API check and the database check
   must agree; if they disagree, the database wins and the
   request is denied.

- `Choice:` verifying the token and the profile on every request
  (not once at login) means a revoked or demoted user is stopped
  within one request, not at the next login.
- `Choice:` keeping RLS as the final check means a bug in the
  API layer alone cannot leak another crew's rows.

---

## 4. Passwords, rate limiting, CORS, CSRF, XSS

OWASP references: OWASP ASVS v4.0 and the OWASP Cheat Sheet
Series (Authentication, Password Storage, Cross-Site Request
Forgery Prevention, Cross-Site Scripting Prevention, Input
Validation). Every rule below maps to one of those.

### 4.1 Password hashing and password rules

- **The app never hashes a password. Supabase Auth does it.**
  `Choice:` a managed auth service is audited and updated,
  while a hand-rolled hash is where password bugs are born.
- **Hash: bcrypt (Supabase Auth default), cost factor 12 or
  higher where configurable.**
  `Choice:` bcrypt with a cost of 12+ is slow enough to make
  offline guessing expensive and is the OWASP-approved fallback
  where Argon2id is not available.
- **If passwords are ever handled outside Supabase Auth
  (do not do this in V2): use Argon2id, not MD5 / SHA-1 /
  SHA-256 alone, and never a plain hash with no salt.**
  `Choice:` Argon2id is the OWASP first choice because it is
  memory-hard, so a GPU farm gains little from trying it.
- **Password rules (enforced at signup and at reset):**
  minimum **12 characters**; at least one letter and one number;
  the 10,000 most common passwords are rejected (Supabase Auth
  / Have I Been Pwned list check where available); the password
  must differ from the last 3 passwords.
  `Choice:` length beats complexity rules, because a long
  passphrase is both stronger and easier for a tired astronaut
  to remember than `P@ssw0rd!`.
- **No maximum length below 128 characters; no forced rotation
  on a schedule.**
  `Choice:` forced rotation makes people pick weaker passwords,
  so rotation happens only after a suspected compromise.
- **Never store, log, or display a plain-text password.**
  `Choice:` a password that is never written down cannot be
  leaked from a log, a backup, or a screenshot.

### 4.2 Account lockout and rate limiting

Auth endpoints are rate-limited much more strictly than the
data API (API.md §5.4: anon 60/min, authenticated 300/min,
service 1,000/min — those limits are for data, not for login).

| Action | Limit (proposed — not in API.md, set these when auth ships) | On exceeding it |
|---|---|---|
| Login attempts (per IP + email) | **5 failed attempts / 15 minutes** | `429` + `Retry-After`; the account is **not** locked, the IP+email pair is throttled (so one attacker cannot lock out a real user) |
| Signup attempts (per IP) | 10 / hour | `429` |
| Password-reset / magic-link requests (per email) | 3 / hour | `429`, and the generic message in §2.4/§2.6 (never reveal whether the email exists) |
| Token refresh (per IP) | 30 / minute | `429` |
| Data API (existing, API.md §5.4) | anon 60/min, authenticated 300/min, service 1,000/min | `429` + `Retry-After` |

- `Choice:` throttling by IP+email instead of locking the
  account stops a brute-force without letting an attacker lock
  a real astronaut out of their own health data.
- `Choice:` a `429` always carries `Retry-After`, so a
  legitimate client backs off instead of hammering the endpoint.
- **Log every failed login** (email hash + IP + time, never the
  password) and alert on 10 failures for one email in an hour.
  `Choice:` a log that never holds a password is safe to keep,
  and a spike is the earliest sign of a credential-stuffing attempt.

### 4.3 CORS (Cross-Origin Resource Sharing)

- **Allow-list, never `*`:** the API accepts browser requests
  only from the Vercel production origin
  (`https://<your-app>.vercel.app`, from `NEXT_PUBLIC_APP_URL`)
  and `http://localhost:3000` in development.
  `Choice:` an allow-list means a random website cannot call the
  API with a crew member's cookies, while `*` would let it.
- **Credentials (`Access-Control-Allow-Credentials: true`) only
  for allow-listed origins, never with `*`.**
  `Choice:` credentials with `*` is forbidden by browsers for a
  reason — it would hand the session to any origin.
- **`Access-Control-Allow-Methods`:** `GET, POST, PATCH, DELETE`
  only. **Headers:** `Content-Type, Authorization, apikey,
  X-Request-Id, Idempotency-Key` only.
  `Choice:` a narrow method/header list shrinks the surface an
  attacker can probe.
- **The delivered plain-HTML backend (`backend/server.js`) sets
  `Access-Control-Allow-Origin: *`.**
  `Choice:` that is acceptable for a local demo with simulated
  data and no auth, and it must be replaced by the allow-list
  above the moment V2 auth ships — do not ship V2 with `*`.

### 4.4 CSRF (Cross-Site Request Forgery) — only relevant with cookie auth

- **Cookies are `SameSite=Lax`** (§3.3), which blocks most
  cross-site POSTs by itself.
  `Choice:` `SameSite=Lax` is the cheapest CSRF defence and it
  costs nothing to turn on.
- **State-changing requests (POST / PATCH / DELETE) also require
  a CSRF token** — a double-submit cookie: the server sets a
  random token in a second cookie and the client sends the same
  value in the `X-CSRF-Token` header; the server rejects the
  request if they differ.
  `Choice:` a double-submit token stops the CSRF that `SameSite`
  misses (same-site subdomains, older browsers, top-level GETs).
- **GET requests never change state.**
  `Choice:` a read-only GET cannot be abused to do a write, so
  there is nothing for a CSRF attack to do with it.
- **User enumeration is a CSRF-adjacent leak, so it is fixed
  here, not in §2:** login, signup, magic-link and reset all
  return the same message whether the email exists or not.
  `Choice:` identical responses mean an attacker cannot harvest
  the crew's email list one probe at a time.

### 4.5 XSS (Cross-Site Scripting)

- **React escapes output by default — never bypass it.**
  `Choice:` the framework's escaping is the first line of defence,
  and `dangerouslySetInnerHTML` would throw it away.
- **No `dangerouslySetInnerHTML` anywhere in the app, and no
  `eval()`, `new Function()`, or `innerHTML` with user data.**
  `Choice:` banning the three sinks removes the way stored
  content (a self-check note, a flag explanation) becomes script.
- **Content-Security-Policy header (set by Next.js / Vercel):**
  `default-src 'self'; script-src 'self'; style-src 'self'
  'unsafe-inline'` (inline styles only where Tailwind needs
  them — tighten to nonces in V2 if the build allows it);
  `object-src 'none'; base-uri 'self'; frame-ancestors 'self'`.
  `Choice:` a CSP stops an injected script from running even if
  an XSS flaw slips through, which is the defence in depth OWASP asks for.
- **All user content rendered as text, never as HTML** —
  including self-check notes, flag explanations, and PDF text.
  `Choice:` text rendering means a note containing `<script>`
  is shown as text, not executed.
- **Tokens in `httpOnly` cookies (§3.3) are the XSS backstop.**
  `Choice:` even if an XSS flaw is found, it cannot read the
  session tokens, so it cannot become an account takeover.

---

## 5. Roles and permissions matrix

Roles are from API.md §3.1 (V2, defined now, enforced later)
and DATABASE.md §7 (V2 policies). `profiles.role` is the source
of truth; the matrix below is the contract the API and RLS must
both enforce. `service_role` is not a person — it is the server.

| Action | Anon (MVP, no login) | `astronaut` | `medical_officer` (Amara / Commander) | `flight_surgeon` (Dr. Rao, Earth) | `service_role` (server only) |
|---|---|---|---|---|---|
| Read missions / indicators / domains | Yes | Yes (own mission) | Yes | Yes (assigned missions) | Yes |
| Read crew list, worst-first | Yes | Yes — all crew in own mission (to see who needs help) | Yes | Yes (synced rows only) | Yes |
| Read own dashboard / vitals / baselines | Yes | Yes (own crew only) | Yes (all crew) | Yes (synced rows only) | Yes |
| Read another astronaut's dashboard | Yes (MVP demo) | **No** — own crew only | Yes | Yes (synced rows only) | Yes |
| Read domain scores / flags / trends | Yes | Yes (own crew only) | Yes | Yes (synced rows only) | Yes |
| Read reports / sync log | Yes | Yes (own mission) | Yes | Yes (synced rows only) | Yes |
| Create a self-check | Yes (the one MVP write) | Yes (own crew only) | No (officers do not log another astronaut's check) | No | Yes |
| Edit / withdraw own self-check | No (MVP has no edit) | Yes (own, same day) | No | No | Yes |
| Acknowledge a flag (`PATCH /flags/{id}`) | No | No | **Yes** | No | Yes |
| Check off an action-plan item | No | Yes (own plan items) | **Yes** | No | Yes |
| Create / download a PDF report | Yes (MVP) | Yes (own mission) | Yes | Yes (synced rows only) | Yes |
| Sync to Earth (`POST /sync`) | No | No | **Yes** (officer triggers the handover) | No | Yes |
| Seed / recompute scores (`POST /admin/scoring/recompute`) | No | No | No | No | **Yes only** |
| Create / edit a user or a role | No | No | No | No | **No** — only the mission admin in the Supabase dashboard (see §5.1) |
| Read rows that are not yet synced | Yes (MVP demo) | Yes (own mission) | Yes | **No** — only `sync_status = 'synced'` | Yes |
| Read soft-deleted rows | No | No | No | No | Yes (audit only) |

### 5.1 Who grants a role, and how it changes

- **Roles are granted only in the Supabase dashboard by the
  mission admin** (or by a server-side admin script using the
  service-role key). The app has no "make me an officer" button.
  `Choice:` role grants outside the app mean a compromised app
  cannot escalate its own user.
- **A role change takes effect immediately:** the next request
  re-reads `profiles` (§3.5) and the old refresh tokens are
  revoked (§3.4).
  `Choice:` immediate effect closes the window in which a
  demoted officer keeps acknowledging flags.
- **Every role change is logged** (who changed whom, from what
  to what, when) in an audit table the app cannot write to
  directly — the log is append-only, service-role only.
  `Choice:` an audit log that the app cannot rewrite is the
  only record a post-incident review can trust.
- **A flight surgeon sees only assigned missions and only
  synced rows.**
  `Choice:` an Earth doctor must never see a draft, unsynced
  self-check, so the handover boundary is enforced in the
  database, not just in the UI.

### 5.2 What a wrong role gets

- Valid token, wrong role → **`403 FORBIDDEN`**, never `401`.
  `Choice:` `401` means "log in again" and `403` means "you are
  logged in but not allowed", so the client can tell the user
  the truth instead of looping them back to login.
- No token / expired token that cannot be refreshed →
  **`401 UNAUTHENTICATED`**.
- No `profiles` row → **`403 FORBIDDEN`**.
- The error body is the standard API.md §4 format, with no
  extra detail about which check failed.
  `Choice:` a terse error does not tell an attacker which of
  the token, the profile, or the role was the problem.

---

## 6. Input validation and sanitization

Validate on the server on every request. Client-side validation
is for user experience only — it is never the security boundary.

### 6.1 The rule for every field

- **Allow-list, never deny-list:** a field accepts only the
  characters / values it needs; anything else is rejected.
  `Choice:` an allow-list is finite and testable, while a deny-list
  has to anticipate every attack string an attacker can invent.
- **Validate type, range, length, and format on the server,
  on every endpoint, even for fields the UI already checked.**
  `Choice:` the API is callable without the UI, so the UI's
  checks prove nothing about the request that actually arrives.
- **Reject, do not silently fix:** a value outside its range is
  a `400` with a plain-language message — except where API.md
  already documents a clamp (none in the V2 contract).
  `Choice:` silently fixing a value hides a bug or an attack
  from the log, while a rejection makes it visible.
- **Sanitize on output, validate on input:** stored text is
  kept as the user wrote it (up to the length limit) and escaped
  when rendered (§4.5).
  `Choice:` escaping at render time protects every consumer,
  while stripping characters at input time corrupts legitimate
  notes and still misses new contexts.

### 6.2 Field-by-field rules (V2)

| Field | Type / range / format | Reject if |
|---|---|---|
| Email | Valid email, max 254 chars, lowercased, trimmed | Invalid format, over 254 chars, or a disposable-domain blocklist hit (where configured) |
| Password | 12–128 chars, ≥ 1 letter + 1 number, not in the common-password list, differs from the last 3 | Under 12 chars, over 128, or on the common list |
| Display name | 1–100 chars, letters/spaces/`-`/`'` only | Empty, over 100 chars, or containing `<`, `>`, `/`, or a script tag |
| Mission day (`mission_day`, `day`) | Integer, 1–180 | Non-integer, < 1, > 180 |
| Crew slug (`crew_id`, `slug`) | One of the crew slugs in `crew_members` (or a UUID where the API uses one) | Unknown slug, or a slug containing `/`, `..`, or a quote |
| Sleep (self-check) | Number, 0–24 hours, max 1 decimal place | Outside 0–24, or non-numeric |
| Mood / stress / energy | Integer, 1–5 | Outside 1–5, or non-integer |
| Symptoms | Array of checkbox ids from a fixed list (no free text) | An id not in the fixed list |
| Notes (self-check) | Text, max 500 chars | Over 500 chars, or containing an HTML tag (rejected, not stripped — see §6.1) |
| Flag / item id | UUID (v4) | Not a UUID, or not found → `404` |
| Pagination (`page`, `per_page`) | Integers; `per_page` max 100 (API.md §5.1) | Over 100 → clamp to 100 and note it in `meta`; under 1 → `400` |
| `sort_by` / `sort_dir` | Only the fields the endpoint documents; `asc` / `desc` | Any other field → `400` (never build SQL from it) |
| File upload | **None in V2** — the app has no file upload | Any upload attempt → `400` |

### 6.3 SQL injection, and the database layer

- **All queries go through the Supabase client / parameterized
  queries. Never build SQL by concatenating user input.**
  `Choice:` a parameter can never become code, so the whole
  class of injection disappears instead of being filtered.
- **`sort_by` is an allow-list, not a column name from the
  request** (§6.2) — an unknown value is a `400`.
  `Choice:` sorting is the one place a column name legitimately
  comes from the client, so it is the one place that must be
  allow-listed.
- **RLS is the last line** (§3.5, §5): even a query that somehow
  runs with the wrong parameters can only return rows its role
  is allowed to see.
  `Choice:` defence in depth means one bug does not become a
  data breach.

### 6.4 Validation in the target stack

- **Use Zod (or the equivalent schema validator the team locks
  in ARCHITECTURE.md) for every request body in the Next.js
  target** — one schema per endpoint, shared by the route and
  its test.
  `Choice:` one schema per endpoint means the validation the test
  checks is the validation that actually runs.
- **The delivered plain-HTML backend does not have Zod.**
  `Choice:` do not claim it does — its validation is the
  hand-written checks in `server.js`, and V2 must replace them
  with schemas, not copy them.

---

## 7. Secrets management and environment variables

**The rule, in one sentence: a secret lives in exactly one place
— the environment of the machine that needs it — and nowhere else.**

### 7.1 The variable list (from ARCHITECTURE.md §7 + the delivered `.env.example`)

| Variable | Where it may live | Where it must never live |
|---|---|---|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | `.env` (local), Vercel env vars (production) | Nowhere else — it is a public identifier, not a secret, but it still belongs in env, not hard-coded |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env` (local), Vercel env vars | In a browser global, in a log, or in a screenshot — it is public by design, but it is still a credential, not copy to paste around |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only:** `.env` on the server, Vercel env vars marked "server only" | **Never** in the browser, never with a `NEXT_PUBLIC_` prefix, never in GitHub, never in a chat, never in a screenshot |
| `PORT` | `.env` (local) | — (not a secret; default `3000`) |
| `NEXT_PUBLIC_APP_URL` | `.env` / Vercel env vars | — (not a secret) |
| Database password (Supabase project) | The person who created the project, in a password manager | Never in `.env`, never in code, never in a chat |

- `Choice:` the service key is kept off the browser entirely,
  so a leaked frontend bundle cannot leak the key that can
  rewrite the whole database.
- `Choice:` `NEXT_PUBLIC_` is the only prefix the browser may
  see, so a variable without it is provably not shipped to the client.

### 7.2 The handling rules

1. **`.env.example` holds placeholders only, never real values.**
   `Choice:` an example file is committed to Git, so a real
   value in it would be public the moment it is pushed.
2. **`.env` (and `.env.local`) are in `.gitignore`** — both the
   root `.gitignore` and `backend/.gitignore` already list
   `backend/.env`. Check `git status` before every commit.
   `Choice:` the ignore file is the last automatic check before
   a secret reaches GitHub.
3. **Never add a secret with `git add .` without checking.**
   `Choice:` a blanket add is how a new `.env` file slips into
   a commit unnoticed.
4. **Production secrets live in Vercel env vars (or the host's
   secret store), typed per environment** — Production, Preview,
   Development are separate values.
   `Choice:` separate values per environment mean a leaked
   Preview key cannot be used against Production.
5. **Rotate on suspicion, not on a schedule:** if a key is ever
   pasted in a chat, a screenshot, a log, or a commit — rotate
   it in Supabase Settings → API immediately, then update the
   env var where it is used, then re-run the smoke checks
   (SETUP.md §6).
   `Choice:` rotating the key kills the leaked copy, which is
   the only fix that actually works after a leak.
6. **No secret in a URL, a log line, or an error message.**
   `Choice:` URLs are logged by browsers and servers, so a key
   in a query string is a key in a log file.
7. **The team has exactly one Supabase project per environment**
   (one for the hackathon demo; a second one only if a separate
   staging project is created deliberately).
   `Choice:` one project per environment means a demo key can
   never write to production data by accident.
8. **This file, and every `.md` in the repo, contains no real
   secret.** The values in the examples are `sb_publishable_…`
   / `sb_secret_…` placeholders.
   `Choice:` a doc is the most-copied file in a repo, so it must
   be safe to copy anywhere.

---

## 8. Security checklist — review before launch

Tick every box before the V2 launch (not before the hackathon
MVP — the MVP has no auth, so §8.1–§8.3 are the MVP boxes and
§8.4–§8.8 are V2-only). A box that cannot honestly be ticked is
a launch blocker, not a note for later.

### 8.1 MVP (hackathon) — no auth, still check these

- [ ] RLS is enabled on every table, and the anon key cannot
      UPDATE or DELETE readings, scores, flags, or baselines
      (DATABASE.md §7; PLAN 5.3).
- [ ] The service-role key is not in the browser, not in GitHub,
      not in a screenshot, and not in any `.md` file.
- [ ] `.env` is in `.gitignore` and `git status` is clean of
      secrets before every push.
- [ ] The API returns the standard error format (§ API.md 4) —
      no raw DB errors, no stack traces to the client.
- [ ] `Access-Control-Allow-Origin` is not `*` on any deployed
      (non-local) backend — or the exception is written down
      with its reason and an expiry date.
- [ ] The footer disclaimer ("Simulated data only · Decision
      support only · Not a medical device") is on every page
      and in the PDF.
- [ ] No diagnosis language anywhere (code, UI, API, PDF).

### 8.2 Auth flows (V2)

- [ ] Signup requires email confirmation before any write.
- [ ] Login shows one generic error for a bad email and a bad
      password (no user enumeration).
- [ ] Magic-link and reset links are single-use and expire in 1 hour.
- [ ] A password reset revokes all other sessions for that user.
- [ ] Logout revokes the refresh token; "log out on all devices"
      revokes all of them.
- [ ] OAuth never auto-creates an account.
- [ ] `profiles` rows are created server-side only — the browser
      cannot grant itself a role.

### 8.3 Tokens (V2)

- [ ] Access token lifetime is 1 hour; refresh token is 7 days,
      rotating, with a 30-day absolute limit.
- [ ] Tokens live in `httpOnly`, `Secure`, `SameSite=Lax`
      cookies — nothing in `localStorage` / `sessionStorage`.
- [ ] Refresh-token reuse revokes the whole token family.
- [ ] A role change revokes all refresh tokens for that user.
- [ ] The role is read from `profiles` on every request, never
      trusted from the token alone.

### 8.4 Passwords and rate limiting (V2)

- [ ] No password is stored, logged, or displayed in plain text.
- [ ] Passwords are hashed by Supabase Auth (bcrypt, cost 12+);
      the app hashes nothing itself.
- [ ] Password minimum is 12 characters; common passwords are
      rejected; the last 3 passwords cannot be reused.
- [ ] Login is throttled at 5 failed attempts / 15 min per
      IP+email (no account lockout by an attacker).
- [ ] Failed logins are logged (email hash + IP + time, never
      the password) and alert on a spike.

### 8.5 Browser protections (V2)

- [ ] CORS allow-list is only the production origin +
      `http://localhost:3000` in development; no `*` with credentials.
- [ ] CSRF double-submit token is required on POST / PATCH / DELETE.
- [ ] CSP header is set; `dangerouslySetInnerHTML`, `eval()`,
      and `innerHTML` with user data are absent from the codebase
      (grep for them before launch).
- [ ] All user content is rendered as text, never as HTML.

### 8.6 Input and data (V2)

- [ ] Every endpoint validates on the server (Zod schema per
      endpoint in the target; hand-written checks are not enough
      for V2).
- [ ] `sort_by` is an allow-list; no SQL is built from user input.
- [ ] A `400` is returned for out-of-range values — nothing is
      silently clamped in V2.
- [ ] Soft-deleted rows are invisible to the app (`deleted_at
      IS NULL` in every read policy).

### 8.7 Secrets (V2, and the MVP too)

- [ ] `.env.example` has placeholders only.
- [ ] Production secrets are in Vercel env vars, per environment.
- [ ] No secret appears in any `.md`, screenshot, log, URL, or
      error message in the repo.
- [ ] The rotation procedure (§7.2, rule 5) has been rehearsed
      once — rotate a test key and confirm the app still works.

### 8.8 Roles and audit (V2)

- [ ] The permissions matrix in §5 is enforced in the API
      **and** in RLS, and both agree (test: a wrong role gets
      `403`, an anon write to readings gets `403`).
- [ ] A flight surgeon sees only assigned missions and only
      synced rows (tested, not just read).
- [ ] Role grants happen only in the Supabase dashboard, never
      in the app.
- [ ] Role changes are written to an append-only audit log the
      app cannot rewrite.

---

## 9. What to do when something goes wrong (incident playbook)

1. **A key leaked:** rotate it immediately (Supabase Settings →
   API), update the env var, re-run the smoke checks. Do not
   debate whether the leak "counts" — rotate first.
   `Choice:` rotation is cheap and certain, while arguing about
   exposure is slow and wrong.
2. **A password is suspected compromised:** force a reset for
   that user, revoke all their sessions, and check the login
   log for other IPs.
   `Choice:` a forced reset plus revocation closes the account
   even if the attacker already has a valid token.
3. **An XSS is found:** fix the sink, deploy, then revoke all
   refresh tokens for all users (tokens were `httpOnly`, so
   theft is unlikely — revoke anyway, because "unlikely" is not
   proof).
   `Choice:` a global revocation is one re-login per user, which
   is cheaper than finding out later that a token was stolen.
4. **A role was granted wrongly:** remove it in the dashboard,
   revoke that user's tokens, and check the audit log for what
   they did with it.
   `Choice:` the audit log is the only way to know the blast
   radius, so it is read before anything is declared fixed.
5. **After any incident:** write one page — what happened, what
   was exposed, what was rotated, what changed so it cannot
   happen again — and link it from the README's security notes.
   `Choice:` an incident without a written lesson will happen
   again in the same way.

---

*AUTH_SECURITY.md v1.0 — 15 Nov 2026. V2 design only, for PLAN
Phase 6. The MVP has no auth (PRD §3, ARCHITECTURE §1.2 decision
5, API.md §3.1, DATABASE.md §7/§10): no login, no `users` table,
no passwords, no roles table, no JWT code in the delivered folder.
Roles and RLS are from API.md §3.1 and DATABASE.md §7 (V2);
rate limits for data are from API.md §5.4; auth rate limits in
§4.2 are proposed values to set when auth ships. OWASP references:
ASVS v4.0 and the OWASP Cheat Sheet Series (Authentication,
Password Storage, CSRF Prevention, XSS Prevention, Input
Validation). No plain-text password or secret appears in this
file. Source of truth: PRD > DESIGN > ARCHITECTURE > DATABASE >
API. If this file conflicts with one of those, that file wins.*
