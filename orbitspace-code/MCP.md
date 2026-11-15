# OrbitCare — MCP.md

**How AI assistants connect to this project's tools through the
Model Context Protocol (MCP).**

**Version:** 1.0 — 15 Nov 2026
**Sources of truth:** `PRD.md` v1.0, `ARCHITECTURE.md` v1.0,
`DATABASE.md` v1.0, `API.md` v1.0, `AUTH_SECURITY.md` v1.0,
`SETUP.md` v1.0 (all 15 Nov 2026). If this file conflicts with
any of those, that file wins.
**Status:** design / setup guide only. No MCP server is currently
connected to this project, and there is no `.mcp.json` in the repo
yet — the snippets in §3 are templates to copy, not live config.

---

## 0. What MCP is, in one paragraph

The Model Context Protocol (MCP) is the standard way an AI
assistant (the **MCP client** — Claude Desktop, VS Code / Cursor,
or another MCP-capable assistant) talks to outside tools through
small programs called **MCP servers**. Each server exposes a
narrow set of **tools** (for example: "list the tables in Supabase",
"read this file", "open this page in a browser"). The assistant
asks the server to run a tool; the server runs it with only the
access it was given, and returns the result. The assistant never
gets the raw credentials, and the server never gets to decide what
to do on its own.

```
User
  │  "Show me Kenji on Day 63"
  ▼
AI assistant (MCP client)
  │  calls a tool
  ├─► Supabase MCP server ──► Supabase Postgres (read-only)
  ├─► Filesystem MCP server ──► orbitspace-code/ files
  ├─► GitHub MCP server ──► the repo (read / PRs)
  ├─► Browser MCP server ──► Chromium (opens the app)
  └─► Fetch MCP server ──► public docs / NASA Space Apps pages
```

**Why MCP for OrbitCare, in one line per reason:**

- The assistant can check the real database instead of guessing
  from the docs — so a Day-63 answer can be verified, not assumed.
  (`Choice:` live data beats a remembered summary.)
- The assistant can read and edit the exact project files instead
  of asking the user to paste them — so fixes land in the right file.
  (`Choice:` one scoped folder is safer and faster than a whole machine.)
- The assistant can open the running app in a real browser and
  see what a judge sees — so a broken page is caught before submission.
  (`Choice:` a screenshot of the live app is proof; a code review is not.)
- Every server gets only the access it needs, and nothing else —
  that is least privilege, and it is the whole point of §4.

**What MCP is not:** it is not a deployment, not a database, not
an auth system, and not a way around the rules in `AGENTS.md` or
`AUTH_SECURITY.md`. A tool call still needs the user's go-ahead
for anything destructive (§4.2), and a secret still never goes in
a file (§5).

**Prerequisites (tested 15 Nov 2026):** Node.js v24.22.1
(npm 10.9.4) — MCP servers here are run with `npx`, so Node 18+
is the minimum and Node 20+ is recommended. No other install is
needed; `npx` downloads each server on first use. Python is not
needed for MCP.

---

## 1. Which MCP servers are useful for this project, and why

Five servers. No more — every server is a new trust boundary, so
a server that is not on this list is not to be added without
updating this file first.

| # | Server | What it connects to | Why this project needs it | Risk if misconfigured |
|---|---|---|---|---|
| 1 | **Supabase** | The OrbitCare Supabase project (Postgres) | Check the real tables, row counts and Day-63 values; verify a seed; read a baseline — instead of trusting memory. This is the highest-value server for this project. | A write-mode server could change or delete mission data — so it runs **read-only** (§2.1). |
| 2 | **Filesystem** | The `orbitspace-code/` folder only | Read `server.js`, `schema.sql`, the docs, and the HTML/CSS/JS; write a fix to the exact file. Without it the assistant works from pasted copies that go stale. | An unscoped server could read the whole machine, including `backend/.env` — so it is scoped to one folder (§2.2). |
| 3 | **GitHub** | The OrbitCare repo (once pushed) | Read the repo, open issues, draft PRs, check CI — so the assistant's work can be reviewed as a PR instead of pasted in chat. | A token with write scope can push to `main` — so it gets the narrowest scope that still works (§2.3). |
| 4 | **Browser (Playwright)** | Chromium, headless | Open `http://localhost:8000` and `http://localhost:3000/api/health`, click Day 63, screenshot the Crew View — the incognito / judge's-eye check from PLAN 9.1, automated. | A browser server can reach any URL — so it is used only on local + project URLs, never to log in anywhere (§2.4). |
| 5 | **Fetch / Docs** | Public web pages (read-only) | Read the NASA Space Apps local-event page, the submission guide, and the reference repos' READMEs — so a deadline or a rule is checked against the live page, not remembered. | It can only read public pages — so it can never reach the Supabase dashboard or any logged-in page (§2.5). |

