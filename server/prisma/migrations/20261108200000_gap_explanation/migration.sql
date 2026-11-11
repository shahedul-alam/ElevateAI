-- CreateTable
CREATE TABLE "gapExplanation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileVersionId" TEXT NOT NULL,
    "jobVersionId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gapExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gapExplanation_userId_createdAt_idx" ON "gapExplanation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "gapExplanation_key" ON "gapExplanation"("userId", "profileVersionId", "jobVersionId", "engineVersion", "promptVersion");

-- AddForeignKey
ALTER TABLE "gapExplanation" ADD CONSTRAINT "gapExplanation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
