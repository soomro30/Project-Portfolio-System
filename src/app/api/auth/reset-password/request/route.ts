import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ensurePasswordResetToken } from "@/lib/domain/projects";
import { apiErrorResponse } from "@/lib/utils/api";

export async function POST(request: NextRequest) {
  try {
    const { email } = (await request.json()) as { email: string };
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (!user) {
      return NextResponse.json({ success: true });
    }

    const token = await ensurePasswordResetToken(user.id);
    return NextResponse.json({
      success: true,
      token: token.token,
      expiresAt: token.expiresAt,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
