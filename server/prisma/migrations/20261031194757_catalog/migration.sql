-- CreateEnum
CREATE TYPE "CatalogKind" AS ENUM ('skill', 'certification', 'domain');

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('approved', 'pending');

-- CreateTable
CREATE TABLE "catalogTerm" (
    "id" TEXT NOT NULL,
    "kind" "CatalogKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'approved',

    CONSTRAINT "catalogTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogAlias" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "kind" "CatalogKind" NOT NULL,
    "alias" TEXT NOT NULL,

    CONSTRAINT "catalogAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalogTerm_kind_slug_key" ON "catalogTerm"("kind", "slug");

-- CreateIndex
CREATE INDEX "catalogAlias_termId_idx" ON "catalogAlias"("termId");

-- CreateIndex
CREATE UNIQUE INDEX "catalogAlias_kind_alias_key" ON "catalogAlias"("kind", "alias");

-- AddForeignKey
ALTER TABLE "catalogAlias" ADD CONSTRAINT "catalogAlias_termId_fkey" FOREIGN KEY ("termId") REFERENCES "catalogTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
