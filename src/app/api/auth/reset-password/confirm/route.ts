import { NextResponse } from "next/server";
import { z } from "zod";

import { resetPasswordWithToken } from "@/lib/auth/password-reset";
import { apiErrorResponse } from "@/lib/utils/api";

export async function POST(request: Request) {
  try {
    const { token, password } = z.object({
      token: z.string().regex(/^[a-f0-9]{64}$/),
      password: z.string().min(12).refine((value) => Buffer.byteLength(value) <= 72),
    }).parse(await request.json());
    if (!(await resetPasswordWithToken(token, password))) {
      return NextResponse.json({ error: "Invalid or expired reset link, or password is not allowed." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
