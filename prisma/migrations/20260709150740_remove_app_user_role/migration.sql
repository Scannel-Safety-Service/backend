-- Remove APP_USER from the Role enum
-- Step 1: Create a new enum type without APP_USER
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_USER');

-- Step 2: Alter the User table column to use the new enum (casting existing values)
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");

-- Step 3: Drop the old enum
DROP TYPE "Role";

-- Step 4: Rename the new enum to the original name
ALTER TYPE "Role_new" RENAME TO "Role";
