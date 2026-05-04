# In Development

This file is the current handover note for the IMKAN Digital Portfolio Tracker. It should tell a new developer what exists today, what product decisions have been made, and what areas are still being actively refined.

## Core Platform
- Carbon-based Next.js application shell with dashboard, projects, reports, weekly update, and admin workspaces.
- PostgreSQL + Drizzle data model for users, roles, projects, milestones, project risks, weekly updates, recipients, audit logs, and email runs.
- Auth.js local email/password authentication with role-based access.
- Local PostgreSQL is the current development database. The Excel workbook is treated as a one-time import source, not a live sync source.
- SMTP is configured through environment variables. The working sender is the IMKAN notification mailbox, not the personal user mailbox.

## Portfolio Operations
- Project master tracker CRUD aligned to the Excel workbook structure.
- Projects now capture an `About the Project` description in addition to the project sponsor field.
- Projects now capture `Contract Value`, `Actual Spend To Date`, `Currency`, `Start Date`, `Planned End Date`, and `Actual End Date`.
- Projects now capture a dedicated `Progress %` value so the table and PDF gauge do not have to infer completion from free text.
- Projects now have a structured `Risks & Issues` register with dedicated fields for title, description, owner, mitigation plan, status, severity, and target date.
- Weekly PM submission flow that writes history and synchronizes the current project snapshot automatically.
- Milestone management with next-milestone snapshot synchronization and milestone deletion.
- Risk management now has its own editor on the project detail page. PDF reports should use structured risks first and only fall back to legacy blocker fields when no risk register rows exist.
- Completed-project view mode with closure summary, completed deliverables, closure notes, and preserved weekly history.
- Project detail pages open in read/report mode by default. Edit forms only open when the user clicks edit.
- Weekly history must always be preserved for running projects. Completed projects should show a closure record first, but historical weekly updates must not be deleted.
- The `key_next_action` field is reused as completed deliverables for completed projects until a dedicated `completed_deliverables` field is added.
- A dedicated `project_sponsor` field exists on projects and is used by the PDF report. `pending_with` remains a separate operational blocker/dependency owner field.
- The PDF status table now uses `About the Project`, `Project Manager`, `Project Sponsor`, `Current Active Milestone`, and `Next Milestone` / `Actual End Date` in the secondary metadata row.

## Reporting
- Dashboard KPIs for stage, health, priority, late updates, blockers, milestones, and email activity.
- Weekly and monthly email generation with SMTP delivery and audit logging.
- Workbook import pipeline to seed the system from the existing Excel tracker.
- One-page project PDF status reports with Carbon-inspired styling, RAG signal, progress gauge, budget/spend panel, timeline, risks/issues, and milestone table.
- Admin batch PDF generator for steering packs: admins can filter projects by stage, PM, health, and priority, select exact projects, generate individual PDFs into `reports/generated/<runId>`, and download one combined PDF pack.
- Combined batch PDFs now include a cover page and stage-group divider pages before the project reports: `On-Going Digital Transformation Projects`, `Projects in Tendering and Business Requirements Phase`, and `Completed/Delivered Projects`. Empty groups are skipped, and only the selected projects are included.
- Batch report generation writes a `manifest.json` and audit log entry for each run so generated packs can be traced.
- The PDF `Top Risks / Issues` section is now driven by the `project_risks` table when risk records exist.
- Completed-project PDF closure report behavior with completed activities and deliverables instead of active next-action wording.
- P01 ADIBC closure content captured as a completed project record with completed activities, deliverables, residual notes, and completed milestones.
- PDF reports are generated server-side through the project report API. They are designed to stay on one A4 landscape page.
- The timeline currently shows up to eight milestone markers to prevent overlap and page overflow.
- The milestone table currently shows up to eight milestone rows in the PDF. The UI can store more milestones, but report design assumes executive-level milestone selection.
- Budget/spend is modeled on the project record via `budget_currency`, `contract_value`, and `actual_spend_to_date`.
- `end_date` is now treated as the planned end date, and `actual_end_date` is stored separately for delivery variance tracking.
- Completed projects change report labels from active delivery wording to closure wording.

## UI Quality
- Carbon UI shell with collapsible rail navigation, enterprise project tracker table, filters, sort controls, colored status/priority tags, and readable date formatting.
- Project detail pages default to dashboard/report view and only open edit forms when requested.
- The project table includes serial number, progress percentage, current status, last email sent, expandable rows, and colored health/priority tags.
- Date display should use readable dates such as `23rd April 2026`.
- Avoid custom decorative gradients in the app UI. Prefer Carbon-like neutral surfaces, clear borders, readable typography, and direct status colors.

## Current Known Issues / Watch Items
- Monthly PDF reports still need distinct monthly content logic. They currently share much of the weekly report structure.
- Completed-project closure record view has been introduced, but it should continue to preserve and expose historical weekly updates when available.
- The PDF report is tuned for one page. If users add many milestones or very long notes, the report may need a report preview or a multi-page export option.
- Batch PDF generation is synchronous in v1. For very large packs, move it to the existing PostgreSQL-backed worker and show job progress.
- Dedicated fields are still needed for completed activities, completed deliverables, closure notes, and benefits tracking.
- Some Carbon form components can emit events where `currentTarget` is null. Existing handlers should use safe value readers instead of `event.currentTarget.value`.

## Important Test / Verification Commands
- `npm run lint`
- `npm run build`
- Generate and inspect PDFs for both an active project and a completed project.
- Generate a batch PDF with at least one ongoing, one tendering/requirements, and one completed project, then verify the combined PDF page order is cover, section divider, reports.
- Check P01 ADIBC report after report changes because it is the main completed-project test case.
