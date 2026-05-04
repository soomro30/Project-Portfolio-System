import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { auditLogs, roles, users } from "@/lib/db/schema";

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
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const db = getDb();
        const result = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            passwordHash: users.passwordHash,
            active: users.active,
            role: roles.name,
          })
          .from(users)
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(eq(users.email, credentials.email.toLowerCase()))
          .limit(1);

        const candidate = result[0];

        if (!candidate || !candidate.active) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          candidate.passwordHash,
        );

        if (!isValid) {
          return null;
        }

        return {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          role: candidate.role as "admin" | "pm" | "viewer",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.name = user.name;
        token.email = user.email;
      }

      return token;
    },
    async session({ session, token }) {
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
