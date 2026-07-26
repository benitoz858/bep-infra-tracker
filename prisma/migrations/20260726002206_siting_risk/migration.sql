-- CreateEnum
CREATE TYPE "GridRegion" AS ENUM ('PJM', 'ERCOT', 'MISO', 'CAISO', 'SPP', 'NYISO', 'ISONE', 'WECC_NON_ISO', 'SERC_NON_ISO', 'CANADA', 'EU_ENTSOE', 'UK_NESO', 'NORDIC', 'JAPAN', 'KOREA', 'INDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "JurisdictionLevel" AS ENUM ('CITY', 'TOWN', 'VILLAGE', 'TOWNSHIP', 'BOROUGH', 'COUNTY', 'STATE', 'PROVINCE', 'NATIONAL', 'SPECIAL_DISTRICT', 'TRIBAL', 'UTILITY_TERRITORY');

-- CreateEnum
CREATE TYPE "RestrictionScope" AS ENUM ('NEW_CONSTRUCTION', 'REZONING', 'PERMIT_ISSUANCE', 'UTILITY_INTERCONNECTION', 'WATER_USE', 'BEHIND_METER_GENERATION', 'NOISE_OR_SETBACK', 'TAX_ABATEMENT', 'DISCLOSURE_ONLY', 'OTHER');

-- CreateEnum
CREATE TYPE "BindingLevel" AS ENUM ('ADVISORY', 'PROPOSED', 'PROCEDURAL', 'CONDITIONAL', 'TEMPORARY_BAN', 'PERMANENT_BAN');

-- CreateEnum
CREATE TYPE "RestrictionStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'EXPIRED', 'LIFTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "RestrictionImpact" AS ENUM ('BLOCKED', 'DELAYED', 'EXEMPT', 'UNDER_REVIEW');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "gridRegion" "GridRegion",
ADD COLUMN     "queueZone" TEXT;

-- CreateTable
CREATE TABLE "Restriction" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "level" "JurisdictionLevel" NOT NULL,
    "stateRegion" TEXT,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gridRegion" "GridRegion",
    "scope" "RestrictionScope" NOT NULL,
    "bindingLevel" "BindingLevel" NOT NULL,
    "status" "RestrictionStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "citation" TEXT,
    "proposedDate" TIMESTAMP(3),
    "enactedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "liftedDate" TIMESTAMP(3),
    "analystNotes" TEXT,
    "confidenceScore" INTEGER,
    "lastVerifiedAt" TIMESTAMP(3),
    "isDemoData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestrictionSource" (
    "id" TEXT NOT NULL,
    "restrictionId" TEXT NOT NULL,
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

    CONSTRAINT "RestrictionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRestriction" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "restrictionId" TEXT NOT NULL,
    "impact" "RestrictionImpact" NOT NULL,
    "affectedMw" DECIMAL(12,3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restriction_slug_key" ON "Restriction"("slug");

-- CreateIndex
CREATE INDEX "Restriction_status_idx" ON "Restriction"("status");

-- CreateIndex
CREATE INDEX "Restriction_bindingLevel_idx" ON "Restriction"("bindingLevel");

-- CreateIndex
CREATE INDEX "Restriction_country_stateRegion_idx" ON "Restriction"("country", "stateRegion");

-- CreateIndex
CREATE INDEX "Restriction_gridRegion_idx" ON "Restriction"("gridRegion");

-- CreateIndex
CREATE INDEX "Restriction_expiryDate_idx" ON "Restriction"("expiryDate");

-- CreateIndex
CREATE INDEX "RestrictionSource_restrictionId_idx" ON "RestrictionSource"("restrictionId");

-- CreateIndex
CREATE INDEX "ProjectRestriction_restrictionId_idx" ON "ProjectRestriction"("restrictionId");

-- CreateIndex
CREATE INDEX "ProjectRestriction_projectId_idx" ON "ProjectRestriction"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRestriction_projectId_restrictionId_key" ON "ProjectRestriction"("projectId", "restrictionId");

-- AddForeignKey
ALTER TABLE "RestrictionSource" ADD CONSTRAINT "RestrictionSource_restrictionId_fkey" FOREIGN KEY ("restrictionId") REFERENCES "Restriction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRestriction" ADD CONSTRAINT "ProjectRestriction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRestriction" ADD CONSTRAINT "ProjectRestriction_restrictionId_fkey" FOREIGN KEY ("restrictionId") REFERENCES "Restriction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
