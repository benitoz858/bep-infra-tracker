import { cn } from "@/lib/utils";

/**
 * Horizontal bar list — the workhorse "X by Y" panel on the dashboard.
 * Bars are scaled to the largest row rather than to a total, so the comparison
 * is between categories rather than as a share of a whole.
 */
export function BarList({
  rows,
  valueLabel,
  emptyText = "No data yet.",
}: {
  rows: {
    key: string;
    label: string;
    value: number;
    display: string;
    color?: string;
  }[];
  valueLabel?: string;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return <p className="px-1 py-6 text-center text-xs text-fg-muted">{emptyText}</p>;
  }

  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="space-y-1.5">
      {valueLabel ? (
        <p className="mb-2 text-right font-mono text-[10px] uppercase tracking-wider text-fg-muted">
          {valueLabel}
        </p>
      ) : null}
      {rows.map((row) => (
        <div
          key={row.key}
          className="grid grid-cols-[minmax(90px,1fr)_2fr_auto] items-center gap-3"
        >
          <span className="truncate text-[12px] text-fg-dim" title={row.label}>
            {row.label}
          </span>
          <span className="h-4 w-full overflow-hidden rounded-sm bg-panel-2">
            <span
              className={cn("block h-full rounded-sm", !row.color && "bg-cyan/70")}
              style={{
                width: `${Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0)}%`,
                backgroundColor: row.color,
              }}
            />
          </span>
          <span className="num w-20 text-right text-[12px] text-fg">{row.display}</span>
        </div>
      ))}
    </div>
  );
}
