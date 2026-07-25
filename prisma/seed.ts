/**
 * Development seed.
 *
 * IMPORTANT: every project written here is illustrative. Power figures, GPU
 * counts, capex and dates are invented for UI development and are NOT research
 * output. Each row is written with `isDemoData: true`, which makes the UI render
 * a "Demo data — not verified" badge and marks the rows in every export.
 * Clear them with `npm run db:reset`.
 *
 * The script is idempotent — it upserts on slug, so re-running will not
 * duplicate rows.
 */
// Must precede the lib/db import: db.ts reads DATABASE_URL at module load.
import "dotenv/config";

import { hash } from "bcryptjs";

import {
  type CompanyType,
  type ConfidenceLevel,
  type MetricType,
  type ProjectCompanyRole,
  type ProjectStatus,
  type ProjectType,
  type SourceType,
} from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/db";
import { slugify } from "../src/lib/format";

const DEMO_NOTE =
  "DEMO DATA — NOT VERIFIED. Illustrative record created by the development seed script. Figures are invented and must not be used in analysis.";

type CompanySeed = {
  name: string;
  companyType: CompanyType;
  ticker?: string;
  website?: string;
  headquartersCountry?: string;
  description?: string;
};

const COMPANIES: CompanySeed[] = [
  // Hyperscalers
  {
    name: "Microsoft",
    companyType: "HYPERSCALER",
    ticker: "MSFT",
    website: "https://microsoft.com",
    headquartersCountry: "United States",
  },
  {
    name: "Amazon Web Services",
    companyType: "HYPERSCALER",
    ticker: "AMZN",
    website: "https://aws.amazon.com",
    headquartersCountry: "United States",
  },
  {
    name: "Google",
    companyType: "HYPERSCALER",
    ticker: "GOOGL",
    website: "https://cloud.google.com",
    headquartersCountry: "United States",
  },
  {
    name: "Meta",
    companyType: "HYPERSCALER",
    ticker: "META",
    website: "https://meta.com",
    headquartersCountry: "United States",
  },
  {
    name: "Oracle",
    companyType: "HYPERSCALER",
    ticker: "ORCL",
    website: "https://oracle.com",
    headquartersCountry: "United States",
  },
  // Neoclouds and labs
  {
    name: "CoreWeave",
    companyType: "NEOCLOUD",
    ticker: "CRWV",
    website: "https://coreweave.com",
    headquartersCountry: "United States",
  },
  {
    name: "Crusoe Energy",
    companyType: "NEOCLOUD",
    website: "https://crusoe.ai",
    headquartersCountry: "United States",
  },
  {
    name: "Nscale",
    companyType: "NEOCLOUD",
    website: "https://nscale.com",
    headquartersCountry: "United Kingdom",
  },
  {
    name: "xAI",
    companyType: "NEOCLOUD",
    website: "https://x.ai",
    headquartersCountry: "United States",
  },
  {
    name: "OpenAI",
    companyType: "NEOCLOUD",
    website: "https://openai.com",
    headquartersCountry: "United States",
  },
  // Vendors
  {
    name: "NVIDIA",
    companyType: "GPU_VENDOR",
    ticker: "NVDA",
    website: "https://nvidia.com",
    headquartersCountry: "United States",
  },
  {
    name: "AMD",
    companyType: "GPU_VENDOR",
    ticker: "AMD",
    website: "https://amd.com",
    headquartersCountry: "United States",
  },
  {
    name: "Dell Technologies",
    companyType: "SERVER_VENDOR",
    ticker: "DELL",
    headquartersCountry: "United States",
  },
  {
    name: "Supermicro",
    companyType: "SERVER_VENDOR",
    ticker: "SMCI",
    headquartersCountry: "United States",
  },
  {
    name: "Arista Networks",
    companyType: "NETWORKING_VENDOR",
    ticker: "ANET",
    headquartersCountry: "United States",
  },
  {
    name: "Vertiv",
    companyType: "COOLING_VENDOR",
    ticker: "VRT",
    headquartersCountry: "United States",
  },
  {
    name: "Schneider Electric",
    companyType: "POWER_VENDOR",
    ticker: "SU.PA",
    headquartersCountry: "France",
  },
  {
    name: "GE Vernova",
    companyType: "POWER_VENDOR",
    ticker: "GEV",
    headquartersCountry: "United States",
  },
  // Capital, utilities, government
  {
    name: "SoftBank Group",
    companyType: "OTHER",
    ticker: "9984.T",
    headquartersCountry: "Japan",
  },
  {
    name: "Blackstone",
    companyType: "REAL_ESTATE",
    ticker: "BX",
    headquartersCountry: "United States",
  },
  {
    name: "Dominion Energy",
    companyType: "UTILITY",
    ticker: "D",
    headquartersCountry: "United States",
  },
  {
    name: "Oncor Electric Delivery",
    companyType: "UTILITY",
    headquartersCountry: "United States",
  },
  { name: "Statnett", companyType: "UTILITY", headquartersCountry: "Norway" },
  {
    name: "Turner Construction",
    companyType: "CONSTRUCTION",
    headquartersCountry: "United States",
  },
  {
    name: "Government of Japan (METI)",
    companyType: "GOVERNMENT",
    headquartersCountry: "Japan",
  },
  {
    name: "Government of India (MeitY)",
    companyType: "GOVERNMENT",
    headquartersCountry: "India",
  },
];

