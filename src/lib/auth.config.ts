import type { NextAuthConfig } from "next-auth";

import type { Role } from "@/generated/prisma/enums";

/**
 * Edge-safe half of the Auth.js configuration.
 *
 * Middleware runs on the edge runtime and cannot import Prisma or bcrypt, so
 * the provider list (which needs both) is added in lib/auth.ts instead. This
 * file holds only what the middleware needs to decide whether a request is
 * authenticated, and the callbacks that move `role` onto the token/session.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    // Credentials-based sign-in requires JWT sessions; the Auth.js database
    // session strategy only supports adapter-backed providers.
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  providers: [],
  callbacks: {
    // `authorized` is what middleware consults. Returning false triggers a
    // redirect to `pages.signIn`.
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: Role }).role ?? "VIEWER";
        token.id = user.id as string;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as Role) ?? "VIEWER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
