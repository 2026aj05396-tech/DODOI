-- DropIndex
DROP INDEX "creative_session_state_starts_at_idx";

-- AlterTable: the end time is the start plus the length, so existing rows (none yet in practice)
-- are filled in before the column becomes required.
ALTER TABLE "creative_session" ADD COLUMN     "ends_at" TIMESTAMP(3);
UPDATE "creative_session" SET "ends_at" = "starts_at" + ("duration_min" * INTERVAL '1 minute');
ALTER TABLE "creative_session" ALTER COLUMN "ends_at" SET NOT NULL;

-- CreateIndex
CREATE INDEX "creative_session_state_ends_at_idx" ON "creative_session"("state", "ends_at");
