-- CreateTable
CREATE TABLE "block" (
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

-- CreateIndex
CREATE INDEX "block_blocked_id_idx" ON "block"("blocked_id");

-- AddForeignKey
ALTER TABLE "block" ADD CONSTRAINT "block_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block" ADD CONSTRAINT "block_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
