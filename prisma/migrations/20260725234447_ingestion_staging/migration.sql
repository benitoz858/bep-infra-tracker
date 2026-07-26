-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "watcher" TEXT NOT NULL,
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "itemsSeen" INTEGER NOT NULL DEFAULT 0,
    "itemsNew" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionCandidate" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "publicationDate" TIMESTAMP(3),
    "sourceType" "SourceType" NOT NULL DEFAULT 'NEWS_ARTICLE',
    "excerpt" TEXT,
    "suggestedProjectId" TEXT,
    "matchScore" INTEGER,
    "matchReason" TEXT,
    "proposedClaims" JSONB,
    "extractor" TEXT NOT NULL DEFAULT 'none',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestionRun_watcher_startedAt_idx" ON "IngestionRun"("watcher", "startedAt");

-- CreateIndex
CREATE INDEX "IngestionRun_status_idx" ON "IngestionRun"("status");

-- CreateIndex
CREATE INDEX "IngestionCandidate_status_createdAt_idx" ON "IngestionCandidate"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionCandidate_suggestedProjectId_idx" ON "IngestionCandidate"("suggestedProjectId");

-- CreateIndex
CREATE INDEX "IngestionCandidate_runId_idx" ON "IngestionCandidate"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionCandidate_url_key" ON "IngestionCandidate"("url");

-- AddForeignKey
ALTER TABLE "IngestionCandidate" ADD CONSTRAINT "IngestionCandidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IngestionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionCandidate" ADD CONSTRAINT "IngestionCandidate_suggestedProjectId_fkey" FOREIGN KEY ("suggestedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionCandidate" ADD CONSTRAINT "IngestionCandidate_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
