import nodemailer from "nodemailer";
import { format, isValid, parseISO } from "date-fns";
import { asc, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  auditLogs,
  emailRuns,
  projectEmailRecipients,
  projectMilestones,
  projects,
  weeklyUpdates,
} from "@/lib/db/schema";
import { EMAIL_SIGNATURE } from "@/lib/email/defaults";
import { getEnv } from "@/lib/env";
import { isMeaningfulText } from "@/lib/utils/format";

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

async function getTransporter() {
  if (!transporterPromise) {
    const env = getEnv();
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASSWORD,
            }
          : undefined,
      }),
    );
  }

  return transporterPromise;
}

export async function verifyEmailTransport() {
  const transporter = await getTransporter();
  await transporter.verify();
  return true;
}

function escapeHtml(value?: string | null) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cadenceLabel(cadence: "weekly" | "monthly") {
  return cadence === "weekly" ? "Weekly" : "Monthly";
}

function cadencePeriodLabel(cadence: "weekly" | "monthly") {
  return cadence === "weekly"
    ? { previous: "Last Week", next: "This Week" }
    : { previous: "Last Month", next: "This Month" };
}

function formatEmailDate(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseISO(value)
      : new Date(value);

  if (!isValid(date)) {
    return null;
  }

  return format(date, "dd-MMM-yyyy");
}

function preserveLineBreaks(value?: string | null) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function displayValue(value?: string | null, fallback = "Not specified") {
  return isMeaningfulText(value) ? preserveLineBreaks(value) : fallback;
}

function healthColor(health: string) {
  const normalized = health.trim().toLowerCase();

  if (normalized === "red") {
    return "#da1e28";
  }

  if (normalized === "amber") {
    return "#f1a208";
  }

  if (normalized === "green") {
    return "#24a148";
  }

  return "#8d8d8d";
}

