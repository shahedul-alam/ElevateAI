-- CreateTable
CREATE TABLE "resumeEvaluation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "rubricVersion" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumeEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resumeEvaluation_userId_createdAt_idx" ON "resumeEvaluation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "resumeEvaluation_userId_contentHash_rubricVersion_key" ON "resumeEvaluation"("userId", "contentHash", "rubricVersion");

-- AddForeignKey
ALTER TABLE "resumeEvaluation" ADD CONSTRAINT "resumeEvaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
