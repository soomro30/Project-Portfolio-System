import { after, NextResponse } from "next/server";
import { z } from "zod";

import { requestPasswordReset } from "@/lib/auth/password-reset";
import { apiErrorResponse } from "@/lib/utils/api";

export async function POST(request: Request) {
  try {
    const { email } = z.object({ email: z.string().trim().toLowerCase().max(255).email() })
      .parse(await request.json());
    after(async () => {
      try {
        await requestPasswordReset(email);
      } catch {
        console.error("Password reset request could not be processed.");
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
