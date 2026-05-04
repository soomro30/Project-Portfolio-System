# Roadmap

This roadmap captures product and technical work not yet complete. It is intended for the next developer or delivery team to understand where the system should go after the current v1 build.

## Identity and Governance
- Microsoft Entra ID / Microsoft 365 single sign-on.
- Approval workflow for weekly submissions before updating the live project snapshot.
- Fine-grained admin controls for user provisioning and project assignment changes.
- Audit review screens for project edits, milestone edits, weekly submissions, and email sends.
- Formal project closure workflow with closure approval, closure date, and read-only post-closure controls.

## Reporting and Automation
- Rich portfolio-level monthly executive summary email.
- Scheduled reminder notifications for PMs who miss update cadences.
- CSV export packs for steering committees and leadership reviews.
- Distinct monthly report template with month-to-date achievements, decisions required, risk trend, and next-month focus.
- Budget/spend trend visualization and variance reporting on top of the now-stored contract value and actual spend fields.
- Report preview screen before PDF download.
- Separate monthly report data model or view so monthly reports are not just weekly reports with different labels.
- Report configuration per project: select which milestones appear, include/exclude sections, and choose weekly vs monthly audience.
- Background worker execution for portfolio-level PDF packs, with progress tracking and report retention controls.
- Email delivery UI should show recipient validation, last send result, retry state, and failure reason.
- Risk trend reporting and portfolio-level risk heatmaps on top of the now-stored structured project risk register.

## Delivery Operations
- Bulk milestone import/export.
- Bulk risk import/export and risk template cloning across similar projects.
- Advanced search, filtering, saved views, and portfolio segmentation.
- SLA monitoring for blockers, dependencies, and stakeholder response times.
- Dedicated closed-project archive workflow with closure approval and read-only post-closure controls.
- Dedicated fields/tables for completed activities, completed deliverables, closure notes, and benefits.
- Forecast at completion, committed cost, and budget-vs-actual portfolio analytics.
- Milestone prioritization for reports so projects can store many milestones but only show executive-level milestones in one-page PDFs.
- Historical baseline vs forecast dates for milestones.
- Project dependency tracking across initiatives.

## Technical Hardening
- Add automated tests for weekly update sync, milestone delete, completed-project closure views, and PDF report generation.
- Add E2E coverage for project edit, milestone add/delete/save, weekly submission, admin email test, and report download.
- Add database migrations for new dedicated reporting/closure fields instead of overloading existing fields.
- Add seed fixtures for a completed project and an active project to test both report modes reliably.
- Add a production deployment runbook covering environment variables, SMTP, worker process, database migrations, backups, and restore.