const TAGS = [
  "NVIDIA",
  "AMD",
  "TPU",
  "Trainium",
  "Blackwell",
  "Rubin",
  "liquid cooling",
  "nuclear",
  "natural gas",
  "renewables",
  "sovereign AI",
];

type ProjectSeed = {
  name: string;
  description: string;
  owner: string;
  projectType: ProjectType;
  status: ProjectStatus;
  city?: string;
  stateRegion?: string;
  country: string;
  latitude: number;
  longitude: number;
  announcementDate?: string;
  expectedOpeningDate?: string;
  actualOpeningDate?: string;
  estimatedPowerMw?: number;
  confirmedPowerMw?: number;
  estimatedGpuCount?: number;
  confirmedGpuCount?: number;
  gpuModel?: string;
  computePlatform?: string;
  estimatedCapexUsd?: number;
  confirmedCapexUsd?: number;
  squareFeet?: number;
  coolingTechnology?: string;
  powerSource?: string;
  utilityProvider?: string;
  confidenceScore: number;
  tags: string[];
  partners: { company: string; role: ProjectCompanyRole; notes?: string }[];
  sources: {
    title: string;
    publisher: string;
    url: string;
    sourceType: SourceType;
    publicationDate: string;
    reliabilityScore: number;
    isPrimarySource: boolean;
    excerpt?: string;
  }[];
  metrics: {
    metricType: MetricType;
    numericValue?: number;
    textValue?: string;
    unit?: string;
    confidenceLevel: ConfidenceLevel;
    methodology?: string;
    effectiveDate?: string;
    sourceIndex?: number;
  }[];
};

