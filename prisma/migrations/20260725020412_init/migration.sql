-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('HYPERSCALER', 'NEOCLOUD', 'COLOCATION_PROVIDER', 'GPU_VENDOR', 'SERVER_VENDOR', 'NETWORKING_VENDOR', 'COOLING_VENDOR', 'POWER_VENDOR', 'UTILITY', 'CONSTRUCTION', 'REAL_ESTATE', 'GOVERNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('AI_FACTORY', 'DATA_CENTER', 'GPU_CLUSTER', 'HYPERSCALE_CAMPUS', 'COLOCATION', 'SOVEREIGN_AI', 'HPC', 'POWER_PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('RUMORED', 'ANNOUNCED', 'PLANNING', 'PERMITTING', 'UNDER_CONSTRUCTION', 'PARTIALLY_OPERATIONAL', 'OPERATIONAL', 'DELAYED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectCompanyRole" AS ENUM ('OWNER', 'OPERATOR', 'DEVELOPER', 'TENANT', 'INVESTOR', 'GPU_SUPPLIER', 'SERVER_SUPPLIER', 'NETWORKING_SUPPLIER', 'COOLING_SUPPLIER', 'POWER_EQUIPMENT_SUPPLIER', 'UTILITY', 'CONSTRUCTION_PARTNER', 'LAND_OWNER', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('COMPANY_ANNOUNCEMENT', 'SEC_FILING', 'EARNINGS_CALL', 'GOVERNMENT_FILING', 'PERMIT', 'UTILITY_FILING', 'NEWS_ARTICLE', 'INDUSTRY_REPORT', 'CONFERENCE', 'SOCIAL_MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('POWER_MW', 'GPU_COUNT', 'CAPEX_USD', 'SQUARE_FEET', 'RACK_COUNT', 'LAND_ACRES', 'PUE', 'OPENING_DATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('CONFIRMED', 'HIGH', 'MEDIUM', 'LOW', 'ESTIMATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "companyType" "CompanyType" NOT NULL,
    "ticker" TEXT,
    "website" TEXT,
    "headquartersCountry" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerCompanyId" TEXT,
    "projectType" "ProjectType" NOT NULL,
    "status" "ProjectStatus" NOT NULL,
    "city" TEXT,
    "stateRegion" TEXT,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "announcementDate" TIMESTAMP(3),
    "expectedOpeningDate" TIMESTAMP(3),
    "actualOpeningDate" TIMESTAMP(3),
    "estimatedPowerMw" DECIMAL(12,3),
    "confirmedPowerMw" DECIMAL(12,3),
    "estimatedGpuCount" INTEGER,
    "confirmedGpuCount" INTEGER,
    "gpuModel" TEXT,
    "computePlatform" TEXT,
    "estimatedCapexUsd" DECIMAL(18,2),
    "confirmedCapexUsd" DECIMAL(18,2),
    "squareFeet" INTEGER,
    "coolingTechnology" TEXT,
    "powerSource" TEXT,
    "utilityProvider" TEXT,
    "confidenceScore" INTEGER,
    "analystNotes" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "isDemoData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCompany" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "ProjectCompanyRole" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "url" TEXT NOT NULL,
    "publicationDate" TIMESTAMP(3),
    "sourceType" "SourceType" NOT NULL,
    "excerpt" TEXT,
    "archivedUrl" TEXT,
    "reliabilityScore" INTEGER,
    "isPrimarySource" BOOLEAN NOT NULL DEFAULT false,
    "accessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMetric" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "numericValue" DECIMAL(20,4),
    "textValue" TEXT,
    "unit" TEXT,
    "confidenceLevel" "ConfidenceLevel" NOT NULL,
    "methodology" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRevision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "changeSummary" TEXT NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProjectTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProjectTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_companyType_idx" ON "Company"("companyType");

-- CreateIndex
CREATE INDEX "Company_ticker_idx" ON "Company"("ticker");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_projectType_idx" ON "Project"("projectType");

-- CreateIndex
CREATE INDEX "Project_country_idx" ON "Project"("country");

-- CreateIndex
CREATE INDEX "Project_ownerCompanyId_idx" ON "Project"("ownerCompanyId");

-- CreateIndex
CREATE INDEX "Project_lastVerifiedAt_idx" ON "Project"("lastVerifiedAt");

-- CreateIndex
CREATE INDEX "Project_expectedOpeningDate_idx" ON "Project"("expectedOpeningDate");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "ProjectCompany_companyId_idx" ON "ProjectCompany"("companyId");

-- CreateIndex
CREATE INDEX "ProjectCompany_projectId_idx" ON "ProjectCompany"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCompany_projectId_companyId_role_key" ON "ProjectCompany"("projectId", "companyId", "role");

-- CreateIndex
CREATE INDEX "Source_projectId_idx" ON "Source"("projectId");

-- CreateIndex
CREATE INDEX "Source_sourceType_idx" ON "Source"("sourceType");

-- CreateIndex
CREATE INDEX "Source_url_idx" ON "Source"("url");

-- CreateIndex
CREATE INDEX "ProjectMetric_projectId_idx" ON "ProjectMetric"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMetric_metricType_idx" ON "ProjectMetric"("metricType");

-- CreateIndex
CREATE INDEX "ProjectMetric_sourceId_idx" ON "ProjectMetric"("sourceId");

-- CreateIndex
CREATE INDEX "ProjectRevision_projectId_createdAt_idx" ON "ProjectRevision"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectRevision_userId_idx" ON "ProjectRevision"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "_ProjectTags_B_index" ON "_ProjectTags"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerCompanyId_fkey" FOREIGN KEY ("ownerCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCompany" ADD CONSTRAINT "ProjectCompany_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCompany" ADD CONSTRAINT "ProjectCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMetric" ADD CONSTRAINT "ProjectMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMetric" ADD CONSTRAINT "ProjectMetric_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRevision" ADD CONSTRAINT "ProjectRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRevision" ADD CONSTRAINT "ProjectRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectTags" ADD CONSTRAINT "_ProjectTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectTags" ADD CONSTRAINT "_ProjectTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
