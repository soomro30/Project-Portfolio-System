import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/session";
import { runWorkbookImport } from "@/lib/domain/projects";
import { apiErrorResponse } from "@/lib/utils/api";

export async function POST() {
  try {
    const user = await requireRole(["admin"]);
    const summary = await runWorkbookImport(user);
    return NextResponse.json({ summary });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
