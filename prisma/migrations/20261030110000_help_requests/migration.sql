-- CreateEnum
CREATE TYPE "HelpStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'HELP_RESPONSE';
ALTER TYPE "NotificationType" ADD VALUE 'HELP_HELPFUL';
ALTER TYPE "NotificationType" ADD VALUE 'HELP_RESOLVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportTargetType" ADD VALUE 'HELP_REQUEST';
ALTER TYPE "ReportTargetType" ADD VALUE 'HELP_RESPONSE';

-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "help_request_id" TEXT,
ADD COLUMN     "subject" VARCHAR(100);

-- CreateTable
CREATE TABLE "help_request" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "status" "HelpStatus" NOT NULL DEFAULT 'OPEN',
    "hidden_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_request_media" (
    "request_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "help_request_media_pkey" PRIMARY KEY ("request_id","position")
);

-- CreateTable
CREATE TABLE "help_response" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "is_helpful" BOOLEAN NOT NULL DEFAULT false,
    "hidden_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_response_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "help_request_status_skill_id_updated_at_idx" ON "help_request"("status", "skill_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "help_request_author_id_created_at_idx" ON "help_request"("author_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "help_request_skill_id_idx" ON "help_request"("skill_id");

-- CreateIndex
CREATE INDEX "help_request_media_media_id_idx" ON "help_request_media"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "help_request_media_request_id_media_id_key" ON "help_request_media"("request_id", "media_id");

-- CreateIndex
CREATE INDEX "help_response_request_id_created_at_idx" ON "help_response"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "help_response_author_id_idx" ON "help_response"("author_id");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_help_request_id_fkey" FOREIGN KEY ("help_request_id") REFERENCES "help_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_request" ADD CONSTRAINT "help_request_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_request" ADD CONSTRAINT "help_request_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_request_media" ADD CONSTRAINT "help_request_media_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "help_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_request_media" ADD CONSTRAINT "help_request_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_response" ADD CONSTRAINT "help_response_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "help_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_response" ADD CONSTRAINT "help_response_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
