import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { authOptions } from "@/lib/auth/options";
import { getDb } from "@/lib/db";
import { roles, users } from "@/lib/db/schema";

export type AppSessionUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "pm" | "portfolio_pm" | "viewer";
};

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.accountVersion) {
    return null;
  }

  const [account] = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: roles.name,
      active: users.active,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!account?.active || account.role !== session.user.role || account.updatedAt.getTime() !== session.accountVersion) {
    return null;
  }

  const { id, name, email, role } = account;
  if (role !== "admin" && role !== "pm" && role !== "portfolio_pm" && role !== "viewer") {
    return null;
  }

  return { id, name, email, role } satisfies AppSessionUser;
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
