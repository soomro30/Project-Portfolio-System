import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/session";
import { auditLogs } from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import { getProjectForUser, listProjectsForUser } from "@/lib/domain/projects";
import { generateBatchProjectReports } from "@/lib/reports/pdf-generator";
import { type ProjectReportData, type ReportCadence } from "@/lib/reports/project-status-report";
import { apiErrorResponse } from "@/lib/utils/api";

export const runtime = "nodejs";

const batchReportSchema = z.object({
  cadence: z.enum(["weekly", "monthly"]).default("weekly"),
  projectIds: z.array(z.string().uuid()).default([]),
  stages: z.array(z.string()).default([]),
  projectManagers: z.array(z.string()).default([]),
  health: z.array(z.string()).default([]),
  priorities: z.array(z.string()).default([]),
});

function normalizeFilterValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);
    const payload = batchReportSchema.parse(await request.json());
    const selectedProjectIds = normalizeFilterValues(payload.projectIds);
    const stages = normalizeFilterValues(payload.stages);
    const projectManagers = normalizeFilterValues(payload.projectManagers);
    const health = normalizeFilterValues(payload.health);
    const priorities = normalizeFilterValues(payload.priorities);

    const projectSummaries = await listProjectsForUser(user);
    const filteredSummaries = projectSummaries.filter((project) => {
      if (selectedProjectIds.length && !selectedProjectIds.includes(project.id)) {
        return false;
      }

      if (stages.length && !stages.includes(project.projectStage)) {
        return false;
      }

      if (projectManagers.length && !projectManagers.includes(project.pmName || "Not assigned")) {
        return false;
      }

      if (health.length && !health.includes(project.health)) {
        return false;
      }

      if (priorities.length && !priorities.includes(project.priority)) {
        return false;
      }

      return true;
    });

    if (!filteredSummaries.length) {
      throw new Error("No projects matched the selected batch report criteria.");
    }

    if (filteredSummaries.length > 75) {
      throw new Error("Batch report limit is 75 projects. Narrow the selection and try again.");
    }

    const projectRecords = await Promise.all(
      filteredSummaries.map((project) => getProjectForUser(user, project.id)),
    );
    const projects: ProjectReportData[] = projectRecords.filter(
      (project): project is NonNullable<(typeof projectRecords)[number]> => Boolean(project),
    );

    const result = await generateBatchProjectReports({
      projects,
      cadence: payload.cadence as ReportCadence,
    });

    const db = getDb();
    await db.insert(auditLogs).values({
      actorUserId: user.id,
      entityType: "batch_reports",
      entityId: result.runId,
      action: "generate",
      metadata: {
        cadence: result.cadence,
        projectCount: result.projectCount,
        sections: result.sections.map((section) => ({
          title: section.title,
          projectCount: section.projectCount,
          stages: section.stages,
        })),
        outputDir: result.outputDir,
        projects: result.files.map((file) => `${file.projectCode} - ${file.projectName}`),
      },
    });

    return NextResponse.json({
      result: {
        ...result,
        files: result.files.map((file) => ({
          ...file,
          downloadUrl: `/api/admin/batch-reports/download?runId=${encodeURIComponent(result.runId)}&file=${encodeURIComponent(file.fileName)}`,
          editableDownloadUrl: `/api/admin/batch-reports/download?runId=${encodeURIComponent(result.runId)}&file=${encodeURIComponent(file.editableFileName)}`,
        })),
        combinedDownloadUrl: `/api/admin/batch-reports/download?runId=${encodeURIComponent(result.runId)}&file=${encodeURIComponent(result.combinedFileName)}`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
