import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/session";
import { triggerProjectEmail } from "@/lib/domain/projects";
import { apiErrorResponse } from "@/lib/utils/api";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);
    const { projectId, cadence } = (await request.json()) as {
      projectId: string;
      cadence: "weekly" | "monthly";
    };

    const result = await triggerProjectEmail(user, projectId, cadence);
    return NextResponse.json({ result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
