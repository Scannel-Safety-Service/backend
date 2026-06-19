-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isReviewed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "title" TEXT;
