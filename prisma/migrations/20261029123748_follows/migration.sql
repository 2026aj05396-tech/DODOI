-- CreateTable
CREATE TABLE "follow" (
    "follower_id" TEXT NOT NULL,
    "followee_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_pkey" PRIMARY KEY ("follower_id","followee_id")
);

-- CreateIndex
CREATE INDEX "follow_followee_id_created_at_idx" ON "follow"("followee_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "follow_follower_id_created_at_idx" ON "follow"("follower_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "follow" ADD CONSTRAINT "follow_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow" ADD CONSTRAINT "follow_followee_id_fkey" FOREIGN KEY ("followee_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
