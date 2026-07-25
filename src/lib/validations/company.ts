import { z } from "zod";

import { CompanyType } from "@/generated/prisma/enums";
import {
  optionalString,
  optionalText,
  optionalUrl,
  paginationSchema,
  requiredString,
} from "@/lib/validations/common";

export const companyInputSchema = z.object({
  name: requiredString("Company name", 200),
  slug: optionalString(80),
  companyType: z.enum(CompanyType),
  // Tickers are stored uppercase so `AMZN` and `amzn` cannot both exist.
  ticker: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim().toUpperCase() : null),
    z.string().max(20, "Ticker must be 20 characters or fewer.").nullable(),
  ),
  website: optionalUrl,
  headquartersCountry: optionalString(120),
  description: optionalText(8000),
});

export type CompanyInput = z.infer<typeof companyInputSchema>;

export const companyQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    companyType: z
      .string()
      .optional()
      .transform((v) =>
        (v ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((s): s is CompanyType =>
            (Object.values(CompanyType) as string[]).includes(s),
          ),
      ),
    hasTicker: z
      .string()
      .optional()
      .transform((v) => v === "1" || v === "true"),
    sort: z
      .string()
      .optional()
      .transform((v) => {
        const [field, dir] = (v ?? "name.asc").split(".");
        const allowed = ["name", "companyType", "ticker", "projectCount"];
        return {
          field: allowed.includes(field ?? "") ? (field as string) : "name",
          direction: dir === "desc" ? ("desc" as const) : ("asc" as const),
        };
      }),
  })
  .and(paginationSchema);

export type CompanyQuery = z.infer<typeof companyQuerySchema>;
