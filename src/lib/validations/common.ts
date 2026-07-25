import { z } from "zod";

/**
 * Shared field builders.
 *
 * HTML forms and CSV files both deliver "" for an empty field. Coercing that to
 * `null` — rather than to `0` or `""` — is what keeps the "unknown is not zero"
 * rule true at the edge of the system. Every optional field below goes through
 * `emptyToNull`.
 */

const emptyToNull = (v: unknown) =>
  v === "" || v === undefined || (typeof v === "string" && v.trim() === "") ? null : v;

/** Optional trimmed string, "" becomes null. */
export const optionalString = (max = 500) =>
  z.preprocess(
    emptyToNull,
    z.string().trim().max(max, `Must be ${max} characters or fewer.`).nullable(),
  );

export const optionalText = (max = 20_000) => optionalString(max);

export const requiredString = (label: string, max = 300) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

/**
 * Non-negative number, empty becomes null. Data-quality rule: power and GPU
 * counts cannot be negative. Zero is accepted and preserved — it is a real
 * value, not a missing one.
 */
export const optionalNonNegativeNumber = (label: string, max?: number) =>
  z.preprocess(
    emptyToNull,
    z.coerce
      .number({ message: `${label} must be a number.` })
      .min(0, `${label} cannot be negative.`)
      .max(max ?? Number.MAX_SAFE_INTEGER, `${label} is implausibly large.`)
      .nullable(),
  );

export const optionalNonNegativeInt = (label: string, max?: number) =>
  z.preprocess(
    emptyToNull,
    z.coerce
      .number({ message: `${label} must be a number.` })
      .int(`${label} must be a whole number.`)
      .min(0, `${label} cannot be negative.`)
      .max(max ?? Number.MAX_SAFE_INTEGER, `${label} is implausibly large.`)
      .nullable(),
  );

/** Confidence score: 0–100 inclusive. */
export const optionalScore = (label: string) =>
  z.preprocess(
    emptyToNull,
    z.coerce
      .number({ message: `${label} must be a number.` })
      .int(`${label} must be a whole number.`)
      .min(0, `${label} must be between 0 and 100.`)
      .max(100, `${label} must be between 0 and 100.`)
      .nullable(),
  );

/** Date-only input from `<input type="date">` or a CSV cell. */
export const optionalDate = z.preprocess(
  emptyToNull,
  z.coerce.date({ message: "Must be a valid date." }).nullable(),
);

export const optionalUrl = z.preprocess(
  emptyToNull,
  z.string().trim().url("Must be a valid URL including https://").max(2000).nullable(),
);

export const requiredUrl = z
  .string()
  .trim()
  .min(1, "URL is required.")
  .url("Must be a valid URL including https://")
  .max(2000);

/** Latitude/longitude, empty becomes null. Both must be present or both absent. */
export const optionalLatitude = z.preprocess(
  emptyToNull,
  z.coerce
    .number({ message: "Latitude must be a number." })
    .min(-90, "Latitude must be between -90 and 90.")
    .max(90, "Latitude must be between -90 and 90.")
    .nullable(),
);

export const optionalLongitude = z.preprocess(
  emptyToNull,
  z.coerce
    .number({ message: "Longitude must be a number." })
    .min(-180, "Longitude must be between -180 and 180.")
    .max(180, "Longitude must be between -180 and 180.")
    .nullable(),
);

/** Pagination shared by every list endpoint. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
});

export type Pagination = z.infer<typeof paginationSchema>;
