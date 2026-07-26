import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. There is an unrelated package-lock.json in the
  // user's home directory, and without this Next infers ~ as the root and
  // traces the wrong files when building for deployment.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },

  // Fail the production build on a type error rather than shipping it. This is
  // already the default; stated explicitly so a later edit cannot relax it
  // silently. (Next 16 dropped the `eslint` config key — linting is a separate
  // `npm run lint` step, wired into `npm run check`.)
  typescript: { ignoreBuildErrors: false },

  // Keep the Postgres drivers out of Next's own bundle so the OpenNext/esbuild
  // pass resolves them from node_modules with their full package contents,
  // rather than a pruned copy that is missing the file `main` points at.
  serverExternalPackages: ["pg", "pg-cloudflare", "@prisma/adapter-pg"],
};

export default nextConfig;
