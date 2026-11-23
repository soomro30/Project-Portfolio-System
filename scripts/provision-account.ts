import "dotenv/config";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, getSql } from "@/lib/db";
import { auditLogs, passwordResetTokens, users } from "@/lib/db/schema";

const args = z.tuple([
  z.uuid(),
  z.string().trim().toLowerCase().max(255).email().refine((email) => !email.endsWith(".local")),
]);

class ProvisioningError extends Error {}

async function main() {
  const parsed = args.safeParse(process.argv.slice(2));
  if (!parsed.success) throw new ProvisioningError("Provide the existing user UUID and their verified work email.");
  const [id, email] = parsed.data;
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  await getDb().transaction(async (tx) => {
    const [user] = await tx.update(users).set({ email, passwordHash }).where(eq(users.id, id)).returning({ id: users.id });
    if (!user) throw new ProvisioningError("The account could not be found.");
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await tx.insert(auditLogs).values({
      entityType: "auth",
      entityId: user.id,
      action: "account.provision",
    });
  });
  console.log("Account updated. The user can request a password reset from the sign-in page.");
}

main().catch((error) => {
  console.error(error instanceof ProvisioningError ? error.message : "Account provisioning failed.");
  process.exitCode = 1;
}).finally(async () => getSql().end());
