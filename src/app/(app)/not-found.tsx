import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <p className="font-mono text-3xl font-bold text-cyan">404</p>
      <h1 className="text-lg font-semibold text-fg">Not found</h1>
      <p className="max-w-md text-[13px] leading-relaxed text-fg-dim">
        This record does not exist, or its slug changed. Search the database, or check
        the projects list.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button asChild variant="primary" size="sm">
          <Link href="/projects">Browse projects</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
