# CLAUDE.md

Project context and rules for AI agents. This file is the single source of truth for the current state of the repo. Keep it current and concise.

Priority: explicit user instruction > this file > agent defaults.

---

## Project

- **Name:** Hochzeit-Website (Azure resources use the generic `name_prefix`, default `rsvptest`)
- **Purpose:** Wedding RSVP site: guests log in with credentials from their invitation and answer attendance, diet and allergies.
- **Stack:** Plain HTML/CSS/JS, Azure Functions v4 (Node 20, ESM) as SWA managed API, Cosmos DB for NoSQL, Terraform (azurerm ~> 4). German UI.
- **Entry point(s):** `src/index.html`, `src/rsvp.html`, `src/admin/index.html`; API `api/src/functions/index.js`. Full plan: `docs/PLAN.md`.
- **Dependencies:** api: `@azure/functions` (Functions runtime), `@azure/cosmos` (DB SDK). Root dev: `@azure/static-web-apps-cli` (local emulator + deploy), `azure-functions-core-tools` (runs the API locally).
- **Node:** installed from the official tarball in `~/.local/node20`, symlinked into `~/.local/bin`.

## Commands

- **Install:** `npm install && npm --prefix api install`
- **Dev:** `bash scripts/write-local-settings.sh` once (uses container `invitations-dev` in the deployed Cosmos), then `npm run dev` → http://localhost:4280
- **Test:** `npm test` (node:test in `api/test`)
- **Lint / format:** `terraform -chdir=infra fmt`
- **Build:** none (static files)
- **Deploy:** `npm run deploy` (terraform apply + `swa deploy`). Needs `infra/terraform.tfvars` (see `.example`); admin hash via `npm --prefix api run hash-password`.

---

## Rules

Bias: caution over speed. For trivial tasks, use judgment.

### 1. Think before coding

- State your assumptions. If you are unsure, ask.
- If a request has several interpretations, list them. Don't pick one silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop, name what is confusing, and ask before writing code.

### 2. Simplicity

- Write the minimum code that solves the problem.
- No features, options, or configurability beyond what was asked.
- No abstractions for single-use code.
- No error handling for impossible cases.
- If it could be half the size, rewrite it. Test: would a senior engineer call this overcomplicated?
- Match the existing style, even if you would do it differently.

### 3. Verification

- Turn every task into a check you can run:
  - "Fix the bug" -> write a test that reproduces it, then make it pass.
  - "Add validation" -> write tests for invalid input, then make them pass.
  - "Refactor X" -> tests pass before and after.
- For multi-step tasks, state a short plan first:
  `1. <step> -> verify: <check>`
- Loop until every check passes. Only then commit.

### 4. Comments

