# IMKAN Digital Portfolio Tracker

Production-oriented internal tracker for IMKAN digital transformation projects, built with Next.js, Carbon React, PostgreSQL, Drizzle ORM, Auth.js, and `pg-boss`.

## What’s Included

- Carbon-based app shell with `Dashboard`, `Projects`, `Project Details`, `Weekly Update`, `Reports`, and `Admin`.
- PostgreSQL schema for users, roles, projects, milestones, weekly updates, recipients, email runs, lookups, and audit logs.
- Workbook import from the existing IMKAN Excel tracker.
- Weekly update workflow that writes history and updates the project master snapshot automatically.
- Weekly and monthly project email delivery via SMTP with audit history.

## Stack

- Frontend: Next.js 16 App Router, React 19, Carbon React
- Backend: Next.js route handlers, Auth.js credentials auth
- Data: PostgreSQL 16, Drizzle ORM, Drizzle migrations
- Jobs: `pg-boss`
- Email: `nodemailer`

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Update `DATABASE_URL`, `NEXTAUTH_SECRET`, SMTP settings, and `WORKBOOK_IMPORT_PATH`.
3. Make sure PostgreSQL is running locally.

Set a unique administrator password before running `npm run db:seed`. Use HTTPS for the deployed `NEXTAUTH_URL` and configure SMTP with TLS for password resets.

Workbook imports create PM placeholders with randomly generated passwords. To enable sign-in for a placeholder or rotate an existing account, run the command below with the existing user ID and their verified work email, then have them use **Forgot password?** on the sign-in page. Project assignments are preserved.

```bash
node --import tsx scripts/provision-account.ts <user-uuid> <verified-work-email>
```

## Run Locally

```bash
npm install
npm run db:migrate
npm run db:seed
npm run import:workbook
npm run dev
```

Start the worker for scheduled emails and batch report generation. Install Chromium for PDF rendering:

```bash
npx playwright install chromium
npm run worker
```

The web app and worker need access to the same report directory. Set the same `REPORT_OUTPUT_DIR` on both processes when they run in separate containers. New batch reports are retained for 30 days.

## Deploy on Vercel and Supabase

Set `DATABASE_URL` to the Supabase transaction pooler URL for Vercel. Use a direct connection or the session pooler when applying migrations and running the persistent worker. Run `npm run db:migrate` against the intended database before opening the app to users. The app uses server-side Postgres access, and row-level security blocks direct access by the Supabase browser roles.

Configure `NEXTAUTH_URL`, a unique `NEXTAUTH_SECRET`, the administrator settings, and SMTP in Vercel's production environment. The workbook path is optional. Run the workbook import from a trusted machine with access to the source file.

Vercel Functions have temporary local storage. The current PDF batch worker needs persistent Chromium hosting and report storage that the web app can read. [Vercel runtime documentation](https://vercel.com/docs/functions/runtimes#file-system-support)

## Scripts

- `npm run dev` starts the web app
- `npm run build` creates a production build
- `npm run lint` runs ESLint
- `npm run test` runs Vitest unit/integration tests
- `npm run test:e2e` runs Playwright smoke tests
- `npm run db:generate` generates Drizzle SQL migrations
- `npm run db:migrate` applies migrations
- `npm run db:seed` ensures roles and the admin user exist
- `npm run import:workbook` imports the Excel tracker into PostgreSQL
- `npm run worker` starts the scheduled email and batch report worker

## Notes

- Workbook imports add missing projects and weekly history entries and preserve existing project records and updates.
- PMs can submit weekly updates; admins can import, manage all projects, and trigger email sends.
- Feature tracking lives in [docs/features/in-development.md](/Users/zulfiqar/Documents/projects/DigitalRoadmapProjectManagementSystem/docs/features/in-development.md) and [docs/features/roadmap.md](/Users/zulfiqar/Documents/projects/DigitalRoadmapProjectManagementSystem/docs/features/roadmap.md).
