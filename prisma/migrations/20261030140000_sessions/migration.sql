-- CreateEnum
CREATE TYPE "SessionState" AS ENUM ('PROPOSED', 'ACCEPTED', 'DECLINED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SESSION_PROPOSED';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_DECLINED';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_RESCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_REMINDER';

-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "session_id" TEXT;

-- CreateTable
CREATE TABLE "creative_session" (
    "id" TEXT NOT NULL,
    "proposer_id" TEXT NOT NULL,
    "invitee_id" TEXT NOT NULL,
    "help_request_id" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "duration_min" SMALLINT NOT NULL,
    "note" VARCHAR(300),
    "meeting_url" VARCHAR(500),
    "state" "SessionState" NOT NULL DEFAULT 'PROPOSED',
    "replaces_id" TEXT,
    "reminded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_session_invitee_id_state_starts_at_idx" ON "creative_session"("invitee_id", "state", "starts_at");

-- CreateIndex
CREATE INDEX "creative_session_proposer_id_state_starts_at_idx" ON "creative_session"("proposer_id", "state", "starts_at");

-- CreateIndex
CREATE INDEX "creative_session_state_starts_at_idx" ON "creative_session"("state", "starts_at");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "creative_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_session" ADD CONSTRAINT "creative_session_proposer_id_fkey" FOREIGN KEY ("proposer_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_session" ADD CONSTRAINT "creative_session_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_session" ADD CONSTRAINT "creative_session_help_request_id_fkey" FOREIGN KEY ("help_request_id") REFERENCES "help_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_session" ADD CONSTRAINT "creative_session_replaces_id_fkey" FOREIGN KEY ("replaces_id") REFERENCES "creative_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
