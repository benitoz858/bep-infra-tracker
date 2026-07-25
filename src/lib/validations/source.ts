import { z } from "zod";

import { ConfidenceLevel, MetricType, SourceType } from "@/generated/prisma/enums";
import {
  optionalDate,
  optionalNonNegativeNumber,
  optionalScore,
  optionalString,
  optionalText,
  optionalUrl,
  requiredString,
  requiredUrl,
} from "@/lib/validations/common";

/** A source attached to an existing project. */
export const sourceCreateSchema = z.object({
  projectId: z.string().min(1, "Choose a project."),
  title: requiredString("Title"),
  publisher: optionalString(200),
  url: requiredUrl,
  publicationDate: optionalDate,
  sourceType: z.enum(SourceType),
  excerpt: optionalText(4000),
  archivedUrl: optionalUrl,
  reliabilityScore: optionalScore("Reliability score"),
  isPrimarySource: z.coerce.boolean().default(false),
  accessedAt: optionalDate,
  /** Bypasses the per-project URL uniqueness check. */
  allowDuplicateUrl: z.coerce.boolean().default(false),
});

export type SourceCreateInput = z.infer<typeof sourceCreateSchema>;

export const sourceUpdateSchema = sourceCreateSchema
  .omit({ projectId: true })
  .partial()
  .extend({ id: z.string().min(1) });

/**
 * A candidate claim entered in the source inbox, before it becomes a
 * ProjectMetric. Kept separate from metricInputSchema because the inbox
 * always knows its source, so sourceId is not part of the payload.
 */
export const candidateClaimSchema = z
  .object({
    metricType: z.enum(MetricType),
    numericValue: optionalNonNegativeNumber("Value"),
    textValue: optionalString(1000),
    unit: optionalString(40),
    confidenceLevel: z.enum(ConfidenceLevel),
    methodology: optionalText(4000),
    effectiveDate: optionalDate,
  })
  .refine((c) => c.numericValue !== null || c.textValue !== null, {
    message: "Enter a numeric value or a text value for the claim.",
    path: ["numericValue"],
  });

/** The full source-inbox submission: one source plus the claims it supports. */
export const sourceInboxSchema = sourceCreateSchema.extend({
  claims: z.array(candidateClaimSchema).default([]),
});

export type SourceInboxInput = z.infer<typeof sourceInboxSchema>;
