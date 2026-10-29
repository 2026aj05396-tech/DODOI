-- AlterEnum
ALTER TYPE "ReportReason" ADD VALUE 'NOT_MY_WORK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportTargetType" ADD VALUE 'POST';
ALTER TYPE "ReportTargetType" ADD VALUE 'COMMENT';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MODERATOR';

-- AlterTable
ALTER TABLE "post" ADD COLUMN     "hidden_at" TIMESTAMP(3);