**Servers deliberately not used:**

- **A Postgres MCP server pointed directly at the database**
  is not needed — the Supabase server already covers it, and two
  database servers would be two ways to make the same mistake.
  (`Choice:` one database path is easier to audit than two.)
- **A terminal / shell MCP server is not used.**
  `Choice:` a shell server is effectively full access to the
  machine, which breaks least privilege for a project whose
  commands are all in `SETUP.md` already.
- **A Vercel / deploy MCP server is not used yet.**
  `Choice:` there is no Vercel project for the code version yet,
  so there is nothing for it to deploy to — add it only when a
  deploy exists, and update this file first.

---

## 2. The five servers, one by one

For each server: what it is, what it may touch, and what it may
never touch. The exact config for all five is in §3 — this section
is the human-readable version; §3 is the copy-paste version.

### 2.1 Supabase — the database, read-only

- **Package:** `@supabase/mcp-server-supabase@latest`
  (run with `npx`; no install step).
- **What it may touch:** the OrbitCare Supabase project only —
  the project whose URL is `https://<project-ref>.supabase.co`
  (the project created 15 Nov 2026; the project ref is the
  subdomain — see SETUP.md §4.1 for where to find it).
- **Mode: read-only, always.** The server is started with
  `--read-only`. In read-only mode it can list tables, describe
  a table, and run `SELECT` queries. It cannot `INSERT`,
  `UPDATE`, `DELETE`, `DROP`, or run `schema.sql`.
  `Choice:` read-only is the default because the assistant's
  job is to *check* the data, and a check should never be able
  to change it.
- **Credentials it needs:** a Supabase **personal access token**
  (from the Supabase dashboard → Account → Access Tokens), passed
  as the environment variable `SUPABASE_ACCESS_TOKEN`.
  That token is **not** the anon key and **not** the service-role
  key — it is a separate token that belongs to the person, and it
  is scoped to the projects that person can see.
  `Choice:` a personal access token is revocable per person, so
  a leaked token can be killed without rotating the project's keys.
- **What it may never touch:** the service-role key, the database
  password, any other Supabase project, or any table outside
  this project. It must never be given `--project-ref` for a
  production project that is not OrbitCare.
- **Allowed tools (read-only):** list tables, describe a table,
  run a `SELECT` query, explain a query plan.
  **Blocked tools (in read-only mode these do not exist, and if
  a future version offers them, they are blocked here):**
  any write query, any DDL (`CREATE / ALTER / DROP`), running
  `schema.sql`, seeding, and `POST /api/seed` through the
  database. A seed is a human-confirmed terminal command
  (`npm run seed`, SETUP.md §4.3), never an MCP tool call.

### 2.2 Filesystem — one folder, nothing else

- **Package:** `@modelcontextprotocol/server-filesystem`
  (run with `npx`).
- **What it may touch:** exactly one folder —
  `/absolute/path/to/orbitspace-code` (replace with the real
  path on the machine where the MCP client runs; it must be an
  absolute path, see §7, row 6). Inside it: the 5 HTML pages,
  `css/`, `js/`, `backend/`, and the `.md` docs.
- **What it may never touch:** anything outside that folder —
  in particular `backend/.env` is inside the folder, and it is
  still off-limits (see the blocked list below), as is
  `backend/node_modules/` (thousands of files the assistant
  has no reason to read).
  `Choice:` one folder is the smallest scope that still lets
  the assistant do the work, so a compromised server can only
  reach the project, not the machine.
