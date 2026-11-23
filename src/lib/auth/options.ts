import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { auditLogs, roles, users } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).email(),
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const db = getDb();
        const result = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            passwordHash: users.passwordHash,
            active: users.active,
            updatedAt: users.updatedAt,
            role: roles.name,
          })
          .from(users)
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(eq(users.email, email))
          .limit(1);

        const candidate = result[0];

        if (!candidate || !candidate.active) {
          return null;
        }

        if (
          (candidate.role === "pm" && candidate.email.endsWith("@imkan.local")) ||
          (candidate.role !== "admin" &&
            (password === getEnv().DEFAULT_ADMIN_PASSWORD || password === "ChangeMe123!")) ||
          (process.env.NODE_ENV === "production" && password === "ChangeMe123!")
        ) {
          return null;
        }

        const isValid = await bcrypt.compare(
          password,
          candidate.passwordHash,
        );

        if (!isValid) {
          return null;
        }

        return {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          accountVersion: candidate.updatedAt.getTime(),
          role: candidate.role as "admin" | "pm" | "portfolio_pm" | "viewer",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.accountVersion = user.accountVersion;
        token.name = user.name;
        token.email = user.email;
      }

      return token;
    },
    async session({ session, token }) {
      session.accountVersion = token.accountVersion;
      if (session.user && token.sub && token.email && token.name && token.role) {
        session.user = {
          id: token.sub,
          email: token.email,
          name: token.name,
          role: token.role,
        };
      }

      return session;
    },
  },
  events: {
    async signIn({ user }) {
      const db = getDb();

      await db.insert(auditLogs).values({
        actorUserId: user.id,
        entityType: "auth",
        entityId: user.id,
        action: "sign_in",
        metadata: { email: user.email ?? null },
      });
    },
  },
};
