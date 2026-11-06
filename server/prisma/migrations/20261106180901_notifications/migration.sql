-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('application_status', 'application_received');

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "applicationId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
