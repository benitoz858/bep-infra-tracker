import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider whitespace-nowrap",
  {
    variants: {
      tone: {
        operational: "border-[#3d5f00] bg-[#1a2b00] text-green",
        construction: "border-[#5a4400] bg-[#2b1f00] text-amber",
        risk: "border-[#5a1a1a] bg-[#2b0e0e] text-red",
        planned: "border-[#1e5a6b] bg-[#062733] text-cyan",
        inert: "border-line-2 bg-panel-2 text-fg-muted",
        neutral: "border-line-2 bg-transparent text-fg-dim",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
