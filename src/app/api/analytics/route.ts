import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import {
  getCapacityByYear,
  getCoolingMix,
  getDashboardSummary,
  getPlatformMix,
  getPowerByCountry,
  getPowerByOwner,
  getPowerSourceMix,
  getStatusBreakdown,
} from "@/lib/services/analytics";
import {
  getPublicCompanyExposure,
  getSupplierExposure,
} from "@/lib/services/companies";

export const GET = handler(async () => {
  await requireUser();

  const [
    summary,
    statuses,
    byCountry,
    byOwner,
    byYear,
    powerMix,
    coolingMix,
    platformMix,
    suppliers,
    publicExposure,
  ] = await Promise.all([
    getDashboardSummary(),
    getStatusBreakdown(),
    getPowerByCountry(50),
    getPowerByOwner(50),
    getCapacityByYear(),
    getPowerSourceMix(20),
    getCoolingMix(20),
    getPlatformMix(20),
    getSupplierExposure(),
    getPublicCompanyExposure(),
  ]);

  return ok({
    // Restated on the API too: a consumer of this JSON has no UI banner to read.
    disclaimer:
      "Totals mix confirmed disclosures with analyst estimates (best figure per project) and exclude cancelled projects. Demo/seed rows may be included.",
    summary,
    statuses,
    byCountry,
    byOwner,
    byYear,
    mixes: { powerSource: powerMix, cooling: coolingMix, platform: platformMix },
    exposure: { suppliers, publicCompanies: publicExposure },
  });
});