- **Allowed tools:** read a file, list a directory, search
  files by text, write/edit a file the user asked for, create a
  new file the user asked for.
  **Blocked tools / actions:** reading `backend/.env` or
  `backend/.env.local` (or any `.env*` file), reading or writing
  anything outside the allowed folder, deleting a file,
  moving/renaming a file, and running any command. (There is no
  command tool on this server — deleting and running are not
  filesystem tools.)

### 2.3 GitHub — the repo, narrowest scope

- **Package:** `@modelcontextprotocol/server-github`
  (run with `npx`).
- **What it may touch:** the OrbitCare repo only, once the team
  pushes the code to GitHub. Until there is a repo URL, this
  server is configured but unused — do not point it at another
  repo (for example the StudyMate repo) by accident.
- **Credentials it needs:** a GitHub **personal access token
  (classic or fine-grained)** in the environment variable
  `GITHUB_PERSONAL_ACCESS_TOKEN`. Fine-grained is preferred:
  scope it to the one repo, with `Contents: read`, `Pull
  requests: read + write` (only if the team wants the assistant
  to draft PRs), `Issues: read + write`, `Actions: read`.
  Do **not** grant `Administration`, `Delete a repository`, or
  an all-repositories scope.
  `Choice:` a fine-grained token scoped to one repo means a
  leaked token can only touch that repo, and cannot delete it.
- **Allowed tools:** list / read a repo, read a file at a
  commit, list issues, create an issue, list PRs, create a
  draft PR, read a CI run.
  **Blocked tools / actions:** pushing directly to `main`,
  merging a PR, deleting a repo/branch, changing repo settings,
  approving a PR, and creating a release. A PR the assistant
  drafts is a draft until a human reviews and merges it.

### 2.4 Browser (Playwright) — Chromium, local + project URLs only

- **Package:** `@playwright/mcp@latest` (run with `npx`).
- **What it may touch:** the local app at
  `http://localhost:8000` and the local API at
  `http://localhost:3000`, plus the public project pages
  (NASA Space Apps local-event page, the deployed Vercel link
  once it exists). First run needs the browser binary:
  `npx playwright install chromium` (see §6.5).
- **What it may never touch:** any login page, any page that
  needs a password or a one-time code, the Supabase dashboard,
  GitHub settings, or any site that would spend money or send
  a message.
  `Choice:` a browser that never logs in cannot leak a session
  or take an action as the user, so it stays a reader of pages.
- **Allowed tools:** navigate to a URL, click, fill a form
  field on the local app (for example the self-check form),
  take a screenshot, read the page text, read console errors.
  **Blocked tools / actions:** signing in anywhere, submitting
  a form on a non-local site, downloading files, changing
  browser settings, and staying signed in between sessions.

### 2.5 Fetch / Docs — public pages, read-only

- **Package:** `@modelcontextprotocol/server-fetch`
  (run with `npx`; no credentials at all).
- **What it may touch:** public web pages only — the NASA Space
  Apps pages, the reference repos' READMEs on GitHub, the
  Supabase / Vercel public docs.
- **What it may never touch:** anything that needs a login,
  anything on `localhost` (use the Browser server for that),
  and any page that returns personal data.
  `Choice:` a server with no credentials at all cannot leak
  credentials, so it is the safest server on this list.
- **Allowed tools:** fetch a URL as text/markdown, fetch a page
  and follow its links.
  **Blocked tools / actions:** POSTing a form, submitting
  anything, and ignoring `robots.txt` — the server respects
  `robots.txt` by default, and this project does not override it.

---

## 3. Exact configuration

Copy this into the MCP client's config file. Do not edit the
package names or the flags — only replace the placeholders in
`<angle brackets>` and the `${ENV_VAR}` values in your own
environment (see §5 for where the real values live).

**Where the config file lives** (depends on the client — pick
the one you use; the JSON is the same):

| Client | Config file |
|---|---|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) · `%APPDATA%\Claude\claude_desktop_config.json` (Windows) · `~/.config/Claude/claude_desktop_config.json` (Linux) |
| VS Code (with the MCP extension) / Cursor | The workspace `.vscode/mcp.json`, or the user `mcp.json` — see that client's docs for the exact path |
| Any other MCP client | Its `mcpServers` setting — the JSON below is the standard shape |

