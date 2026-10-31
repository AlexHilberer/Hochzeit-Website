# Hochzeit-Website – Plan from Start to Launch

## Context
We want a wedding website where invited guests log in with a username and password printed on their invitation. After logging in they fill in an RSVP form: are they coming, which food they want (meat / vegetarian / vegan), and any allergies. The look should be romantic with a **wood theme**, and we'll add photos later. Everything runs on **Azure free tiers**. The site is **German only**. It has a **full admin UI** where we create invitations, generate login details and see the answers. It uses the free `*.azurestaticapps.net` web address (no own domain).

The project folder is currently empty (only `CLAUDE.md`) and isn't a git repo yet.

---

## 1. Architecture (all free)

```
Browser ──► Azure Static Web Apps (Free)
              ├─ static files: HTML / CSS / JS / photos
              └─ /api/*  ──► managed Azure Functions (Node 20, included in SWA Free)
                                 └──► Azure Cosmos DB for NoSQL (Free Tier)
GitHub repo ──(GitHub Actions, auto-created by SWA)──► deploy on every push to main
```

| Need | Azure service | Free allowance | Why this one |
|------|---------------|----------------|--------------|
| Hosting + HTTPS | **Static Web Apps – Free plan** | 100 GB traffic/month, 250 MB app size, free SSL | Better than App Service F1, which goes to sleep, has 60 CPU-min/day and no SSL on custom domains |
| Backend API | **Managed Functions inside SWA** | Included | No separate Function App or storage account needed |
| Database | **Cosmos DB for NoSQL – Free Tier** | Free forever: 1000 RU/s + 25 GB | Fits "one document per invitation" naturally. Only **one** free-tier account per subscription, and it must be switched on **when the account is created** |
| Secrets | SWA application settings | Included | Key Vault isn't needed at this size |
| Photos | In the repo under `/src/images` (compressed) | Counts toward 250 MB | If it gets too big later: Blob Storage (5 GB free for 12 months) |

