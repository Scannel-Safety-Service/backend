-- Migration: make_usercode_globally_unique
-- Drop the old composite unique constraint (companyId, userCode)
-- and add a global unique constraint on userCode alone.

-- Drop per-company composite unique index
DROP INDEX IF EXISTS "User_companyId_userCode_key";

-- Add global unique constraint on userCode
ALTER TABLE "User" ADD CONSTRAINT "User_userCode_key" UNIQUE ("userCode");
