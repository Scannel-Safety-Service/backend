-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_userId_fkey";

-- DropIndex
DROP INDEX "Category_userId_idx";

-- CreateTable
CREATE TABLE "CategoryUser" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryUser_categoryId_idx" ON "CategoryUser"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryUser_userId_idx" ON "CategoryUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryUser_categoryId_userId_key" ON "CategoryUser"("categoryId", "userId");

-- Migrate existing data from Category.userId to CategoryUser table
-- Uses gen_random_uuid() to generate unique text IDs for the junction table
INSERT INTO "CategoryUser" ("id", "categoryId", "userId")
SELECT gen_random_uuid()::text, "id", "userId"
FROM "Category"
WHERE "userId" IS NOT NULL;

-- AlterTable to add new columns (leaving createdById nullable first)
ALTER TABLE "Category"
ADD COLUMN     "assignToAll" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdById" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL;

-- Populate createdById with existing userId or a fallback user from the same company or the system
UPDATE "Category" c
SET "createdById" = COALESCE(
  c."userId",
  (SELECT u."id" FROM "User" u WHERE u."companyId" = c."companyId" LIMIT 1),
  (SELECT u."id" FROM "User" u LIMIT 1)
);

-- Make createdById NOT NULL
ALTER TABLE "Category" ALTER COLUMN "createdById" SET NOT NULL;

-- Drop column userId
ALTER TABLE "Category" DROP COLUMN "userId";

-- CreateIndex
CREATE INDEX "Category_createdById_idx" ON "Category"("createdById");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryUser" ADD CONSTRAINT "CategoryUser_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryUser" ADD CONSTRAINT "CategoryUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
