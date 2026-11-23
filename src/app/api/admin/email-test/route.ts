import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/session";
import { triggerProjectEmail } from "@/lib/domain/projects";
import { apiErrorResponse } from "@/lib/utils/api";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);
    const { projectId, cadence } = z.object({
      projectId: z.uuid(),
      cadence: z.enum(["weekly", "monthly"]),
    }).parse(await request.json());

    const result = await triggerProjectEmail(user, projectId, cadence);
    return NextResponse.json({
      result: {
        id: result.id,
        status: result.status,
        errorMessage: result.status === "failed" ? "Email delivery failed. Check the recipient and SMTP configuration." : null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
