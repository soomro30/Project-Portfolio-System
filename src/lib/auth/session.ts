import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth/options";

export type AppSessionUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "pm" | "portfolio_pm" | "viewer";
};

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

export async function requireRole(roles: AppSessionUser["role"][]) {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}
