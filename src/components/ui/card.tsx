import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The standard bordered panel every section of the app sits inside.
 *
 * `min-w-0` is load-bearing. A grid or flex item defaults to `min-width: auto`,
 * which refuses to shrink below its content's minimum — so a panel holding a
 * wide table or a fixed-track bar chart pushed the whole dashboard sideways on
 * a phone, and the page scrolled horizontally rather than the panel's own
 * scroll container doing its job. Panels are grid children on seven pages, so
 * this belongs here rather than at each call site.
 */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-w-0 rounded-lg border border-line bg-panel", className)}
      {...props}
    />
  );
}

export function PanelHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function PanelTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("eyebrow", className)} {...props}>
      {children}
    </h2>
  );
}

export function PanelBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
