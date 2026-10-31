-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('applied', 'under_review', 'rejected', 'hired');

-- CreateTable
CREATE TABLE "application" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "profileVersionId" TEXT NOT NULL,
    "jobVersionId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'applied',
    "matchScore" INTEGER NOT NULL,
    "matchBreakdown" JSONB NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicationStatusHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_jobId_matchScore_idx" ON "application"("jobId", "matchScore" DESC);

-- CreateIndex
CREATE INDEX "application_candidateId_createdAt_idx" ON "application"("candidateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "application_jobId_candidateId_key" ON "application"("jobId", "candidateId");

-- CreateIndex
CREATE INDEX "applicationStatusHistory_applicationId_createdAt_idx" ON "applicationStatusHistory"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_profileVersionId_fkey" FOREIGN KEY ("profileVersionId") REFERENCES "profileVersion"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_jobVersionId_fkey" FOREIGN KEY ("jobVersionId") REFERENCES "jobVersion"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationStatusHistory" ADD CONSTRAINT "applicationStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
