-- CreateTable
CREATE TABLE "candidateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profileVersion" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidateProfile_userId_key" ON "candidateProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "candidateProfile_currentVersionId_key" ON "candidateProfile"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "profileVersion_profileId_contentHash_key" ON "profileVersion"("profileId", "contentHash");

-- AddForeignKey
ALTER TABLE "candidateProfile" ADD CONSTRAINT "candidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidateProfile" ADD CONSTRAINT "candidateProfile_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "profileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profileVersion" ADD CONSTRAINT "profileVersion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
