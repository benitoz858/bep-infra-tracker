import {
  CompanyType,
  ConfidenceLevel,
  MetricType,
  ProjectCompanyRole,
  ProjectStatus,
  ProjectType,
  Role,
  SourceType,
} from "@/generated/prisma/enums";

/**
 * Display metadata for the schema enums. Kept in one place so a label, colour
 * or ordering is defined once and every table, chart, form select and map
 * legend reads from it. Ordering of the status list is lifecycle order, not
 * alphabetical — charts and filter bars rely on it.
 */

export type StatusTone = "operational" | "construction" | "risk" | "planned" | "inert";

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; tone: StatusTone; description: string }
> = {
  RUMORED: {
    label: "Rumored",
    tone: "inert",
    description: "Reported but not acknowledged by the owner.",
  },
  ANNOUNCED: {
    label: "Announced",
    tone: "planned",
    description: "Publicly announced; work not yet started.",
  },
  PLANNING: {
    label: "Planning",
    tone: "planned",
    description: "Design and siting underway.",
  },
  PERMITTING: {
    label: "Permitting",
    tone: "planned",
    description: "In front of regulators or the local authority.",
  },
  UNDER_CONSTRUCTION: {
    label: "Under construction",
    tone: "construction",
    description: "Physical construction has begun.",
  },
  PARTIALLY_OPERATIONAL: {
    label: "Partially operational",
    tone: "operational",
    description: "First phase energised; later phases still building.",
  },
  OPERATIONAL: {
    label: "Operational",
    tone: "operational",
    description: "Fully in service.",
  },
  DELAYED: {
    label: "Delayed",
    tone: "risk",
    description: "Timeline has slipped against the announced date.",
  },
  PAUSED: {
    label: "Paused",
    tone: "risk",
    description: "Work stopped, project not formally cancelled.",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "risk",
    description: "Abandoned by the owner.",
  },
};

/** Lifecycle order, used for chart series and filter bar ordering. */
export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "RUMORED",
  "ANNOUNCED",
  "PLANNING",
  "PERMITTING",
  "UNDER_CONSTRUCTION",
  "PARTIALLY_OPERATIONAL",
  "OPERATIONAL",
  "DELAYED",
  "PAUSED",
  "CANCELLED",
];

/** Statuses that mean the project is still expected to deliver capacity. */
export const LIVE_STATUSES: ProjectStatus[] = [
  "ANNOUNCED",
  "PLANNING",
  "PERMITTING",
  "UNDER_CONSTRUCTION",
  "PARTIALLY_OPERATIONAL",
  "OPERATIONAL",
];

/** Hex values for non-CSS consumers: Recharts series and Mapbox paint. */
export const TONE_HEX: Record<StatusTone, string> = {
  operational: "#76B900",
  construction: "#FFB800",
  risk: "#FF4444",
  planned: "#00D4FF",
  inert: "#6B6B6B",
};

export function statusHex(status: ProjectStatus): string {
  return TONE_HEX[PROJECT_STATUS_META[status].tone];
}

/** Tailwind classes per tone, for badges. */
export const TONE_CLASS: Record<StatusTone, string> = {
  operational: "text-[--color-status-operational] border-[#3d5f00] bg-[#1a2b00]",
  construction: "text-[--color-status-construction] border-[#5a4400] bg-[#2b1f00]",
  risk: "text-[--color-status-risk] border-[#5a1a1a] bg-[#2b0e0e]",
  planned: "text-[--color-status-planned] border-[#1e5a6b] bg-[#062733]",
  inert: "text-[--color-status-inert] border-[#333] bg-[#1a1a1a]",
};

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  AI_FACTORY: "AI factory",
  DATA_CENTER: "Data center",
  GPU_CLUSTER: "GPU cluster",
  HYPERSCALE_CAMPUS: "Hyperscale campus",
  COLOCATION: "Colocation",
  SOVEREIGN_AI: "Sovereign AI",
  HPC: "HPC",
  POWER_PROJECT: "Power project",
  OTHER: "Other",
};

export const COMPANY_TYPE_LABEL: Record<CompanyType, string> = {
  HYPERSCALER: "Hyperscaler",
  NEOCLOUD: "Neocloud",
  COLOCATION_PROVIDER: "Colocation provider",
  GPU_VENDOR: "GPU vendor",
  SERVER_VENDOR: "Server vendor",
  NETWORKING_VENDOR: "Networking vendor",
  COOLING_VENDOR: "Cooling vendor",
  POWER_VENDOR: "Power vendor",
  UTILITY: "Utility",
  CONSTRUCTION: "Construction",
  REAL_ESTATE: "Real estate",
  GOVERNMENT: "Government",
  OTHER: "Other",
};

