import type { DefaultSession } from "next-auth";

import type { Role } from "@/generated/prisma/enums";

// Teaches the Auth.js session/JWT types about `role` so permission checks are
// type-checked rather than relying on casts at each call site.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
