-- CreateTable
CREATE TABLE "company" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "about" TEXT NOT NULL DEFAULT '',
    "mission" TEXT NOT NULL DEFAULT '',
    "headquarters" TEXT NOT NULL DEFAULT '',
    "size" TEXT NOT NULL DEFAULT '',
    "fundingStage" TEXT NOT NULL DEFAULT '',
    "foundedYear" INTEGER,
    "website" TEXT NOT NULL DEFAULT '',
    "links" JSONB NOT NULL DEFAULT '{}',
    "culture" JSONB NOT NULL DEFAULT '[]',
    "benefits" JSONB NOT NULL DEFAULT '[]',
    "hubs" JSONB NOT NULL DEFAULT '[]',
    "awards" JSONB NOT NULL DEFAULT '[]',
    "domainId" TEXT,
    "workPolicy" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companyImage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "etag" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companyImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_ownerId_key" ON "company"("ownerId");

-- CreateIndex
CREATE INDEX "company_domainId_idx" ON "company"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "companyImage_companyId_kind_key" ON "companyImage"("companyId", "kind");

-- AddForeignKey
ALTER TABLE "company" ADD CONSTRAINT "company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companyImage" ADD CONSTRAINT "companyImage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one company per existing employer, so every current job links to a profile page.
INSERT INTO "company" ("id", "ownerId", "name", "updatedAt")
SELECT gen_random_uuid()::text, u."id", u."name", CURRENT_TIMESTAMP
FROM "user" u
WHERE u."role" = 'employer'
ON CONFLICT ("ownerId") DO NOTHING;
