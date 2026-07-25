import { Skeleton } from "@/components/ui/misc";

/**
 * Route-level loading skeleton. Mirrors the common page shape (header, a row of
 * stat tiles, a panel) so the layout does not jump when the real content
 * arrives.
 */
export default function AppLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="space-y-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[86px]" />
        ))}
      </div>

      <Skeleton className="h-[360px]" />
    </div>
  );
}