**After editing the file, restart the MCP client.** A config
change is not picked up until the client restarts (see §6.1).

### 3.1 The full file (all five servers, copy-paste ready)

```json
{
  "mcpServers": {
    "orbitcare-supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--read-only",
        "--project-ref",
        "${SUPABASE_PROJECT_REF}"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}"
      }
    },
    "orbitcare-filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/absolute/path/to/orbitspace-code"
      ]
    },
    "orbitcare-github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    },
    "orbitcare-browser": {
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp@latest",
        "--browser",
        "chromium",
        "--headless"
      ]
    },
    "orbitcare-fetch": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-fetch"
      ]
    }
  }
}
```

**About the placeholders in that file:**

| Placeholder | What it is | Where the real value lives (never in this file) |
|---|---|---|
| `${SUPABASE_PROJECT_REF}` | The subdomain of the project URL: for `https://abcdefgh.supabase.co` it is `abcdefgh` | Supabase dashboard → project URL (SETUP.md §4.1). The value in the user's live project is the subdomain of the URL they saw on the project page — do not paste a real ref into a shared copy of this file. |
| `${SUPABASE_ACCESS_TOKEN}` | Supabase personal access token (Account → Access Tokens) | The person's own environment (§5). Create one per person; revoke it when they leave the team. |
| `/absolute/path/to/orbitspace-code` | The absolute path to the unzipped / cloned `orbitspace-code` folder on the machine running the MCP client | The machine's own filesystem. It must be absolute, not relative (see §7, row 6). |
| `${GITHUB_PERSONAL_ACCESS_TOKEN}` | GitHub fine-grained personal access token (§2.3) | The person's own environment (§5). Never commit it, never paste it into a shared config. |

### 3.2 Per-server snippets (add one server at a time)

Add servers one at a time, test each one (§6), and only then add the
next. If you only need one server today, copy only its block.

**Supabase only:**

```json
{
  "mcpServers": {
    "orbitcare-supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--read-only",
        "--project-ref",
        "${SUPABASE_PROJECT_REF}"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}"
      }
    }
  }
}
```

**Filesystem only:**

```json
{
  "mcpServers": {
    "orbitcare-filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/absolute/path/to/orbitspace-code"
      ]
    }
  }
}
```

**GitHub only:**

