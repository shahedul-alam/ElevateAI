-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('draft', 'active', 'closed');

-- CreateTable
CREATE TABLE "job" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'draft',
    "currentVersionId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobVersion" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_currentVersionId_key" ON "job"("currentVersionId");

-- CreateIndex
CREATE INDEX "job_employerId_createdAt_idx" ON "job"("employerId", "createdAt");

-- CreateIndex
CREATE INDEX "job_status_publishedAt_idx" ON "job"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "jobVersion_jobId_contentHash_key" ON "jobVersion"("jobId", "contentHash");

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "jobVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobVersion" ADD CONSTRAINT "jobVersion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
