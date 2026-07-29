-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isLegalVehicle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentCompanyId" TEXT;

-- CreateIndex
CREATE INDEX "Company_parentCompanyId_idx" ON "Company"("parentCompanyId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_parentCompanyId_fkey" FOREIGN KEY ("parentCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