// URLs point at each owner's real newsroom root rather than a fabricated deep
// link, so no seeded citation pretends to be a specific article that does not
// exist.
const PROJECTS: ProjectSeed[] = [
  {
    name: "Mount Pleasant AI Campus Phase 2",
    description:
      "Second phase of a hyperscale AI training campus in southeastern Wisconsin.",
    owner: "Microsoft",
    projectType: "HYPERSCALE_CAMPUS",
    status: "UNDER_CONSTRUCTION",
    city: "Mount Pleasant",
    stateRegion: "Wisconsin",
    country: "United States",
    latitude: 42.7089,
    longitude: -87.8917,
    announcementDate: "2025-03-12",
    expectedOpeningDate: "2027-06-01",
    estimatedPowerMw: 900,
    confirmedPowerMw: 450,
    estimatedGpuCount: 180000,
    gpuModel: "NVIDIA GB200 NVL72",
    computePlatform: "NVIDIA Blackwell",
    estimatedCapexUsd: 7_400_000_000,
    squareFeet: 2_300_000,
    coolingTechnology: "Direct-to-chip liquid",
    powerSource: "Grid + on-site gas",
    utilityProvider: "We Energies",
    confidenceScore: 72,
    tags: ["NVIDIA", "Blackwell", "liquid cooling", "natural gas"],
    partners: [
      { company: "Microsoft", role: "OWNER" },
      { company: "NVIDIA", role: "GPU_SUPPLIER" },
      { company: "Vertiv", role: "COOLING_SUPPLIER" },
      { company: "Turner Construction", role: "CONSTRUCTION_PARTNER" },
    ],
    sources: [
      {
        title: "Microsoft newsroom — datacenter investments",
        publisher: "Microsoft",
        url: "https://news.microsoft.com/",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2025-03-12",
        reliabilityScore: 95,
        isPrimarySource: true,
        excerpt: "Demo excerpt — placeholder text for UI development.",
      },
      {
        title: "Local permitting docket",
        publisher: "Village of Mount Pleasant",
        url: "https://www.mtpleasantwi.gov/",
        sourceType: "PERMIT",
        publicationDate: "2025-05-02",
        reliabilityScore: 90,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 450,
        unit: "MW",
        confidenceLevel: "CONFIRMED",
        methodology: "Interconnection agreement for phase 2A only.",
        effectiveDate: "2025-05-02",
        sourceIndex: 1,
      },
      {
        metricType: "POWER_MW",
        numericValue: 900,
        unit: "MW",
        confidenceLevel: "ESTIMATED",
        methodology:
          "Analyst estimate: phase 2A confirmed load scaled by announced building count.",
        effectiveDate: "2025-05-02",
      },
      {
        metricType: "GPU_COUNT",
        numericValue: 180000,
        unit: "GPUs",
        confidenceLevel: "ESTIMATED",
        methodology:
          "Derived: 900 MW at ~5 kW/GPU all-in, 85% utilisation of critical load.",
        sourceIndex: 0,
      },
      {
        metricType: "CAPEX_USD",
        numericValue: 7_400_000_000,
        unit: "USD",
        confidenceLevel: "MEDIUM",
        methodology: "Comparable $/MW applied to estimated capacity.",
        sourceIndex: 0,
      },
    ],
  },
  {
    name: "New Carlisle Data Center Region",
    description:
      "Multi-building AI region anchored to a dedicated substation build-out.",
    owner: "Amazon Web Services",
    projectType: "HYPERSCALE_CAMPUS",
    status: "PARTIALLY_OPERATIONAL",
    city: "New Carlisle",
    stateRegion: "Indiana",
    country: "United States",
    latitude: 41.7017,
    longitude: -86.5083,
    announcementDate: "2024-01-24",
    expectedOpeningDate: "2026-11-01",
    actualOpeningDate: "2026-02-15",
    estimatedPowerMw: 2200,
    confirmedPowerMw: 600,
    estimatedGpuCount: 400000,
    confirmedGpuCount: 96000,
    gpuModel: "AWS Trainium3",
    computePlatform: "AWS Trainium",
    estimatedCapexUsd: 14_000_000_000,
    confirmedCapexUsd: 11_000_000_000,
    squareFeet: 3_800_000,
    coolingTechnology: "Rear-door heat exchanger + liquid",
    powerSource: "Grid",
    utilityProvider: "Indiana Michigan Power",
    confidenceScore: 81,
    tags: ["Trainium", "liquid cooling"],
    partners: [
      { company: "Amazon Web Services", role: "OWNER" },
      { company: "Arista Networks", role: "NETWORKING_SUPPLIER" },
      { company: "Schneider Electric", role: "POWER_EQUIPMENT_SUPPLIER" },
    ],
    sources: [
      {
        title: "AWS news blog",
        publisher: "Amazon",
        url: "https://aws.amazon.com/blogs/aws/",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2024-01-24",
        reliabilityScore: 95,
        isPrimarySource: true,
      },
      {
        title: "Amazon quarterly report",
        publisher: "Amazon (SEC)",
        url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=AMZN",
        sourceType: "SEC_FILING",
        publicationDate: "2026-02-06",
        reliabilityScore: 99,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 600,
        unit: "MW",
        confidenceLevel: "CONFIRMED",
        methodology: "Energised capacity per company statement.",
        effectiveDate: "2026-02-15",
        sourceIndex: 1,
      },
      {
        metricType: "GPU_COUNT",
        numericValue: 96000,
        unit: "accelerators",
        confidenceLevel: "CONFIRMED",
        methodology: "Company-stated accelerator count at first-phase go-live.",
        sourceIndex: 0,
      },
      {
        metricType: "CAPEX_USD",
        numericValue: 11_000_000_000,
        unit: "USD",
        confidenceLevel: "CONFIRMED",
        methodology: "Cumulative state-level investment disclosure.",
        sourceIndex: 1,
      },
      {
        metricType: "PUE",
        numericValue: 1.09,
        confidenceLevel: "MEDIUM",
        methodology: "Design PUE, not measured trailing-twelve-month.",
      },
    ],
  },
  {
    name: "Council Bluffs TPU Expansion",
    description: "TPU-dense expansion of an existing Iowa campus.",
    owner: "Google",
    projectType: "AI_FACTORY",
    status: "OPERATIONAL",
    city: "Council Bluffs",
    stateRegion: "Iowa",
    country: "United States",
    latitude: 41.2619,
    longitude: -95.8608,
    announcementDate: "2023-09-14",
    expectedOpeningDate: "2025-10-01",
    actualOpeningDate: "2025-09-20",
    confirmedPowerMw: 380,
    estimatedPowerMw: 380,
    confirmedGpuCount: 64000,
    gpuModel: "Google TPU v6e",
    computePlatform: "Google TPU",
    confirmedCapexUsd: 4_500_000_000,
    squareFeet: 1_100_000,
    coolingTechnology: "Direct-to-chip liquid",
    powerSource: "Grid + wind PPA",
    utilityProvider: "MidAmerican Energy",
    confidenceScore: 88,
    tags: ["TPU", "liquid cooling", "renewables"],
    partners: [
      { company: "Google", role: "OWNER" },
      { company: "Vertiv", role: "COOLING_SUPPLIER" },
    ],
    sources: [
      {
        title: "Google data centers",
        publisher: "Google",
        url: "https://www.google.com/about/datacenters/",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2023-09-14",
        reliabilityScore: 95,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 380,
        unit: "MW",
        confidenceLevel: "CONFIRMED",
        methodology: "Company disclosure at commissioning.",
        sourceIndex: 0,
      },
      {
        metricType: "OPENING_DATE",
        textValue: "2025-09-20",
        confidenceLevel: "CONFIRMED",
        methodology: "Commissioning date per owner.",
        sourceIndex: 0,
      },
    ],
  },
  {
    name: "Prometheus Cluster",
    description:
      "Gas-turbine-adjacent AI training cluster built for rapid energisation.",
    owner: "Meta",
    projectType: "GPU_CLUSTER",
    status: "UNDER_CONSTRUCTION",
    city: "New Albany",
    stateRegion: "Ohio",
    country: "United States",
    latitude: 40.081,
    longitude: -82.8088,
    announcementDate: "2025-07-14",
    expectedOpeningDate: "2026-12-01",
    estimatedPowerMw: 1000,
    estimatedGpuCount: 220000,
    gpuModel: "NVIDIA GB300",
    computePlatform: "NVIDIA Blackwell Ultra",
    estimatedCapexUsd: 9_000_000_000,
    coolingTechnology: "Liquid, closed loop",
    powerSource: "On-site natural gas turbines",
    utilityProvider: "AEP Ohio",
    confidenceScore: 61,
    tags: ["NVIDIA", "Blackwell", "natural gas", "liquid cooling"],
    partners: [
      { company: "Meta", role: "OWNER" },
      { company: "NVIDIA", role: "GPU_SUPPLIER" },
      { company: "GE Vernova", role: "POWER_EQUIPMENT_SUPPLIER" },
    ],
    sources: [
      {
        title: "Meta newsroom",
        publisher: "Meta",
        url: "https://about.fb.com/news/",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2025-07-14",
        reliabilityScore: 92,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 1000,
        unit: "MW",
        confidenceLevel: "LOW",
        methodology: "Founder statement on social media; no filing corroboration.",
        sourceIndex: 0,
      },
      {
        metricType: "GPU_COUNT",
        numericValue: 220000,
        unit: "GPUs",
        confidenceLevel: "ESTIMATED",
        methodology: "Derived from estimated MW at 4.5 kW/GPU all-in.",
      },
    ],
  },
  {
    name: "Abilene Stargate Site 1",
    description: "Anchor site of a large US AI build-out programme.",
    owner: "Oracle",
    projectType: "AI_FACTORY",
    status: "PARTIALLY_OPERATIONAL",
    city: "Abilene",
    stateRegion: "Texas",
    country: "United States",
    latitude: 32.4487,
    longitude: -99.7331,
    announcementDate: "2025-01-21",
    expectedOpeningDate: "2026-09-01",
    actualOpeningDate: "2025-12-05",
    estimatedPowerMw: 1200,
    confirmedPowerMw: 200,
    estimatedGpuCount: 400000,
    confirmedGpuCount: 50000,
    gpuModel: "NVIDIA GB200 NVL72",
    computePlatform: "NVIDIA Blackwell",
    estimatedCapexUsd: 12_000_000_000,
    squareFeet: 1_900_000,
    coolingTechnology: "Direct-to-chip liquid",
    powerSource: "Grid + on-site gas",
    utilityProvider: "Oncor Electric Delivery",
    confidenceScore: 70,
    tags: ["NVIDIA", "Blackwell", "natural gas"],
    partners: [
      { company: "Oracle", role: "OPERATOR" },
      { company: "OpenAI", role: "TENANT" },
      { company: "Crusoe Energy", role: "DEVELOPER" },
      { company: "NVIDIA", role: "GPU_SUPPLIER" },
      { company: "Oncor Electric Delivery", role: "UTILITY" },
      { company: "SoftBank Group", role: "INVESTOR" },
    ],
    sources: [
      {
        title: "Oracle newsroom",
        publisher: "Oracle",
        url: "https://www.oracle.com/news/",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2025-01-21",
        reliabilityScore: 92,
        isPrimarySource: true,
      },
      {
        title: "ERCOT large load interconnection queue",
        publisher: "ERCOT",
        url: "https://www.ercot.com/",
        sourceType: "UTILITY_FILING",
        publicationDate: "2025-11-14",
        reliabilityScore: 96,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 200,
        unit: "MW",
        confidenceLevel: "CONFIRMED",
        methodology: "Energised load in queue filing.",
        effectiveDate: "2025-11-14",
        sourceIndex: 1,
      },
      {
        metricType: "POWER_MW",
        numericValue: 1200,
        unit: "MW",
        confidenceLevel: "MEDIUM",
        methodology: "Full programme capacity at completion per owner statement.",
        sourceIndex: 0,
      },
      {
        metricType: "LAND_ACRES",
        numericValue: 875,
        unit: "acres",
        confidenceLevel: "HIGH",
        sourceIndex: 1,
      },
    ],
  },
  {
    name: "Colossus 2",
    description: "Second-generation single-coherent training cluster.",
    owner: "xAI",
    projectType: "GPU_CLUSTER",
    status: "UNDER_CONSTRUCTION",
    city: "Memphis",
    stateRegion: "Tennessee",
    country: "United States",
    latitude: 35.0651,
    longitude: -90.0673,
    announcementDate: "2025-06-02",
    expectedOpeningDate: "2026-08-01",
    estimatedPowerMw: 1100,
    confirmedPowerMw: 300,
    estimatedGpuCount: 550000,
    gpuModel: "NVIDIA GB200/GB300",
    computePlatform: "NVIDIA Blackwell",
    estimatedCapexUsd: 11_500_000_000,
    coolingTechnology: "Liquid + on-site chillers",
    powerSource: "Grid + gas turbines + battery",
    utilityProvider: "Memphis Light, Gas and Water",
    confidenceScore: 55,
    tags: ["NVIDIA", "Blackwell", "natural gas", "liquid cooling"],
    partners: [
      { company: "xAI", role: "OWNER" },
      { company: "NVIDIA", role: "GPU_SUPPLIER" },
      { company: "Supermicro", role: "SERVER_SUPPLIER" },
    ],
    sources: [
      {
        title: "xAI company site",
        publisher: "xAI",
        url: "https://x.ai/",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2025-06-02",
        reliabilityScore: 80,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 300,
        unit: "MW",
        confidenceLevel: "MEDIUM",
        methodology: "Utility-reported service capacity.",
        sourceIndex: 0,
      },
      {
        metricType: "GPU_COUNT",
        numericValue: 550000,
        unit: "GPUs",
        confidenceLevel: "LOW",
        methodology: "Owner target statement, not an installed count.",
      },
    ],
  },
  {
    name: "Denton AI Factory",
    description: "Purpose-built AI factory leased to multiple model developers.",
    owner: "CoreWeave",
    projectType: "AI_FACTORY",
    status: "OPERATIONAL",
    city: "Denton",
    stateRegion: "Texas",
    country: "United States",
    latitude: 33.2148,
    longitude: -97.1331,
    announcementDate: "2024-06-11",
    expectedOpeningDate: "2025-08-01",
    actualOpeningDate: "2025-07-22",
    confirmedPowerMw: 240,
    estimatedPowerMw: 240,
    confirmedGpuCount: 48000,
    gpuModel: "NVIDIA H200",
    computePlatform: "NVIDIA Hopper",
    confirmedCapexUsd: 2_800_000_000,
    squareFeet: 620_000,
    coolingTechnology: "Direct-to-chip liquid",
    powerSource: "Grid",
    utilityProvider: "Denton Municipal Electric",
    confidenceScore: 84,
    tags: ["NVIDIA", "liquid cooling"],
    partners: [
      { company: "CoreWeave", role: "OPERATOR" },
      { company: "Blackstone", role: "INVESTOR" },
      { company: "Dell Technologies", role: "SERVER_SUPPLIER" },
      { company: "NVIDIA", role: "GPU_SUPPLIER" },
    ],
    sources: [
      {
        title: "CoreWeave newsroom",
        publisher: "CoreWeave",
        url: "https://www.coreweave.com/news",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2024-06-11",
        reliabilityScore: 90,
        isPrimarySource: true,
      },
      {
        title: "CoreWeave annual report",
        publisher: "CoreWeave (SEC)",
        url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=CRWV",
        sourceType: "SEC_FILING",
        publicationDate: "2026-03-02",
        reliabilityScore: 99,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 240,
        unit: "MW",
        confidenceLevel: "CONFIRMED",
        methodology: "Contracted capacity disclosed in annual report.",
        sourceIndex: 1,
      },
      {
        metricType: "SQUARE_FEET",
        numericValue: 620000,
        unit: "sq ft",
        confidenceLevel: "CONFIRMED",
        sourceIndex: 1,
      },
      {
        metricType: "RACK_COUNT",
        numericValue: 3400,
        unit: "racks",
        confidenceLevel: "HIGH",
        methodology: "Derived from disclosed MW at 70 kW/rack average.",
      },
    ],
  },
  {
    name: "Glomfjord Sovereign Cluster",
    description:
      "Hydro-powered sovereign AI capacity for Nordic public-sector workloads.",
    owner: "Nscale",
    projectType: "SOVEREIGN_AI",
    status: "UNDER_CONSTRUCTION",
    city: "Glomfjord",
    stateRegion: "Nordland",
    country: "Norway",
    latitude: 66.8167,
    longitude: 13.95,
    announcementDate: "2025-02-18",
    expectedOpeningDate: "2026-10-01",
    estimatedPowerMw: 150,
    confirmedPowerMw: 90,
    estimatedGpuCount: 22000,
    gpuModel: "NVIDIA GB200",
    computePlatform: "NVIDIA Blackwell",
    estimatedCapexUsd: 1_600_000_000,
    coolingTechnology: "Free cooling + liquid",
    powerSource: "Hydroelectric",
    utilityProvider: "Statnett",
    confidenceScore: 74,
    tags: ["NVIDIA", "Blackwell", "renewables", "sovereign AI"],
    partners: [
      { company: "Nscale", role: "OWNER" },
      { company: "NVIDIA", role: "GPU_SUPPLIER" },
      { company: "Statnett", role: "UTILITY" },
    ],
    sources: [
      {
        title: "Nscale news",
        publisher: "Nscale",
        url: "https://www.nscale.com/",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2025-02-18",
        reliabilityScore: 85,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 90,
        unit: "MW",
        confidenceLevel: "HIGH",
        methodology: "Grid connection agreement.",
        sourceIndex: 0,
      },
      {
        metricType: "PUE",
        numericValue: 1.15,
        confidenceLevel: "ESTIMATED",
        methodology: "Climate-adjusted estimate for free-cooling site.",
      },
    ],
  },
  {
    name: "Sakura AI Bridge",
    description:
      "Government-backed sovereign AI compute for Japanese industry and research.",
    owner: "SoftBank Group",
    projectType: "SOVEREIGN_AI",
    status: "PLANNING",
    city: "Sakai",
    stateRegion: "Osaka",
    country: "Japan",
    latitude: 34.5733,
    longitude: 135.483,
    announcementDate: "2025-09-30",
    expectedOpeningDate: "2027-04-01",
    estimatedPowerMw: 450,
    estimatedGpuCount: 85000,
    gpuModel: "NVIDIA GB300",
    computePlatform: "NVIDIA Blackwell Ultra",
    estimatedCapexUsd: 5_200_000_000,
    coolingTechnology: "Liquid",
    powerSource: "Grid",
    confidenceScore: 52,
    tags: ["NVIDIA", "sovereign AI", "liquid cooling"],
    partners: [
      { company: "SoftBank Group", role: "OWNER" },
      { company: "Government of Japan (METI)", role: "INVESTOR" },
      { company: "NVIDIA", role: "GPU_SUPPLIER" },
    ],
    sources: [
      {
        title: "SoftBank Group news",
        publisher: "SoftBank Group",
        url: "https://group.softbank/en/news",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2025-09-30",
        reliabilityScore: 88,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 450,
        unit: "MW",
        confidenceLevel: "ESTIMATED",
        methodology: "Programme target; site allocation not finalised.",
        sourceIndex: 0,
      },
      {
        metricType: "CAPEX_USD",
        numericValue: 5_200_000_000,
        unit: "USD",
        confidenceLevel: "LOW",
        methodology:
          "Announced programme budget including subsidy, FX at announcement.",
      },
    ],
  },
  {
    name: "Jamnagar Green AI Campus",
    description:
      "Renewables-anchored AI campus intended to host sovereign and enterprise workloads.",
    owner: "Government of India (MeitY)",
    projectType: "SOVEREIGN_AI",
    status: "ANNOUNCED",
    city: "Jamnagar",
    stateRegion: "Gujarat",
    country: "India",
    latitude: 22.4707,
    longitude: 70.0577,
    announcementDate: "2025-10-28",
    expectedOpeningDate: "2028-01-01",
    estimatedPowerMw: 1000,
    estimatedGpuCount: 120000,
    gpuModel: "NVIDIA GB200",
    computePlatform: "NVIDIA Blackwell",
    estimatedCapexUsd: 8_000_000_000,
    powerSource: "Solar + wind + grid",
    coolingTechnology: "Liquid",
    confidenceScore: 38,
    tags: ["NVIDIA", "renewables", "sovereign AI"],
    partners: [
      { company: "Government of India (MeitY)", role: "INVESTOR" },
      { company: "NVIDIA", role: "GPU_SUPPLIER" },
    ],
    sources: [
      {
        title: "MeitY press releases",
        publisher: "Government of India",
        url: "https://www.meity.gov.in/",
        sourceType: "GOVERNMENT_FILING",
        publicationDate: "2025-10-28",
        reliabilityScore: 85,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 1000,
        unit: "MW",
        confidenceLevel: "ESTIMATED",
        methodology:
          "Stated ambition at announcement; no interconnection filing located.",
        sourceIndex: 0,
      },
    ],
  },
  {
    name: "Iceland HPC Node",
    description: "Academic HPC system repurposed for shared AI research workloads.",
    owner: "Nscale",
    projectType: "HPC",
    status: "OPERATIONAL",
    city: "Reykjanesbær",
    country: "Iceland",
    latitude: 63.995,
    longitude: -22.562,
    announcementDate: "2024-04-09",
    actualOpeningDate: "2025-01-30",
    expectedOpeningDate: "2025-02-01",
    confirmedPowerMw: 35,
    estimatedPowerMw: 35,
    confirmedGpuCount: 5200,
    gpuModel: "AMD Instinct MI355X",
    computePlatform: "AMD Instinct",
    confirmedCapexUsd: 420_000_000,
    coolingTechnology: "Free cooling",
    powerSource: "Geothermal + hydro",
    confidenceScore: 79,
    tags: ["AMD", "renewables"],
    partners: [
      { company: "Nscale", role: "OPERATOR" },
      { company: "AMD", role: "GPU_SUPPLIER" },
      { company: "Supermicro", role: "SERVER_SUPPLIER" },
    ],
    sources: [
      {
        title: "Nscale news",
        publisher: "Nscale",
        url: "https://www.nscale.com/news",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2024-04-09",
        reliabilityScore: 85,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 35,
        unit: "MW",
        confidenceLevel: "CONFIRMED",
        sourceIndex: 0,
      },
      {
        metricType: "GPU_COUNT",
        numericValue: 5200,
        unit: "GPUs",
        confidenceLevel: "CONFIRMED",
        sourceIndex: 0,
      },
    ],
  },
  {
    name: "Permian Flare-Gas Compute Node 7",
    description: "Modular compute sited on associated gas to avoid flaring.",
    owner: "Crusoe Energy",
    projectType: "POWER_PROJECT",
    status: "OPERATIONAL",
    city: "Midland",
    stateRegion: "Texas",
    country: "United States",
    latitude: 31.9973,
    longitude: -102.0779,
    announcementDate: "2024-11-05",
    actualOpeningDate: "2025-06-18",
    expectedOpeningDate: "2025-06-01",
    confirmedPowerMw: 48,
    estimatedPowerMw: 48,
    estimatedGpuCount: 6400,
    gpuModel: "NVIDIA H100",
    computePlatform: "NVIDIA Hopper",
    confirmedCapexUsd: 310_000_000,
    coolingTechnology: "Immersion",
    powerSource: "Associated natural gas",
    confidenceScore: 76,
    tags: ["NVIDIA", "natural gas"],
    partners: [
      { company: "Crusoe Energy", role: "OWNER" },
      { company: "NVIDIA", role: "GPU_SUPPLIER" },
    ],
    sources: [
      {
        title: "Crusoe newsroom",
        publisher: "Crusoe Energy",
        url: "https://www.crusoe.ai/newsroom",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2024-11-05",
        reliabilityScore: 87,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 48,
        unit: "MW",
        confidenceLevel: "CONFIRMED",
        sourceIndex: 0,
      },
    ],
  },
  {
    name: "Loudoun Colocation Block C",
    description: "Wholesale colocation shell pre-leased to AI tenants.",
    owner: "Blackstone",
    projectType: "COLOCATION",
    status: "PERMITTING",
    city: "Ashburn",
    stateRegion: "Virginia",
    country: "United States",
    latitude: 39.0438,
    longitude: -77.4874,
    announcementDate: "2025-08-19",
    expectedOpeningDate: "2027-03-01",
    estimatedPowerMw: 320,
    estimatedCapexUsd: 3_100_000_000,
    squareFeet: 850_000,
    coolingTechnology: "Air + liquid-ready",
    powerSource: "Grid",
    utilityProvider: "Dominion Energy",
    confidenceScore: 47,
    tags: ["liquid cooling"],
    partners: [
      { company: "Blackstone", role: "OWNER" },
      { company: "Dominion Energy", role: "UTILITY" },
      { company: "Turner Construction", role: "CONSTRUCTION_PARTNER" },
    ],
    sources: [
      {
        title: "Loudoun County land development applications",
        publisher: "Loudoun County",
        url: "https://www.loudoun.gov/",
        sourceType: "PERMIT",
        publicationDate: "2025-08-19",
        reliabilityScore: 92,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 320,
        unit: "MW",
        confidenceLevel: "MEDIUM",
        methodology: "Requested load in the permit application; approval pending.",
        sourceIndex: 0,
      },
    ],
  },
  {
    name: "Sines Atlantic Campus",
    description: "Subsea-cable-adjacent campus targeting European inference capacity.",
    owner: "Microsoft",
    projectType: "DATA_CENTER",
    status: "DELAYED",
    city: "Sines",
    stateRegion: "Setúbal",
    country: "Portugal",
    latitude: 37.956,
    longitude: -8.869,
    announcementDate: "2024-05-16",
    expectedOpeningDate: "2026-03-01",
    estimatedPowerMw: 280,
    confirmedPowerMw: 120,
    estimatedGpuCount: 34000,
    gpuModel: "NVIDIA H200",
    computePlatform: "NVIDIA Hopper",
    estimatedCapexUsd: 2_400_000_000,
    coolingTechnology: "Air + adiabatic",
    powerSource: "Grid + solar PPA",
    confidenceScore: 58,
    tags: ["NVIDIA", "renewables"],
    partners: [
      { company: "Microsoft", role: "TENANT" },
      { company: "NVIDIA", role: "GPU_SUPPLIER" },
    ],
    sources: [
      {
        title: "Microsoft newsroom — Europe",
        publisher: "Microsoft",
        url: "https://news.microsoft.com/europe/",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2024-05-16",
        reliabilityScore: 93,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 120,
        unit: "MW",
        confidenceLevel: "HIGH",
        methodology: "Phase 1 grid connection.",
        sourceIndex: 0,
      },
      {
        metricType: "OPENING_DATE",
        textValue: "Slipped from Q1 2026; no revised date published.",
        confidenceLevel: "LOW",
        methodology: "Analyst read on grid connection queue position.",
      },
    ],
  },
  {
    name: "Querétaro Inference Region",
    description: "Latin American inference region serving regional enterprise demand.",
    owner: "Oracle",
    projectType: "DATA_CENTER",
    status: "RUMORED",
    city: "Querétaro",
    stateRegion: "Querétaro",
    country: "Mexico",
    latitude: 20.5888,
    longitude: -100.3899,
    estimatedPowerMw: 90,
    estimatedCapexUsd: 800_000_000,
    powerSource: "Grid",
    confidenceScore: 22,
    tags: [],
    partners: [{ company: "Oracle", role: "OWNER" }],
    sources: [
      {
        title: "Regional press coverage roundup",
        publisher: "Trade press",
        url: "https://www.datacenterdynamics.com/en/",
        sourceType: "NEWS_ARTICLE",
        publicationDate: "2026-01-12",
        reliabilityScore: 55,
        isPrimarySource: false,
        excerpt: "Demo excerpt — placeholder text for UI development.",
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 90,
        unit: "MW",
        confidenceLevel: "LOW",
        methodology: "Single secondary report; unconfirmed by the owner.",
        sourceIndex: 0,
      },
    ],
  },
  {
    name: "Ohio Campus Expansion (Cancelled)",
    description:
      "Announced expansion later abandoned; retained as a cancellation precedent.",
    owner: "Meta",
    projectType: "HYPERSCALE_CAMPUS",
    status: "CANCELLED",
    city: "Lancaster",
    stateRegion: "Ohio",
    country: "United States",
    latitude: 39.7137,
    longitude: -82.5993,
    announcementDate: "2024-02-20",
    expectedOpeningDate: "2026-06-01",
    estimatedPowerMw: 250,
    estimatedCapexUsd: 1_900_000_000,
    powerSource: "Grid",
    utilityProvider: "AEP Ohio",
    confidenceScore: 66,
    tags: [],
    partners: [{ company: "Meta", role: "OWNER" }],
    sources: [
      {
        title: "Meta newsroom",
        publisher: "Meta",
        url: "https://about.fb.com/news/",
        sourceType: "COMPANY_ANNOUNCEMENT",
        publicationDate: "2025-04-03",
        reliabilityScore: 92,
        isPrimarySource: true,
      },
    ],
    metrics: [
      {
        metricType: "POWER_MW",
        numericValue: 250,
        unit: "MW",
        confidenceLevel: "MEDIUM",
        methodology: "Capacity as announced before cancellation.",
        sourceIndex: 0,
      },
    ],
  },
];

