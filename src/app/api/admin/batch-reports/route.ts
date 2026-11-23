import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/session";
import { listProjectsForUser } from "@/lib/domain/projects";
import { BATCH_REPORT_QUEUE, getBatchReportPublisher, type BatchReportJob } from "@/lib/reports/batch-jobs";
import { apiErrorResponse, RequestError } from "@/lib/utils/api";

export const runtime = "nodejs";

const batchReportSchema = z.object({
  cadence: z.enum(["weekly", "monthly"]).default("weekly"),
  projectIds: z.array(z.uuid()).max(75).default([]),
  stages: z.array(z.string().trim().max(255)).max(100).default([]),
  projectManagers: z.array(z.string().trim().max(255)).max(100).default([]),
  health: z.array(z.string().trim().max(255)).max(100).default([]),
  priorities: z.array(z.string().trim().max(255)).max(100).default([]),
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
      throw new RequestError("No projects matched the selected batch report criteria.");
    }

    if (filteredSummaries.length > 75) {
      throw new RequestError("Batch report limit is 75 projects. Narrow the selection and try again.");
    }

    const boss = await getBatchReportPublisher();
    const jobId = await boss.send(BATCH_REPORT_QUEUE, {
      actorId: user.id,
      projectIds: filteredSummaries.map(({ id }) => id),
      cadence: payload.cadence,
    } satisfies BatchReportJob, { singletonKey: user.id, group: { id: "batch-pdf" } });
    if (!jobId) {
      const jobs = await boss.findJobs<BatchReportJob>(BATCH_REPORT_QUEUE, { key: user.id });
      const pending = jobs.find(({ state }) => state === "created" || state === "active" || state === "retry");
      if (!pending) throw new RequestError("The previous batch just finished. Please submit again.", 409);
      return NextResponse.json({ jobId: pending.id }, { status: 202 });
    }

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);
    const id = z.uuid().parse(request.nextUrl.searchParams.get("jobId"));
    const boss = await getBatchReportPublisher();
    const [job] = await boss.findJobs<BatchReportJob>(BATCH_REPORT_QUEUE, { id });
    if (!job || job.data.actorId !== user.id) throw new RequestError("Batch report job not found.", 404);
    return NextResponse.json({
      state: job.state,
      result: job.state === "completed" ? job.output : undefined,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
