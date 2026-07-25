/**
 * The single string the entire UI uses for a value we do not have.
 *
 * Data-quality rule: unknown is not zero. A project with `confirmedPowerMw: 0`
 * is a project confirmed to draw no power; a project with `null` is one we
 * have not sourced. Every formatter below returns NOT_DISCLOSED for null or
 * undefined and a real formatted "0" for zero. Do not add `|| 0` fallbacks or
 * truthiness checks to this file — `if (!mw)` would silently turn a confirmed
 * zero into "Not disclosed".
 */
export const NOT_DISCLOSED = "Not disclosed";

/**
 * A Prisma Decimal, a plain number, or a numeric string from a form or CSV.
 * Decimal is matched structurally (anything with toString) rather than imported,
 * so this module stays free of the Prisma client and can be used in client
 * components and unit tests without pulling in the driver.
 */
export type NumericLike = { toString(): string } | number | string | null | undefined;

/** Narrow a NumericLike to a JS number, preserving the null/zero distinction. */
export function toNumber(value: NumericLike): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

export function formatNumber(
  value: NumericLike,
  options: Intl.NumberFormatOptions = {},
): string {
  const n = toNumber(value);
  if (n === null) return NOT_DISCLOSED;
  return new Intl.NumberFormat("en-US", options).format(n);
}

/** Megawatts. Shows decimals only when the value actually has them. */
export function formatMw(value: NumericLike): string {
  const n = toNumber(value);
  if (n === null) return NOT_DISCLOSED;
  const hasFraction = Math.abs(n % 1) > 1e-9;
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasFraction ? 1 : 0,
  }).format(n)} MW`;
}

/**
 * Power totals at portfolio scale. Rolls over to GW past 1,000 MW because a
 * dashboard tile reading "48,300 MW" is harder to read at a glance than
 * "48.3 GW".
 */
export function formatPowerScaled(value: NumericLike): string {
  const n = toNumber(value);
  if (n === null) return NOT_DISCLOSED;
  if (Math.abs(n) >= 1000) {
    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 1,
    }).format(n / 1000)} GW`;
  }
  return formatMw(n);
}

/** USD, abbreviated for density: $1.2B, $340M, $12.5K. */
export function formatUsdCompact(value: NumericLike): string {
  const n = toNumber(value);
  if (n === null) return NOT_DISCLOSED;

  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const fmt = (v: number, suffix: string) =>
    `${sign}$${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: v < 10 ? 1 : 0,
    }).format(v)}${suffix}`;

  if (abs >= 1e12) return fmt(abs / 1e12, "T");
  if (abs >= 1e9) return fmt(abs / 1e9, "B");
  if (abs >= 1e6) return fmt(abs / 1e6, "M");
  if (abs >= 1e3) return fmt(abs / 1e3, "K");
  return `${sign}$${new Intl.NumberFormat("en-US").format(abs)}`;
}

/** Full-precision USD, for the detail page where exact figures matter. */
export function formatUsdExact(value: NumericLike): string {
  const n = toNumber(value);
  if (n === null) return NOT_DISCLOSED;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Large integer counts (GPUs, racks, square feet). */
export function formatCount(value: NumericLike): string {
  const n = toNumber(value);
  if (n === null) return NOT_DISCLOSED;
  return new Intl.NumberFormat("en-US").format(n);
}

/** Compact counts for dashboard tiles: 1.4M, 320K. */
export function formatCountCompact(value: NumericLike): string {
  const n = toNumber(value);
  if (n === null) return NOT_DISCLOSED;
  const abs = Math.abs(n);
  if (abs >= 1e6)
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n / 1e6)}M`;
  if (abs >= 1e4)
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n / 1e3)}K`;
  return formatCount(n);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return NOT_DISCLOSED;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return NOT_DISCLOSED;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Month precision — right for opening dates, which are rarely day-accurate. */
export function formatMonthYear(value: Date | string | null | undefined): string {
  if (!value) return NOT_DISCLOSED;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return NOT_DISCLOSED;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

/** "12 days ago" / "in 3 months", for last-verified and due-date columns. */
export function formatRelative(value: Date | string | null | undefined): string {
  if (!value) return "Never";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "Never";

  const diffMs = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 3600e3],
    ["month", 30 * 24 * 3600e3],
    ["day", 24 * 3600e3],
    ["hour", 3600e3],
    ["minute", 60e3],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return "just now";
}

/** Assemble "Ashburn, Virginia, United States" from parts that may be null. */
export function formatLocation(parts: {
  city?: string | null;
  stateRegion?: string | null;
  country?: string | null;
}): string {
  const joined = [parts.city, parts.stateRegion, parts.country]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .join(", ");
  return joined || NOT_DISCLOSED;
}

/** Turn SCREAMING_SNAKE enum values into "Under construction" for display. */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return NOT_DISCLOSED;
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining accents left by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
