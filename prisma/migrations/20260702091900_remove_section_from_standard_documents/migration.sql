-- Remove section column from StandardDocument table
-- section is no longer relevant to standard documents
ALTER TABLE "StandardDocument" DROP COLUMN IF EXISTS "section";