- One short sentence max. No exceptions.
- Only where the code is not self-explanatory. Explain *why*, never *what*.
- No commented-out code, no TODOs, no history notes. Those go in [Pitfalls](#pitfalls) or [Open Tasks](#open-tasks).
- Workarounds are the only place a comment is mandatory (see rule 8).

### 5. File length

- Soft limit: **~300 lines**. Exceeding it means refactor.
- One responsibility per file. Split by responsibility, not by line count.
- A file must be readable top to bottom without jumping around.

### 6. Memory (this file)

- Update this file whenever you change structure, commands, dependencies, or conventions.
- Add anything new you discover about the repo.
- Delete outdated information. This file describes the current state, not history.
- Keep entries short. If a section grows too large, condense it.

### 7. Pitfalls

- Document known issues, failed attempts, and workarounds in [Pitfalls](#pitfalls), not in code.
- Exception: at a workaround site, add one line:
  `// Workaround: <reason>. See CLAUDE.md#pitfalls`

### 8. Git

**Pushing**
- **Never push.** No `git push` in any form, no exceptions, even if a task seems to require it. Only the user pushes.

**When to commit**
- Commit only if a git repo exists (`git rev-parse --is-inside-work-tree`). Never run `git init`.
- Commit after each completed, working change: one logical change per commit, with tests passing.
- Stage specific files. No `git add -A` or `git add .` without checking `git status` first.
- Never commit secrets or build artifacts.
- Never commit a `.env` file. Variants such as `.env.example` may be committed. Staging `.env` is fine when needed, but unstage it with `git restore --staged <file>` before committing. Make sure `.gitignore` lists `.env`.

**Commit messages**
- One line, imperative mood, max 72 characters. Example: `Split auth service into token and session modules`
- Add a body only if the change can't be understood without one. The body is max 2 short lines.
- Never mention AI, Claude, agents, or any assisting tool. No `Co-Authored-By`, no `Generated with`, no `Claude-Session` trailers, no emoji signatures.

**Fixing mistakes**
- If a commit message mentions an AI tool anyway, undo it immediately:
  `git reset --soft HEAD~1`, then recommit with a clean message.
- Check with `git log -1 --format=%B` after every commit.
- If the `commit-msg` hook rejects a commit, rewrite the message. Never bypass the hook.
- Only rewrite your own unpushed commits. Never force anything, never use `--no-verify`, never rewrite history the user already has.

---

## Architecture

| Path | Purpose |
|------|---------|
| `src/` | Static frontend (SWA app location); `staticwebapp.config.json` sets CSP and Node 20 runtime |
| `src/css/theme.css` | Theme: light text directly on darkened wood, no cards (user preference); `admin.css` adds a light panel for tables |
| `src/favicon.*`, `src/apple-touch-icon.png` | Tab/home-screen icon (gold rings on wood brown); PNG/ICO rendered from `favicon.svg` with ImageMagick (flat colours only, it ignores gradients) |
| `src/images/` | SVG artwork: `wood.svg` (feTurbulence grain), `rings.svg`; `flowers-corner.svg` + `vine-*.svg` are generated (watercolor filter) |
| `src/js/` | One module per page (`home`, `rsvp`, `admin`) plus `api.js` fetch helper |
| `api/src/functions/index.js` | Registers HTTP routes, reads app settings, adapts requests |
| `api/src/handlers/` | Guest and admin handlers; take a `store` so tests use a fake |
| `api/src/lib/` | Passwords (scrypt), signed session cookies, invitation validation/summary/CSV, Cosmos store |
| `infra/` | Terraform: RG, Cosmos (free tier, capped 1000 RU/s), SWA Free, budget alert |
| `scripts/` | `deploy.sh`, `write-local-settings.sh`, `generate-florals.mjs` (`node scripts/generate-florals.mjs src/images`, seeded so output is stable) |

## Conventions

- **Language specifics:** Follow the path-scoped rules for each language (Python, JS/TS, Bash, Java, C#). Where they are silent, follow the language's standard style guide and the patterns already in the file.
- **Naming:** Use descriptive names over abbreviations, and the casing convention of the language. Booleans read as questions (`is_ready`, `hasAccess`). Functions are verbs, and types are nouns. Match the existing names in the codebase before introducing new patterns.
- **Error handling:** Validate input at system boundaries (CLI args, files, network, external APIs), and trust internal code. Fail fast with specific error types and messages that name the bad value. Keep the cause when wrapping errors. Never swallow errors silently (no empty catch blocks). Catch only what you can handle, and let the rest propagate.
- **Testing:** Use the test framework the project already uses. Every behavior change comes with a test. Tests are fast, deterministic, offline and independent of each other. Test behavior through public interfaces, not implementation details. Mock only at external boundaries (network, time, filesystem, subprocess).
- **Dependencies:** Prefer the standard library, then existing dependencies. Add a new one only if it saves substantial code, is actively maintained, and has a compatible license. Declare it in the project's manifest (`pyproject.toml`, `package.json`, `pom.xml`/`build.gradle`, `.csproj`) with a version constraint, use the lock file of the existing package manager, and keep dev-only tools out of the runtime dependencies. Record every new dependency and why it was added in this file.

---

## Pitfalls

### Known issues

- Azure Functions reserves the route prefix `admin`; admin API routes live under `/api/manage/*`.
- Only one Cosmos DB free-tier account per subscription; free tier can only be set at creation.
- `wood.svg` is not horizontally seamless: keep `background-size: max(1800px, 100%) auto` so it never repeats sideways (visible seam on wide screens).
- Venues (rsvp.html, after login): OSM iframes (no consent banner needed) + Google Maps route links; CSP allows `frame-src https://www.openstreetmap.org`.
- Guests add their own people (Vorname, Nachname, Zusage, Essen alles/vegetarisch, Allergien, max 10); admins only create the invitation login. Invitations carry `createdAt`, `updatedAt` (any change) and `respondedAt`; older records may lack `updatedAt`.
- Preview pages visually: serve a copy of `src/` on localhost and use `firefox --headless --screenshot` (snap Firefox cannot write to /tmp).
- Terraform state is local (`infra/terraform.tfstate`, gitignored) and holds secrets. Back it up or move to a remote backend before handing over.

### Attempted and rejected

- **Approach:** Cosmos DB in West Europe (the failed account stays behind in `Failed` state and must be deleted before retrying).
  **Result:** Rejected by Azure ("high demand"); `cosmos_location` defaults to `germanywestcentral`.
- **Approach:** SWA built-in auth.
  **Result:** Free plan only offers GitHub/Entra logins; we use our own scrypt + HMAC cookie login.

### Workarounds

- None.

---

## Open Tasks

- [ ] Ceremony/party start times and countdown hour (countdown assumes 14:00) in `src/*.html` (reason: times not provided yet)
- [ ] Add photos to `src/images/` and swap the `.photo-placeholder` (reason: photos come later)
- [ ] GitHub Actions deploy workflow (reason: deploy currently via `npm run deploy`)
