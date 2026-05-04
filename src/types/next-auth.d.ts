import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: "admin" | "pm" | "viewer";
    };
  }

  interface User {
    id: string;
    role: "admin" | "pm" | "viewer";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "pm" | "viewer";
  }
}
