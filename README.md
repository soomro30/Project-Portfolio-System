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

Default seeded login after `npm run db:seed`:

- Email: `admin@imkan.local`
- Password: `ChangeMe123!`

Workbook-imported PM placeholder users are created as `firstname.lastname@imkan.local` using the same default password. Update them before real usage.

## Run Locally

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run import:workbook
npm run dev
```

Optional worker for scheduled emails:

```bash
npm run worker
```

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
- `npm run worker` starts the scheduled email worker

## Notes

- The Excel workbook is treated as a one-time import source for v1.
- PMs can submit weekly updates; admins can import, manage all projects, and trigger email sends.
- Feature tracking lives in [docs/features/in-development.md](/Users/zulfiqar/Documents/projects/DigitalRoadmapProjectManagementSystem/docs/features/in-development.md) and [docs/features/roadmap.md](/Users/zulfiqar/Documents/projects/DigitalRoadmapProjectManagementSystem/docs/features/roadmap.md).
