-- CreateEnum
CREATE TYPE "IngestionOrigin" AS ENUM ('WATCHER', 'PUBLIC_SUBMISSION');

-- AlterTable
ALTER TABLE "IngestionCandidate" ADD COLUMN     "origin" "IngestionOrigin" NOT NULL DEFAULT 'WATCHER',
ADD COLUMN     "submitterEmail" TEXT,
ADD COLUMN     "submitterIpHash" TEXT,
ADD COLUMN     "submitterName" TEXT,
ADD COLUMN     "submitterNote" TEXT,
ADD COLUMN     "submitterUserId" TEXT;

-- CreateIndex
CREATE INDEX "IngestionCandidate_origin_status_createdAt_idx" ON "IngestionCandidate"("origin", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "IngestionCandidate" ADD CONSTRAINT "IngestionCandidate_submitterUserId_fkey" FOREIGN KEY ("submitterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
