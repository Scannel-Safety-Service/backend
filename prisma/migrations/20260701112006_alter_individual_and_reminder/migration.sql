/*
  Warnings:

  - You are about to drop the column `firstName` on the `Individual` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `Individual` table. All the data in the column will be lost.
  - Added the required column `name` to the `Individual` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Individual" DROP COLUMN "firstName",
DROP COLUMN "lastName",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "reminderDate" TIMESTAMP(3);