```json
{
  "mcpServers": {
    "orbitcare-github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

**Browser only:**

```json
{
  "mcpServers": {
    "orbitcare-browser": {
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp@latest",
        "--browser",
        "chromium",
        "--headless"
      ]
    }
  }
}
```

**Fetch only:**

```json
{
  "mcpServers": {
    "orbitcare-fetch": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-fetch"
      ]
    }
  }
}
```

### 3.3 What is deliberately not in the config

- **No `SUPABASE_SERVICE_ROLE_KEY`, no anon key, no database
  password.** The Supabase MCP server does not need them — it
  uses the personal access token. If a config you find online
  puts the service-role key in an MCP server's `env`, do not
  use it. (`Choice:` a server that only reads should never hold
  the key that can rewrite the database.)
- **No real token, key, or path.** Every secret is a
  `${PLACEHOLDER}`. If a real value ever appears in a config
  file, rotate that credential immediately (AUTH_SECURITY.md §7.2).
- **No `--write` / non-read-only flag on the Supabase server.**
  Removing `--read-only` is a deliberate, separate decision —
  it needs the user to say so explicitly, and this file must be
  updated first. Do not do it for the hackathon.
- **No shell / terminal server.** See §1 — it is deliberately absent.

---

## 4. Which tools the AI is allowed to call, and which are blocked

Tool names below are the capabilities as exposed by each server.
Exact tool names can differ by server version — ask the server
itself (`tools/list` in the client) if a name does not match, and
update this file with the version you tested against.

### 4.1 Allowed — the default set

| Server | Allowed tools (read / check) | Allowed tools (write — only with a user go-ahead, §4.2) |
|---|---|---|
| Supabase | `list_tables`, `describe_table`, `execute_sql` for `SELECT` only, `explain_query` | **None.** In read-only mode there are no write tools. |
| Filesystem | `read_file`, `list_directory`, `search_files` | `write_file`, `edit_file`, `create_file` — only for a file the user named, and only the change the user asked for |
| GitHub | `read_repo`, `read_file_at_commit`, `list_issues`, `list_pull_requests`, `read_ci_run` | `create_issue`, `create_draft_pull_request` — draft only, never merge, never push to `main` |
| Browser | `navigate`, `click`, `fill` (local app only), `screenshot`, `get_page_text`, `get_console_errors` | `fill` + `submit` on the **local** app only (for example the self-check form) |
| Fetch | `fetch_url`, `fetch_page_links` | **None.** Fetch is read-only by design. |

### 4.2 Blocked — always, for every server

These are blocked even if the server technically offers them, and
even if the user asks once in passing. Unblocking one needs a
change to this file and an explicit decision, not a single message.

- **Delete anything:** no file delete, no row delete, no branch
  delete, no repo delete, no `DROP TABLE`.
- **Run DDL or a migration:** no `CREATE / ALTER / DROP`, no
  running `schema.sql`, no migration runner through MCP.
- **Seed or reseed the database:** `npm run seed` and
  `POST /api/seed` are terminal / API actions, never MCP tools.
- **Write to the database through the Supabase server:** the
  server is read-only; a write is a different tool, on a
  different day, with a different config.
- **Read a secret:** no `backend/.env`, no `.env*`, no key, no
  token, no password — from any server, including the filesystem
  server that can see the folder the file sits in.
- **Push to `main`, merge a PR, change repo settings, approve
  a PR, create a release.**
- **Sign in anywhere, or submit a form on a non-local site.**
- **Spend money, send a message, or contact a person** (email,
  chat, issue comment that @-mentions someone) without a fresh,
  explicit go-ahead for that exact message.
- **Run a shell command.** There is no shell server on this list.
- **Change this file's rules, or the rules in `AGENTS.md` /
  `AUTH_SECURITY.md`, through a tool call.** Rules change by
  editing the file as a human decision, not by an MCP call.

### 4.3 Permission and safety rules

**The default is read-only.**

1. **Read first, write never — unless asked.**
   `Choice:` a read cannot break the project, so reads need no
   confirmation; a write can, so it always does.
2. **Confirm before every destructive action, in plain words,
   naming the exact thing.**
   The assistant must say what it will change, in which file /
   table / repo, and wait for a "yes" before it does it. "Shall
   I fix the files?" is not a confirmation — "Shall I edit
   `backend/server.js` line 42 to change X to Y?" is.
   `Choice:` a specific confirmation is the only one that can
   be checked afterwards, so a vague one is not a confirmation.
3. **One change at a time, then verify.**
   `Choice:` a small, verified change can be undone, while a
   batch of changes cannot be untangled when one of them is wrong.
4. **Never run a write tool on a guess.**
   If the file, table, or repo is not certain, the assistant
   asks first. A wrong guess with a read is a wasted call; a
   wrong guess with a write is damage.
5. **The user can stop any tool call.**
   If the user says "wait", "stop", or "don't do that", the
   assistant stops immediately and does not retry the same call
   through another server.
6. **Least privilege is re-checked, not assumed.**
   Once a month, or whenever a person leaves the team: revoke
   their Supabase access token and their GitHub token, and
   re-check the filesystem path is still only `orbitspace-code/`.
   `Choice:` a permission that is never re-checked is a
   permission that quietly grows.
7. **Logs are kept, secrets are not.**
   The assistant may keep a log of which tools it called and
   what they returned, but never a log containing a key, a token,
   a password, or the contents of `.env`.
   `Choice:` a log without secrets is safe to keep and to show
   a teammate, while a log with a secret is a leak.
8. **If a tool returns something surprising, stop and show the
   user — do not work around it.**
   A `403`, an empty table that should have 540 rows, or a file
   that looks different from the docs is a signal, not a prompt
   to try a different server to get the same data another way.

---

## 5. Secrets for MCP — where the real values live

The rule from AUTH_SECURITY.md §7 applies here word for word:
a secret lives in exactly one place — the environment of the
machine that needs it — and nowhere else.

| Secret | Set it where | Never put it where |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | The MCP client's own environment: the client's `.env` file (outside the repo), the OS keychain / secret store, or the `env` block of the user's **private** copy of the config — never the copy in the repo | In `MCP.md`, in `.mcp.json` in the repo, in GitHub, in a chat, in a screenshot |
| `SUPABASE_PROJECT_REF` | Same as above (it is a public identifier, but it still belongs in env, not hard-coded in a shared file) | In a shared config with a real value — use `${SUPABASE_PROJECT_REF}` in shared copies |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Same as above | In the repo, in a PR, in a chat |
| `SUPABASE_SERVICE_ROLE_KEY` | **Nowhere in MCP.** It is not an MCP credential at all (SETUP.md §3.3) | In any MCP server's `env` — if a guide tells you to, that guide is wrong for this project |

- **How to set a value (Mac / Linux, in the shell that starts
  the MCP client):**

```bash
export SUPABASE_ACCESS_TOKEN="<paste-your-token-here>"
export SUPABASE_PROJECT_REF="<your-project-ref>"
export GITHUB_PERSONAL_ACCESS_TOKEN="<paste-your-token-here>"
```

- **How to set a value (Windows, PowerShell):**

```powershell
$env:SUPABASE_ACCESS_TOKEN="<paste-your-token-here>"
$env:SUPABASE_PROJECT_REF="<your-project-ref>"
$env:GITHUB_PERSONAL_ACCESS_TOKEN="<paste-your-token-here>"
```

- **Do not put these `export` lines in a file inside the repo.**
  `Choice:` a shell history file outside the repo is the user's
  own, while a file inside the repo is one `git add .` from public.
- **Rotate a token the moment it is pasted in a shared place:**
  Supabase dashboard → Account → Access Tokens → revoke;
  GitHub → Settings → Developer settings → Personal access
  tokens → revoke. Then set the new value and restart the MCP
  client.
  `Choice:` revoking first is the only fix that works after a
  leak — deleting the message afterwards does not un-share it.

---

## 6. How to test that each connection works

Add one server, restart the client, run its test, and only then
add the next server. A test that passes proves the server works;
a test that fails is a §7 problem, not a reason to add more servers.

### 6.1 Test the client itself (do this first, once)

- Restart the MCP client after editing the config.
- Ask the assistant: "List the MCP servers you can see and the
  tools each one offers."
- **Expected:** it lists the servers you configured, and no
  others. If a server is missing, see §7.1. If a server you did
  not configure appears, remove it before doing anything else.

### 6.2 Supabase — "Show me the real data"

Ask the assistant:

> "Using the Supabase server, list the tables in the OrbitCare
> project, then count the rows in `daily_readings`."

- **Expected:** 4 tables — `crew`, `baselines`,
  `daily_readings`, `self_checks` (the delivered 4-table schema)
  — and `daily_readings` has **540 rows** after seeding.
  (The 13-table DATABASE.md design is the target, not the
  delivered schema — see SETUP.md. If the assistant reports
  13 tables, it is looking at the wrong project.)
- **Also try:** "What is Kenji's sleep on Day 63, and what is
  his baseline for sleep?" — the answer should be a `SELECT`
  result, with the value and the baseline, not a remembered number.
- **Fails if:** the row count is 0 (not seeded — run SETUP.md
  §4.3), the tables are missing (schema.sql not run), or the
  server returns an auth error (see §7.2).

### 6.3 Filesystem — "Read the exact file"

Ask the assistant:

> "Using the filesystem server, read `backend/supabase/schema.sql`
> and tell me how many tables it creates."

- **Expected:** it reads the file from `orbitspace-code/` and
  answers **4 tables** (`crew`, `baselines`, `daily_readings`,
  `self_checks`), quoting the file.
- **Also try:** "List the files in `backend/`." — it should list
  `package.json`, `server.js`, `seed.js`, `lib/`, `supabase/`,
  `.env.example` — and it must **not** list the contents of
  `.env` (see §6.7).
- **Fails if:** the assistant says it cannot see the folder
  (see §7.4), or it reads a different folder's files.

### 6.4 GitHub — "Show me the repo"

Ask the assistant (only once the repo exists):

> "Using the GitHub server, list the files in the repo root, and
> tell me the latest commit."

- **Expected:** the repo's files, and the latest commit's
  message and date. The assistant must not offer to push.
- **Fails if:** the repo is not found (wrong repo name — the
  server has no filtering, so check the name), or a `403`
  (see §7.6).

### 6.5 Browser — "Open the app and show me Day 63"

First, on the machine running the MCP client, install the
browser binary once:

```bash
npx playwright install chromium
```

Then start the two local servers (SETUP.md §5), and ask the
assistant:

> "Using the browser server, open http://localhost:8000/,
> click 'Day 63', and screenshot the Crew View."

- **Expected:** a screenshot showing Kenji first, Watch.
  (In the delivered code the score is 79; the PRD target is 78
  — same Watch band, see FEATURES.md §1.)
- **Also try:** "Open http://localhost:3000/api/health and
  tell me what it returns." — expected:
  `{"ok":true,"storage":"supabase","dailyReadings":540,
  "seeded":true}`.
- **Fails if:** the page does not load (the servers are not
  running — start them first), or the browser binary is missing
  (see §7, row 10).

### 6.6 Fetch — "Check the live page"

Ask the assistant:

> "Using the fetch server, fetch the Harohalli local-event page
> and tell me Sunday's gates-close time."

- **Expected:** the page text, with Sunday gates closing at
  16:00 (per the page checked 14 Nov 2026 — if the page says
  something else now, the page wins, and this file should be
  updated).
- **Fails if:** the page returns a 403 or a login wall (see §7.7).

### 6.7 The negative tests (these must also pass)

A connection that only passes the positive tests is not proven
safe. Run these too, once:

- "Read `backend/.env`." → the assistant must **refuse** or the
  filesystem server must return an error — the file's contents
  must never appear in chat.
- "Using the Supabase server, delete one row from
  `daily_readings`." → the assistant must **refuse** (read-only).
- "Push this change to `main`." → the assistant must **ask for
  confirmation first**, and must not push without it (see §4.2).

If any negative test fails — if a secret appears, or a delete
runs — stop, remove that server from the config, rotate the
affected credential (§5), and fix the config before using MCP again.

---

## 7. Troubleshooting — common connection errors

Each error: what you see, the likely cause, and the fix.
Work top to bottom; do not skip to adding another server.

| # | What you see | Likely cause | Fix |
|---|---|---|---|
| 1 | A server does not appear in the client's server list at all | The config file was not reloaded, or its JSON is invalid | Restart the MCP client. Then validate the JSON: `node -e "JSON.parse(require('fs').readFileSync('<config-file>','utf8')); console.log('JSON OK')"` — fix the first syntax error it reports (usually a missing comma or a trailing comma). |
| 2 | `npx: command not found` / `node: command not found` | Node.js is not installed, or not on `PATH` in the shell that starts the client | Install Node LTS (https://nodejs.org — tested: v24.22.1), close and reopen the terminal / client, re-run `node -v`. MCP servers here need Node 18+ (20+ recommended). |
| 3 | Supabase server: `401` / `Unauthorized` / "Invalid access token" | `SUPABASE_ACCESS_TOKEN` is missing, wrong, or expired/revoked | Check the variable is set in the client's environment (`echo $SUPABASE_ACCESS_TOKEN` — it should print a value, not an empty line; do not paste the value anywhere else). Create a fresh token in the Supabase dashboard → Account → Access Tokens, set it, restart the client. Never use the anon key or the service-role key here. |
| 4 | Supabase server: "Project not found" / wrong tables listed | `SUPABASE_PROJECT_REF` is wrong, or the token belongs to a different account | Check the ref is the subdomain of the project URL (`https://<ref>.supabase.co`, SETUP.md §4.1). Log in to the dashboard with the same account that owns the token and confirm the project is there. |
| 5 | Supabase server: tables exist but row counts are 0 | The project was created but never seeded, or the seed ran on a different project | Run the seed (SETUP.md §4.3): `cd backend && npm run seed` — expected `Seeded Supabase: 3 crew, 3 baselines, 540 daily readings.` Then re-run the §6.2 test. |
| 6 | Filesystem server: "Directory not found" / "Access denied" / the assistant reads the wrong folder | The path in the config is relative, has a typo, or points at a folder the client cannot read | Use an **absolute** path (`/Users/<you>/…` on Mac, `C:\Users\<you>\…` on Windows, `/home/<you>/…` on Linux), with no `~` and no trailing slash. Confirm the folder exists with `ls <path>` / `dir <path>` first, then restart the client. |
| 7 | Filesystem server: the assistant can read `.env` | The server is scoped correctly but the blocked-file rule was not enforced — or the folder contains a copy of `.env` outside `backend/` | Stop. Remove the server from the config, check `backend/.env` is still in `.gitignore`, and do not ask the assistant to read it again. The filesystem server's allowed folder is correct; the rule is that `.env*` is never a readable tool target (§4.2) — enforce it by refusing, not by moving the file. |
| 8 | GitHub server: `403` / "Resource not accessible by integration" | The token's scope is too narrow, or it is a fine-grained token scoped to a different repo | Check the token is scoped to the OrbitCare repo with `Contents: read` (and `Pull requests` / `Issues` only if needed). This is the same `403` the StudyMate GitHub push hit on 13 Nov 2026 when the app had not been granted write access to the repo — the fix is the same: grant the token/app access to that repo, then retry. |
| 9 | GitHub server: "Repository not found" | The repo does not exist yet, or the name is wrong | The OrbitCare code has not been pushed to a GitHub repo yet — there is no URL to point at. Do not point the server at another repo (for example StudyMate) to "test" it; create the repo first, then test. |
| 10 | Browser server: "Executable doesn't exist" / "Chromium not found" | The Playwright browser binary was never installed | Run `npx playwright install chromium` once on the machine running the client, then restart the client and re-run the §6.5 test. |
| 11 | Browser server: the page does not load / `ERR_CONNECTION_REFUSED` | The local servers are not running | Start them (SETUP.md §5): Terminal 1 `cd backend && npm start`, Terminal 2 `python3 -m http.server 8000` in the repo root. Then re-run the §6.5 test. `curl http://localhost:3000/api/health` should return `{"ok":true,…}` first. |
| 12 | Fetch server: `403` / a login wall / empty page | The page needs a login, or it blocks bots | Fetch only reads public pages. If the page needs a login (Supabase dashboard, GitHub settings), do not use Fetch — open it in a browser yourself. If it is a public page that blocks bots, check the URL is exact and try once more; do not override `robots.txt`. |
| 13 | `env` variables are empty inside the client, but they work in the terminal | The client was started from a launcher / Dock icon, not from the shell where the variables were exported | Start the MCP client from the same terminal where you ran the `export` commands, or set the variables in the client's own settings / `.env` file (outside the repo). Restart the client after setting them. |
| 14 | Everything was working, then it stopped after an update | A server package changed its tool names or its flags in a new version | Pin the version: replace `@latest` in the config with the version you tested against (for example `@supabase/mcp-server-supabase@0.2.0`), restart, and re-run §6. Then update this file with the new version and any renamed tools. Do not keep `@latest` on a server that a demo depends on. |

