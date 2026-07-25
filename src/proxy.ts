import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

// Next 16 renamed the `middleware` file convention to `proxy`; the contract is
// unchanged (default export + `config.matcher`).
//
// This runs on the edge runtime, so it uses the edge-safe half of the Auth.js
// config only — no Prisma, no bcrypt. Auth.js applies `callbacks.authorized` to
// every matched request and redirects unauthenticated traffic to
// `pages.signIn`.
const { auth: proxy } = NextAuth(authConfig);

export default proxy;

export const config = {
  // Everything except Next internals, the auth endpoints, the login page and
  // static assets. Matching /api too means an unauthenticated fetch is rejected
  // before it reaches a handler.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
