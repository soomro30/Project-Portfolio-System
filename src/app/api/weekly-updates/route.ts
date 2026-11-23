import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole, requireUser } from "@/lib/auth/session";
import { listWeeklyHistory, submitWeeklyUpdate } from "@/lib/domain/projects";
import { weeklyUpdateInput } from "@/lib/domain/project-input";
import { apiErrorResponse } from "@/lib/utils/api";

const historyQuery = z.object({
  projectId: z.uuid().optional(),
  before: z.iso.date().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { projectId, before } = historyQuery.parse(Object.fromEntries(request.nextUrl.searchParams));
    return NextResponse.json(await listWeeklyHistory(user, projectId, before));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "pm", "portfolio_pm"]);
    const payload = weeklyUpdateInput.parse(await request.json());
    const result = await submitWeeklyUpdate(payload, user);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