**Login:** SWA Free's built-in auth only offers GitHub or Microsoft logins. Our guests need username + password, so we build a small login of our own:
- Passwords are stored only as a **scrypt hash** (Node's built-in `crypto`, no extra library).
- After login the server sets an **HttpOnly, Secure, SameSite=Strict cookie** with an HMAC-signed token (also built-in `crypto`), valid for 30 days.
- Admin = a separate login. The admin password hash and the token secret live in app settings.
- Brute-force risk is low: generated passwords are random and 10+ characters, and each failed login adds a short delay.

---

## 2. Data model (Cosmos DB, database `wedding`, container `invitations`, partition key `/id`)

```json
{
  "id": "inv_8f3k2",
  "username": "mueller-familie",
  "passwordHash": "scrypt$…",
  "displayName": "Familie Müller",
  "guests": [
    { "name": "Anna Müller", "attending": true,  "diet": "vegetarisch", "allergies": "Nüsse" },
    { "name": "Tom Müller",  "attending": false, "diet": null,          "allergies": "" }
  ],
  "message": "Wir freuen uns!",
  "respondedAt": "2026-11-05T18:22:00Z",
  "createdAt": "…"
}
```
- One invitation holds 1..n guests. The admin enters the guest names in advance; the guests only fill in their answers.
- `diet` can be: `alles` / `vegetarisch` / `vegan`.
- Usernames are unique, checked in the API before saving (the partition key stays `/id`).

---

## 3. Repo structure

```
/src                         static frontend (SWA app_location)
  index.html                 welcome + login
  rsvp.html                  RSVP form (needs guest cookie)
  admin/index.html           admin login + dashboard
  css/theme.css              wood theme, typography, layout
  js/login.js  js/rsvp.js  js/admin.js
  images/                    wood texture, decorations, photos later
/api                         Azure Functions (SWA api_location), Node 20, ESM
  package.json  host.json
  src/functions/
    auth.js                  POST /api/login, POST /api/logout
    rsvp.js                  GET/PUT /api/rsvp
    admin.js                 /api/admin/login, invitations CRUD, reset-password, export.csv
  src/lib/
    passwords.js             scrypt hash/verify + random password generator
    session.js               sign/verify cookie token, requireGuest/requireAdmin
    db.js                    Cosmos client + invitation queries
  test/                      node:test unit tests
staticwebapp.config.json     routes, security headers, 404 fallback
scripts/hash-admin-password.js   creates the ADMIN_PASSWORD_HASH value once
docs/PLAN.md                 a copy of this plan
```
Dependencies (api): `@azure/functions`, `@azure/cosmos`. Dev only: `@azure/static-web-apps-cli`, `azure-functions-core-tools`. Tests use the built-in `node:test`, so no test framework is needed.

---

## 4. API

| Method | Route | Who | What it does |
|--------|-------|-----|--------------|
| POST | `/api/login` | public | `{username,password}` → sets guest cookie |
| POST | `/api/logout` | any | clears the cookie |
| GET | `/api/rsvp` | guest | returns own invitation (no hash) |
| PUT | `/api/rsvp` | guest | saves answers (validated: only known guests, allowed diet values, text length limits) and sets `respondedAt` |
| POST | `/api/admin/login` | public | admin password → admin cookie |
| GET | `/api/admin/invitations` | admin | lists all invitations + answers + summary (how many coming, vegetarian/vegan counts, list of allergies) |
| POST | `/api/admin/invitations` | admin | creates an invitation, generates username + password, returns the password **once** |
| PUT/DELETE | `/api/admin/invitations/{id}` | admin | edits names/guests or deletes |
| POST | `/api/admin/invitations/{id}/reset-password` | admin | makes a new password and shows it once |
| GET | `/api/admin/export.csv` | admin | CSV with one row per guest (opens in Excel) |

---

## 5. Frontend & design (wood theme)

- **Look:** a warm wood-plank background (texture image plus a dark overlay). The content sits on cream "paper" cards with soft shadows. Accents are greenery/eucalyptus green and kraft brown, with thin gold lines.
- **Fonts (Google Fonts):** *Great Vibes* for names and headings, *Cormorant Garamond* for body text.
- **Pages:**
  1. `index.html` – Hero: names, date, place, countdown, photo placeholder, login form.
  2. `rsvp.html` – "Hallo Familie Müller!" One card per guest with Zusage/Absage toggles, food choice and an allergies field, plus a message to the couple and a save button. After saving: a thank-you message, and the answers can be changed until the deadline.
  3. `admin/` – summary tiles (Zusagen / Absagen / offen / vegetarisch / vegan), a table of invitations, a "Neue Einladung" dialog that shows the generated login details with a print/copy button, plus edit, delete, reset password and CSV export.
- Works on phones first (most guests will open it on a phone), and keeps good contrast so it's easy to read.
- **Photo slots** are marked in the HTML (`images/hero.jpg`, `images/gallery/*`), so photos can simply be dropped in later.

---

## 6. Build steps (each step ends with a check)

1. Set up the project: `package.json` files, `.gitignore` (`node_modules`, `.env`, `local.settings.json`), fill in `CLAUDE.md`, copy this plan to `docs/PLAN.md` → check: `npm install` runs cleanly.
2. Write `passwords.js` and `session.js` with unit tests → check: `npm test` passes (hashing works, wrong passwords are rejected, changed or expired tokens are rejected).
3. Write `db.js`, then the guest API (`login`, `rsvp`), with tests where the database is replaced by a fake → check: `npm test` passes.
4. Write the admin API including CSV export, plus tests → check: `npm test` passes.
5. Build the frontend pages and the wood theme → check: run locally with `swa start src --api-location api`, then log in, submit the RSVP, and check it in the admin page.
6. Add `staticwebapp.config.json` (security headers, routes) → check: the API rejects requests without a cookie (401).
7. Set up Azure (section 7) and deploy → check: the full flow works on the live URL.

**Local development:** SWA CLI plus Functions Core Tools. For the database, either use the Cosmos DB Linux emulator (Docker) or point at the free cloud Cosmos account with a separate `wedding-dev` database.

---

## 7. Azure setup (step by step)

1. Create a resource group, e.g. `rg-hochzeit` in *West Europe*.
2. **Cosmos DB:** create an account → API *NoSQL* → **"Apply Free Tier Discount: Apply"** → capacity mode *Provisioned throughput*. Create database `wedding` with **shared 1000 RU/s** (keeps us inside the free allowance), then container `invitations` with partition key `/id`.
3. **Static Web App:** create → plan *Free* → source *GitHub* → app location `src`, api location `api`, output location empty. Azure then adds a GitHub Actions workflow to the repo automatically.
4. Add these SWA application settings: `COSMOS_CONNECTION_STRING`, `SESSION_SECRET` (random, 32+ bytes), `ADMIN_PASSWORD_HASH`.
5. Set a **cost budget alert** of €1 on the subscription, as a safety net.
6. Pushing to `main` builds and deploys automatically (you push yourself; I never push).

Expected cost: **€0/month**.

---

## 8. What I need from you

**Accounts / access**
- [ ] An Azure subscription (a free account is fine) where **no other Cosmos DB free-tier account exists** yet
- [ ] A GitHub account + an empty repo, connected to the Static Web App
- [ ] Run `git init` in the project folder yourself (I'm not allowed to), or tell me to work without git for now

**Content**
- [ ] Your names, the wedding date, time, location(s) and schedule
- [ ] The RSVP deadline (after it the form is read-only)
- [ ] Confirm the form fields: coming yes/no, food (alles/vegetarisch/vegan), allergies, message. Anything else? (e.g. children's meals, overnight stay, song request, need a ride)
- [ ] The guest list: invitation name plus the people in each invitation (you can also type it into the admin UI later)
- [ ] Photos later: hero image + gallery (JPG, I'll compress them)
- [ ] Optional: colour wishes (light or dark wood, accent colour)

---

## 9. Verification (end to end)
- `cd api && npm test`: all unit tests pass (passwords, session tokens, input validation, API handlers with a fake database).
- Local: `swa start`. Create an invitation as admin, log in as the guest with the generated login details, submit the RSVP, check that it shows in the admin table and in the CSV.
- Negative cases: wrong password → error message; calling `/api/rsvp` without a cookie → 401; calling the admin API with a guest cookie → 403.
- Live on Azure: repeat the same flow on the `*.azurestaticapps.net` URL, and check on a phone.
- Check the Azure Portal's cost analysis after a few days: €0.
