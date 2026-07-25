import * as React from "react";

import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-line-2 bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-cyan focus:outline-none disabled:opacity-50 aria-[invalid=true]:border-red";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(fieldBase, "h-9", type === "number" && "num", className)}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(fieldBase, "resize-y leading-relaxed", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/**
 * Native select. Used instead of the Radix listbox for plain enum pickers
 * because it gets mobile pickers, type-ahead and form semantics for free;
 * Radix Select is reserved for the cases that need custom option rendering.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(fieldBase, "h-9 cursor-pointer appearance-none pr-8", className)}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239A9A9A' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>\")",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 8px center",
      backgroundSize: "14px",
    }}
    {...props}
  />
));
Select.displayName = "Select";