---

## 8. Checklist — before using MCP on this project

- [ ] Node 18+ is installed (`node -v` prints v18 or newer).
- [ ] The config file is valid JSON and the client was restarted after editing it.
- [ ] Only the five servers in §1 are configured — no shell server, no extra database server.
- [ ] The Supabase server has `--read-only` in its args.
- [ ] The filesystem server's path is absolute and is only `orbitspace-code/`.
- [ ] All secrets are `${PLACEHOLDER}`s in the shared config, and the real values live only in the user's own environment (§5).
- [ ] The service-role key appears **nowhere** in any MCP config.
- [ ] The §6.2–§6.6 positive tests pass, and the §6.7 negative tests pass (`.env` refused, delete refused, push asks first).
- [ ] The team knows the rules in §4: read-only by default, confirm before any destructive action, stop on "wait".

---

*End of MCP.md v1.0 — 15 Nov 2026. No MCP server is connected
yet; this file is the setup guide for when the team chooses to
connect one. Config snippets are templates with `${PLACEHOLDER}`
values only — no real API key, token, project ref, or path is in
this file. Least privilege throughout: read-only by default, one
folder, one repo, one project. Source of truth: PRD > DESIGN >
ARCHITECTURE > DATABASE > API > AUTH_SECURITY. If this file
conflicts with one of those, that file wins.*
