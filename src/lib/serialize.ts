/**
 * Decimal serialisation for the server → client boundary.
 *
 * Prisma returns Decimal instances, which React cannot pass to a client
 * component ("Only plain objects can be passed…"). Converting at the service
 * boundary — rather than in each component — means every consumer receives
 * plain data.
 *
 * Decimals become **strings**, not numbers. A double would be wide enough for
 * today's magnitudes, but a capex column declared Decimal(18,2) can hold values
 * a double cannot represent exactly, and silently rounding money is the kind of
 * bug that is invisible until it matters. The formatters in lib/format.ts accept
 * strings, so nothing downstream needs to change.
 */

type DecimalLike = { toFixed: (dp?: number) => string; toString: () => string };

function isDecimal(value: unknown): value is DecimalLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "toFixed" in value &&
    typeof (value as DecimalLike).toFixed === "function"
  );
}

/** Decimal → string, preserving null. */
export function decimalToString<T extends DecimalLike | null | undefined>(
  value: T,
): string | null {
  if (value === null || value === undefined) return null;
  return value.toString();
}

/**
 * Maps the given keys of an object from Decimal to `string | null`, leaving
 * every other field untouched.
 *
 * `K extends string` rather than `K extends keyof T` on purpose: callers pass a
 * shared list of Decimal column names (PROJECT_DECIMAL_FIELDS), but a given
 * `select` may not include all of them. Constraining to `keyof T` made
 * inference fail for those rows and silently widen K to every key, which
 * retyped unrelated fields as `string | null`. Keys absent from T are ignored
 * here and dropped from the result type by the `K & keyof T` intersection.
 */
export function serializeDecimalFields<T extends object, K extends string>(
  row: T,
  keys: readonly K[],
): Omit<T, K & keyof T> & { [P in K & keyof T]: string | null } {
  const out = { ...row } as Record<string, unknown>;
  for (const key of keys) {
    if (!(key in out)) continue;
    const value = out[key];
    out[key] = isDecimal(value) ? value.toString() : (value ?? null);
  }
  return out as Omit<T, K & keyof T> & { [P in K & keyof T]: string | null };
}

/** The Decimal columns on Project. */
export const PROJECT_DECIMAL_FIELDS = [
  "estimatedPowerMw",
  "confirmedPowerMw",
  "estimatedCapexUsd",
  "confirmedCapexUsd",
] as const;
