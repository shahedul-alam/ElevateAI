-- AlterTable
ALTER TABLE "application" ADD COLUMN     "photoId" TEXT;

-- AlterTable
ALTER TABLE "candidateProfile" ADD COLUMN     "photoId" TEXT;

-- CreateTable
CREATE TABLE "photoBlob" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photoBlob_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "candidateProfile" ADD CONSTRAINT "candidateProfile_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photoBlob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photoBlob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