function renderHealth(health: string) {
  const color = healthColor(health);

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse: collapse; display: inline-table; white-space: nowrap; width: auto;">
      <tr>
        <td style="width: 14px; min-width: 14px; padding: 0 7px 0 0; line-height: 14px; vertical-align: middle; white-space: nowrap;">
          <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${color}; mso-line-height-rule: exactly; line-height: 14px;">&nbsp;</span>
        </td>
        <td style="padding: 0; vertical-align: middle; white-space: nowrap; line-height: 18px;">
          ${escapeHtml(health)}
        </td>
      </tr>
    </table>
  `;
}

function renderStatusRow(label: string, value: string, options?: { header?: boolean }) {
  const labelBackground = options?.header ? "#c6c6c6" : "#cfe7f6";
  const valueBackground = options?.header ? "#c6c6c6" : "#ffffff";

  return `
    <tr>
      <td style="width: 25%; padding: 18px 12px; border: 1px solid #161616; background: ${labelBackground}; font-weight: 700; vertical-align: middle;">
        ${escapeHtml(label)}
      </td>
      <td style="padding: 18px 12px; border: 1px solid #161616; background: ${valueBackground}; vertical-align: middle; word-break: normal;">
        ${value}
      </td>
    </tr>
  `;
}

function buildEmailHtml({
  cadence,
  project,
  milestones,
  lastUpdate,
}: {
  cadence: "weekly" | "monthly";
  project: Awaited<ReturnType<typeof loadProjectEmailContext>>["project"];
  milestones: Awaited<ReturnType<typeof loadProjectEmailContext>>["milestones"];
  lastUpdate: Awaited<ReturnType<typeof loadProjectEmailContext>>["lastUpdate"];
}) {
  const cadenceText = cadenceLabel(cadence);
  const periodLabel = cadencePeriodLabel(cadence);
  const projectName = escapeHtml(project.projectName);
  const currentPositionSource = project.currentPosition || lastUpdate?.currentPosition || lastUpdate?.whatHappened;
  const whatHappenedSource = lastUpdate?.whatHappened || project.currentPosition;
  const nextActionSource = lastUpdate?.nextStep || project.keyNextAction;
  const blockerSource =
    cadence === "weekly"
      ? lastUpdate?.blocker || project.mainBlockerRisk || lastUpdate?.helpNeeded
      : project.mainBlockerRisk || lastUpdate?.blocker || lastUpdate?.helpNeeded;
  const fallbackMilestone = milestones.find(
    (milestone) => milestone.status.trim().toLowerCase() !== "completed",
  );
  const nextMilestone = project.nextMilestone || fallbackMilestone?.title;
  const nextMilestoneDate = project.nextMilestoneDate || fallbackMilestone?.dueDate;

  return `
    <div style="font-family: IBM Plex Sans, Arial, sans-serif; color: #161616; line-height: 1.45; font-size: 14px;">
      <p style="margin: 0 0 18px;">Dear All,</p>
      <p style="margin: 0 0 18px;">
        Please find below the <strong>${cadenceText.toLowerCase()} status update</strong> for the <strong>${projectName}</strong>.
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; border: 1px solid #161616; table-layout: fixed;">
        <tbody>
          ${renderStatusRow("Project Name", projectName, { header: true })}
          ${renderStatusRow("Project Stage", displayValue(project.projectStage))}
          ${renderStatusRow("Project Health", renderHealth(project.health))}
          ${renderStatusRow("Current Status", displayValue(currentPositionSource, "No update yet."))}
          ${renderStatusRow(`What Happened ${periodLabel.previous}`, displayValue(whatHappenedSource, "No update yet."))}
          ${renderStatusRow(`What Will Happen ${periodLabel.next}`, displayValue(nextActionSource))}
          ${renderStatusRow("Main Blocker / Risk", displayValue(blockerSource, "No active blocker"))}
          ${renderStatusRow("Pending With", displayValue(project.pendingWith))}
          ${renderStatusRow("Next Milestone", displayValue(nextMilestone))}
          ${renderStatusRow("Next Milestone Date", escapeHtml(formatEmailDate(nextMilestoneDate) ?? "Not specified"))}
        </tbody>
      </table>
      <p style="margin-top: 24px;">
        Regards,<br />
        <strong>${escapeHtml(EMAIL_SIGNATURE.name)}</strong><br />
        ${escapeHtml(EMAIL_SIGNATURE.title)}
      </p>
    </div>
  `;
}

async function loadProjectEmailContext(projectId: string) {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const recipients = await db.query.projectEmailRecipients.findMany({
    where: eq(projectEmailRecipients.projectId, projectId),
    orderBy: [asc(projectEmailRecipients.recipientType), asc(projectEmailRecipients.email)],
  });

  const milestones = await db.query.projectMilestones.findMany({
    where: eq(projectMilestones.projectId, projectId),
    orderBy: [asc(projectMilestones.sortOrder), asc(projectMilestones.dueDate)],
  });

  const lastUpdate = await db.query.weeklyUpdates.findFirst({
    where: eq(weeklyUpdates.projectId, projectId),
    orderBy: [desc(weeklyUpdates.updateDate), desc(weeklyUpdates.createdAt)],
  });

  return { project, recipients, milestones, lastUpdate };
}

export async function sendProjectStatusEmail(
  projectId: string,
  cadence: "weekly" | "monthly",
) {
  const db = getDb();
  const { project, recipients, milestones, lastUpdate } =
    await loadProjectEmailContext(projectId);

  const to = recipients
    .filter((recipient) => recipient.recipientType === "to")
    .map((recipient) => recipient.email);
  const cc = recipients
    .filter((recipient) => recipient.recipientType === "cc")
    .map((recipient) => recipient.email);

  if (!to.length) {
    const inserted = await db
      .insert(emailRuns)
      .values({
        projectId,
        cadence,
        status: "failed",
        scheduledFor: new Date(),
        recipients: { to: [], cc },
        errorMessage: "Project has no TO recipients configured.",
      })
      .returning();

    return inserted[0];
  }

  const html = buildEmailHtml({ cadence, project, milestones, lastUpdate });
  const subject = `Digital Roadmap Project - ${project.projectName} - ${cadenceLabel(cadence)} Status Update`;
  const queued = await db
    .insert(emailRuns)
    .values({
      projectId,
      cadence,
      status: "queued",
      scheduledFor: new Date(),
      subject,
      recipients: { to, cc },
      payload: {
        projectCode: project.projectCode,
        projectName: project.projectName,
      },
    })
    .returning();

  try {
    const transporter = await getTransporter();
    const env = getEnv();
    await transporter.sendMail({
      from: env.SMTP_FROM_NAME
        ? `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_ADDRESS}>`
        : env.SMTP_FROM_ADDRESS,
      to,
      cc,
      subject,
      html,
    });

    const updated = await db
      .update(emailRuns)
      .set({
        status: "sent",
        sentAt: new Date(),
      })
      .where(eq(emailRuns.id, queued[0].id))
      .returning();

    await db.insert(auditLogs).values({
      entityType: "email_run",
      entityId: updated[0].id,
      action: "email.sent",
      projectId,
      metadata: { cadence, to, cc },
    });

    return updated[0];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    const updated = await db
      .update(emailRuns)
      .set({
        status: "failed",
        errorMessage: message,
      })
      .where(eq(emailRuns.id, queued[0].id))
      .returning();

    return updated[0];
  }
}

export async function sendBatchEmails(cadence: "weekly" | "monthly") {
  const db = getDb();
  const candidates = await db.query.projects.findMany({
    where: eq(
      cadence === "weekly" ? projects.weeklyEmailEnabled : projects.monthlyEmailEnabled,
      true,
    ),
    columns: { id: true },
  });

  const results = [];
  for (const candidate of candidates) {
    results.push(await sendProjectStatusEmail(candidate.id, cadence));
  }

  return results;
}
