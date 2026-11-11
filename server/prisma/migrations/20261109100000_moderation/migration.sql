-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'moderation';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;

-- AlterTable
ALTER TABLE "job" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;
