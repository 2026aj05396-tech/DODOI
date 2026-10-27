-- AlterTable
ALTER TABLE "feed_impression" ADD COLUMN     "page" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "feed_impression_session_id_page_idx" ON "feed_impression"("session_id", "page");