export const PROJECT_COMPANY_ROLE_LABEL: Record<ProjectCompanyRole, string> = {
  OWNER: "Owner",
  OPERATOR: "Operator",
  DEVELOPER: "Developer",
  TENANT: "Tenant",
  INVESTOR: "Investor",
  GPU_SUPPLIER: "GPU supplier",
  SERVER_SUPPLIER: "Server supplier",
  NETWORKING_SUPPLIER: "Networking supplier",
  COOLING_SUPPLIER: "Cooling supplier",
  POWER_EQUIPMENT_SUPPLIER: "Power equipment supplier",
  UTILITY: "Utility",
  CONSTRUCTION_PARTNER: "Construction partner",
  LAND_OWNER: "Land owner",
  OTHER: "Other",
};

/** Roles that count as "supplied" rather than "owned/operated". */
export const SUPPLIER_ROLES: ProjectCompanyRole[] = [
  "GPU_SUPPLIER",
  "SERVER_SUPPLIER",
  "NETWORKING_SUPPLIER",
  "COOLING_SUPPLIER",
  "POWER_EQUIPMENT_SUPPLIER",
  "CONSTRUCTION_PARTNER",
  "UTILITY",
];

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  COMPANY_ANNOUNCEMENT: "Company announcement",
  SEC_FILING: "SEC filing",
  EARNINGS_CALL: "Earnings call",
  GOVERNMENT_FILING: "Government filing",
  PERMIT: "Permit",
  UTILITY_FILING: "Utility filing",
  NEWS_ARTICLE: "News article",
  INDUSTRY_REPORT: "Industry report",
  CONFERENCE: "Conference",
  SOCIAL_MEDIA: "Social media",
  OTHER: "Other",
};

/**
 * Source types that are primary evidence by nature — the owner's own statement
 * or a regulatory document. Used to pre-tick `isPrimarySource` in the inbox and
 * to flag projects whose evidence is entirely secondary.
 */
export const PRIMARY_SOURCE_TYPES: SourceType[] = [
  "COMPANY_ANNOUNCEMENT",
  "SEC_FILING",
  "EARNINGS_CALL",
  "GOVERNMENT_FILING",
  "PERMIT",
  "UTILITY_FILING",
];

export const METRIC_TYPE_META: Record<
  MetricType,
  { label: string; defaultUnit: string | null; numeric: boolean }
> = {
  POWER_MW: { label: "Power", defaultUnit: "MW", numeric: true },
  GPU_COUNT: { label: "GPU count", defaultUnit: "GPUs", numeric: true },
  CAPEX_USD: { label: "Capex", defaultUnit: "USD", numeric: true },
  SQUARE_FEET: { label: "Floor area", defaultUnit: "sq ft", numeric: true },
  RACK_COUNT: { label: "Rack count", defaultUnit: "racks", numeric: true },
  LAND_ACRES: { label: "Land", defaultUnit: "acres", numeric: true },
  PUE: { label: "PUE", defaultUnit: null, numeric: true },
  OPENING_DATE: { label: "Opening date", defaultUnit: null, numeric: false },
  OTHER: { label: "Other", defaultUnit: null, numeric: false },
};

export const CONFIDENCE_META: Record<
  ConfidenceLevel,
  { label: string; tone: StatusTone; rank: number }
> = {
  CONFIRMED: { label: "Confirmed", tone: "operational", rank: 5 },
  HIGH: { label: "High", tone: "operational", rank: 4 },
  MEDIUM: { label: "Medium", tone: "construction", rank: 3 },
  LOW: { label: "Low", tone: "risk", rank: 2 },
  ESTIMATED: { label: "Estimated", tone: "inert", rank: 1 },
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  ANALYST: "Analyst",
  VIEWER: "Viewer",
};

/** Build `{value,label}` option lists for form selects and filter dropdowns. */
export function options<T extends string>(
  labels: Record<T, string> | Record<T, { label: string }>,
): { value: T; label: string }[] {
  return (Object.entries(labels) as [T, string | { label: string }][]).map(
    ([value, v]) => ({
      value,
      label: typeof v === "string" ? v : v.label,
    }),
  );
}

export const PROJECT_STATUS_OPTIONS = PROJECT_STATUS_ORDER.map((s) => ({
  value: s,
  label: PROJECT_STATUS_META[s].label,
}));
export const PROJECT_TYPE_OPTIONS = options(PROJECT_TYPE_LABEL);
export const COMPANY_TYPE_OPTIONS = options(COMPANY_TYPE_LABEL);
export const PROJECT_COMPANY_ROLE_OPTIONS = options(PROJECT_COMPANY_ROLE_LABEL);
export const SOURCE_TYPE_OPTIONS = options(SOURCE_TYPE_LABEL);
export const METRIC_TYPE_OPTIONS = options(METRIC_TYPE_META);
export const CONFIDENCE_OPTIONS = options(CONFIDENCE_META);
