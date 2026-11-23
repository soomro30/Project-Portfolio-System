import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { sendPasswordResetEmail } from "@/lib/email/service";
import { getEnv } from "@/lib/env";

function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(email: string) {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  const tokenDigest = digest(token);
  const recipient = await db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id, email: users.email }).from(users)
      .where(and(eq(users.email, email), eq(users.active, true))).for("update");
    if (!user || user.email.endsWith(".local")) {
      return null;
    }

    const now = new Date();
    const existing = await tx.select({ id: passwordResetTokens.id }).from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, user.id), gt(passwordResetTokens.expiresAt, now)))
      .limit(1);
    if (existing.length) {
      return null;
    }

    await tx.insert(passwordResetTokens).values({
      userId: user.id,
      token: tokenDigest,
      expiresAt: new Date(now.getTime() + 30 * 60_000),
    });
    return user.email;
  });

  if (recipient) {
    try {
      await sendPasswordResetEmail(recipient, token);
    } catch {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, tokenDigest));
      console.error("Password reset email delivery failed.");
    }
  }
}

export async function resetPasswordWithToken(token: string, password: string) {
  if (password === getEnv().DEFAULT_ADMIN_PASSWORD || password === "ChangeMe123!") {
    return false;
  }

  const db = getDb();
  const tokenDigest = digest(token);
  const unused = () => and(
    eq(passwordResetTokens.token, tokenDigest),
    isNull(passwordResetTokens.consumedAt),
    gt(passwordResetTokens.expiresAt, new Date()),
  );
  const candidate = await db.query.passwordResetTokens.findFirst({ where: unused() });
  if (!candidate) {
    return false;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id }).from(users)
      .where(and(eq(users.id, candidate.userId), eq(users.active, true))).for("update");
    if (!user) {
      return false;
    }

    const [claimed] = await tx.update(passwordResetTokens)
      .set({ consumedAt: new Date() }).where(unused()).returning({ id: passwordResetTokens.id });
    if (!claimed) {
      return false;
    }

    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    return true;
  });
}
