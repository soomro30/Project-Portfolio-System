import { NextRequest, NextResponse } from "next/server";

import { resetPasswordWithToken } from "@/lib/domain/projects";
import { apiErrorResponse } from "@/lib/utils/api";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = (await request.json()) as {
      token: string;
      password: string;
    };

    await resetPasswordWithToken(token, password);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
