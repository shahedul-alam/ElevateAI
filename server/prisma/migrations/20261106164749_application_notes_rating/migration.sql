-- AlterTable
ALTER TABLE "application" ADD COLUMN     "rating" INTEGER;

-- CreateTable
CREATE TABLE "applicationNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicationNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applicationNote_applicationId_createdAt_idx" ON "applicationNote"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "applicationNote" ADD CONSTRAINT "applicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "application" ADD CONSTRAINT "application_rating_range" CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 5));
