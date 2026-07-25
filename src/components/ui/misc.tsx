import * as React from "react";

import { cn } from "@/lib/utils";

export function Label({
  className,
  children,
  hint,
  required,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & {
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className={cn("block", className)} {...props}>
      <span className="eyebrow">
        {children}
        {required ? <span className="ml-1 text-red">*</span> : null}
      </span>
      {hint ? <span className="mt-0.5 block text-xs text-fg-muted">{hint}</span> : null}
    </label>
  );
}

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      role="separator"
      className={cn(
        "bg-line",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse rounded bg-panel-2", className)} {...props} />
  );
}

/** Shown wherever a query legitimately returns nothing. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="mb-1 text-fg-muted">{icon}</div> : null}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description ? (
        <p className="max-w-md text-xs leading-relaxed text-fg-dim">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Field-level validation message. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-red">
      {message}
    </p>
  );
}
