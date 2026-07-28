import { z } from "zod";

import { ConfidenceLevel, MetricType, SourceType } from "@/generated/prisma/enums";
import {
  optionalDate,
  optionalNonNegativeNumber,
  optionalString,
  optionalText,
  requiredString,
  requiredUrl,
} from "@/lib/validations/common";

/**
 * What a stranger may claim.
 *
 * `CONFIRMED` is deliberately absent. Confidence is the reviewer's judgement of
 * the evidence, not the submitter's — accepting a self-declared `CONFIRMED`
 * would let anyone with a form promote a guess to the tracker's strongest
 * assertion, which is the exact failure the whole provenance model exists to
 * prevent. The service caps this again on the server for the same reason.
 */
export const PUBLIC_CONFIDENCE = [
  ConfidenceLevel.LOW,
  ConfidenceLevel.MEDIUM,
  ConfidenceLevel.HIGH,
] as const;

export const publicClaimSchema = z
  .object({
    metricType: z.enum(MetricType),
    numericValue: optionalNonNegativeNumber("Value"),
    textValue: optionalString(1000),
    unit: optionalString(40),
    confidenceLevel: z.enum(PUBLIC_CONFIDENCE),
    /** How the submitter got the number. Stated, not inferred. */
    methodology: optionalText(2000),
    effectiveDate: optionalDate,
  })
  .refine((c) => c.numericValue !== null || c.textValue !== null, {
    message: "Enter a number or a text value for the claim.",
    path: ["numericValue"],
  });

export const publicSubmissionSchema = z.object({
  url: requiredUrl,
  title: requiredString("Title"),
  publisher: optionalString(200),
  publicationDate: optionalDate,
  sourceType: z.enum(SourceType),
  /**
   * Must be a quote from the source. Held separately from `note` so the
   * reviewer can always tell what the document said from what the submitter
   * thinks it means.
   */
  excerpt: optionalText(4000),

  /** Optional: blank means "I do not know which project", which is honest. */
  projectId: optionalString(60),
  /** Where no existing project fits — the reviewer may create one. */
  suggestedProjectName: optionalString(200),

  note: optionalText(2000),
  submitterName: optionalString(120),
  submitterEmail: z
    .string()
    .trim()
    .email("Must be a valid email address.")
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),

  claims: z.array(publicClaimSchema).max(10, "Ten claims at most per source.").default([]),

  /**
   * Honeypot. Real people never see this field, so anything in it came from a
   * bot filling every input it found. Cheap, and it costs no accessibility:
   * the field is hidden from assistive technology too.
   */
  website: z.literal("").optional().or(z.undefined()),
});

export type PublicSubmissionInput = z.infer<typeof publicSubmissionSchema>;