function date(value?: string): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

async function main() {
  console.log("Seeding BEP AI Infrastructure Tracker…");

  // --- Admin user ---------------------------------------------------------
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@bepresearch.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme-in-dev";
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", name: process.env.SEED_ADMIN_NAME ?? "BEP Admin" },
    create: {
      email,
      name: process.env.SEED_ADMIN_NAME ?? "BEP Admin",
      role: "ADMIN",
      passwordHash: await hash(password, 12),
    },
  });
  console.log(`  admin user: ${admin.email}`);

  // A second, non-admin account so role behaviour can be exercised locally.
  await prisma.user.upsert({
    where: { email: "viewer@bepresearch.com" },
    update: {},
    create: {
      email: "viewer@bepresearch.com",
      name: "Demo Viewer",
      role: "VIEWER",
      passwordHash: await hash(password, 12),
    },
  });

  // --- Tags ---------------------------------------------------------------
  for (const name of TAGS) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, slug: slugify(name) },
    });
  }
  console.log(`  tags: ${TAGS.length}`);

  // --- Companies ----------------------------------------------------------
  const companyIdByName = new Map<string, string>();
  for (const c of COMPANIES) {
    const company = await prisma.company.upsert({
      where: { slug: slugify(c.name) },
      update: { companyType: c.companyType, ticker: c.ticker ?? null },
      create: {
        name: c.name,
        slug: slugify(c.name),
        companyType: c.companyType,
        ticker: c.ticker ?? null,
        website: c.website ?? null,
        headquartersCountry: c.headquartersCountry ?? null,
        description: c.description ?? null,
      },
    });
    companyIdByName.set(c.name, company.id);
  }
  console.log(`  companies: ${COMPANIES.length}`);

  // --- Projects -----------------------------------------------------------
  for (const p of PROJECTS) {
    const slug = slugify(p.name);
    const ownerId = companyIdByName.get(p.owner) ?? null;

    // Rewrite rather than merge: the seed is the authority for demo rows, and a
    // partial update would leave stale children from an earlier shape.
    await prisma.project.deleteMany({ where: { slug, isDemoData: true } });

    const project = await prisma.project.create({
      data: {
        slug,
        name: p.name,
        description: p.description,
        ownerCompanyId: ownerId,
        projectType: p.projectType,
        status: p.status,
        city: p.city ?? null,
        stateRegion: p.stateRegion ?? null,
        country: p.country,
        latitude: p.latitude,
        longitude: p.longitude,
        announcementDate: date(p.announcementDate),
        expectedOpeningDate: date(p.expectedOpeningDate),
        actualOpeningDate: date(p.actualOpeningDate),
        estimatedPowerMw: p.estimatedPowerMw ?? null,
        confirmedPowerMw: p.confirmedPowerMw ?? null,
        estimatedGpuCount: p.estimatedGpuCount ?? null,
        confirmedGpuCount: p.confirmedGpuCount ?? null,
        gpuModel: p.gpuModel ?? null,
        computePlatform: p.computePlatform ?? null,
        estimatedCapexUsd: p.estimatedCapexUsd ?? null,
        confirmedCapexUsd: p.confirmedCapexUsd ?? null,
        squareFeet: p.squareFeet ?? null,
        coolingTechnology: p.coolingTechnology ?? null,
        powerSource: p.powerSource ?? null,
        utilityProvider: p.utilityProvider ?? null,
        confidenceScore: p.confidenceScore,
        analystNotes: DEMO_NOTE,
        // Spread last-verified dates across the window so the verification
        // queue has both fresh and stale rows to show.
        lastVerifiedAt: new Date(
          Date.UTC(2026, 6, 24) -
            Math.round(Math.abs(p.confidenceScore - 50)) * 4 * 86_400_000,
        ),
        isDemoData: true,
        tags: {
          connect: p.tags.map((name) => ({ name })),
        },
        companies: {
          create: p.partners
            .filter((partner) => companyIdByName.has(partner.company))
            .map((partner) => ({
              companyId: companyIdByName.get(partner.company)!,
              role: partner.role,
              notes: partner.notes ?? null,
            })),
        },
      },
    });

    // Sources first: metrics reference them by index.
    const sourceIds: string[] = [];
    for (const s of p.sources) {
      const source = await prisma.source.create({
        data: {
          projectId: project.id,
          title: s.title,
          publisher: s.publisher,
          url: s.url,
          publicationDate: date(s.publicationDate),
          sourceType: s.sourceType,
          excerpt: s.excerpt ?? null,
          reliabilityScore: s.reliabilityScore,
          isPrimarySource: s.isPrimarySource,
          accessedAt: new Date(Date.UTC(2026, 6, 20)),
        },
      });
      sourceIds.push(source.id);
    }

    for (const m of p.metrics) {
      await prisma.projectMetric.create({
        data: {
          projectId: project.id,
          metricType: m.metricType,
          numericValue: m.numericValue ?? null,
          textValue: m.textValue ?? null,
          unit: m.unit ?? null,
          confidenceLevel: m.confidenceLevel,
          methodology: m.methodology ?? null,
          effectiveDate: date(m.effectiveDate),
          sourceId:
            m.sourceIndex !== undefined ? (sourceIds[m.sourceIndex] ?? null) : null,
        },
      });
    }

    await prisma.projectRevision.create({
      data: {
        projectId: project.id,
        userId: admin.id,
        changeSummary: "Record created by development seed (demo data).",
        newData: { seeded: true, name: p.name },
      },
    });
  }

  console.log(`  projects: ${PROJECTS.length} (all flagged isDemoData)`);
  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
