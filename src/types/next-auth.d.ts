import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accountVersion?: number;
    user: {
      id: string;
      name: string;
      email: string;
      role: "admin" | "pm" | "portfolio_pm" | "viewer";
    };
  }

  interface User {
    id: string;
    accountVersion: number;
    role: "admin" | "pm" | "portfolio_pm" | "viewer";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accountVersion?: number;
    role?: "admin" | "pm" | "portfolio_pm" | "viewer";
  }
}
