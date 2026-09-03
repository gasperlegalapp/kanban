# Case Control

Case and task workflow for Gasper Legal. A two-level board, in the spirit of Businessmap, tailored to how the firm actually works:

- **Case board** per practice area (Probate, Guardianship) with the firm's own phases (Start Phase → Administration → Final Phase → Closed), swimlanes (Full Estate / No Admin, Paid / Indigent) and case types.
- **Task board** underneath, filtered to the selected case, with Backlog → Requested → In Progress → Waiting → Review → Blocked → Done and the Core / Assets / Litigation / Social Work lanes.
- Cases roll up their tasks and deadlines into a **health colour** (green / yellow / red), days in stage, open / overdue / review counts and the next deadline, so the whole caseload can be scanned without opening anything.
- **Templates** create the standard task set (with checklists) on every new case; extra sets (Land Sale, Litigation action, Financial asset) can be added to a case at any time.
- **Deadline rules** generate statutory deadlines (inventory due, fiduciary claim deadline, final account due) from the appointment date and move them if the date changes.
- Hearings and deadlines, comments, file attachments, per-case history (every stage move, skip reason, edit) and a firm-wide **calendar**.
- One-click **Open in Actionstep** link on every case.
- Daily **reminders** (in-app, and by email when configured) for upcoming and overdue deadlines and overdue tasks.
- **Roles**: attorneys can close/archive cases, manage users, templates and settings; staff can do everything else.

## Stack

Next.js 16 (App Router, server actions) · React 19 · TypeScript · Tailwind CSS 4 · Drizzle ORM · Postgres (Supabase in production, embedded PGlite for local development) · Supabase Auth and Storage · Resend for email · Vercel for hosting.

## Run it locally

Requires Node.js 20 or newer. The bundled `npm` on this machine was broken by the installer, so use pnpm through corepack:

```bash
corepack pnpm install
corepack pnpm dev
```

Open http://localhost:3000. With no `DATABASE_URL` set the app uses an embedded Postgres (PGlite) stored in `./.pglite`, creates the schema, and seeds the boards, templates, deadline rules and the five users. Sign-in is a "pick your name" screen in this mode.

Useful commands:

| Command | What it does |
| --- | --- |
| `corepack pnpm dev` | Development server |
| `corepack pnpm build && corepack pnpm start` | Production build and server |
| `corepack pnpm test` | Unit tests (health roll-up, deadline rules, Businessmap import mapping) |
| `corepack pnpm typecheck` / `corepack pnpm lint` | Type and lint checks |
| `corepack pnpm db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `corepack pnpm db:migrate` | Apply migrations and seed configuration (local or `DATABASE_URL`) |
| `corepack pnpm db:seed` | Re-run the configuration seed (never deletes anything) |
| `corepack pnpm import:businessmap` | Import the Businessmap export in `data/businessmap/` |

## Importing the Businessmap data

The firm's Businessmap boards were exported on 2 September 2026 into `data/businessmap/` (ignored by git because it contains client information). `corepack pnpm import:businessmap` turns it into cases, tasks, checklists, deadlines and comments:

- Case-workflow cards become cases in the matching stage and lane; custom fields map to county, fiduciary and will status; the court number is taken from the card's custom ID.
- Task-workflow cards become tasks on their parent case; asset cards under "Assets / Inventory" become sub-tasks; Businessmap subtasks become checklist items.
- Hearings / Deadlines cards become calendar entries.
- Loose Land Sale, Concealment, Heirship and Wrongful Death cards that had no parent case in Businessmap become their own cases, in a **Litigation** lane added for that purpose (Wrongful Death estates go to Full Estate). Rename or remove that lane in Settings if you do not want it.
- Every imported record keeps a link back to the original Businessmap card.

The import is safe to re-run; cards already imported are skipped.

## Going live (Supabase + Vercel)

**1. Create the database and sign-in (Supabase).** Supabase is a hosted Postgres database with built-in user sign-in and file storage; the free tier is enough for a firm this size.

1. Sign up at https://supabase.com and create a project (choose a region near Ohio, e.g. US East).
2. In *Project Settings → Database → Connection string*, copy the **Session pooler** URI. This is `DATABASE_URL`.
3. In *Project Settings → API*, copy the *Project URL* (`NEXT_PUBLIC_SUPABASE_URL`), the *anon / publishable* key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) and the *service_role* key (`SUPABASE_SERVICE_ROLE_KEY`, keep this one secret).
4. In *Authentication → URL Configuration*, set the Site URL to your app's address and add `https://<your-app>/auth/callback` to the redirect URLs.

**2. Load the schema and data.** On this machine, create `.env.local` from `.env.example`, paste the values above, then run:

```bash
corepack pnpm db:migrate
corepack pnpm import:businessmap
```

**3. Deploy (Vercel).** Push the repository to GitHub, import it in Vercel, add the same environment variables plus `NEXT_PUBLIC_APP_URL` (the deployed address) and `CRON_SECRET` (any long random string), and deploy. `vercel.json` schedules the reminder job every weekday at 12:00 UTC (7 or 8 am Eastern).

**4. Invite the team.** Sign in with the first attorney account: in Supabase *Authentication → Users*, "Add user" with the attorney's email and a password, making sure the email matches the one on the Users page in the app (edit it there first if needed). Once signed in, use **Users → Invite** to email everyone else a link to set their password.

**5. Email reminders (optional).** Create an account at https://resend.com, verify the firm's sending domain, and set `RESEND_API_KEY` and `REMINDER_FROM_EMAIL`. Without it, reminders still appear in the bell menu inside the app.

## Project layout

```
src/app                 Routes (boards, cases, calendar, templates, users, settings, login, API)
src/components          UI: board, case detail, task drawer, calendar, settings…
src/lib/actions         Server actions (all authorization checks live here)
src/lib/data            Read queries and roll-up assembly
src/lib/domain          Pure logic: health roll-up, deadline maths, constants
src/lib/services        Shared write logic: audit, templates, deadline sync, reminders
src/lib/import          Businessmap export → app records (unit tested)
src/db                  Drizzle schema, relations, seed data, database client
drizzle/                SQL migrations (generated)
scripts/                migrate, seed, import
```

## Conventions

- All writes go through server actions in `src/lib/actions`, which check the signed-in user and record an audit entry on the case.
- Metrics (health, counts, days in stage) are computed on read in `src/lib/domain/health.ts` and never stored.
- Never commit `.env*` files or anything under `data/`.
