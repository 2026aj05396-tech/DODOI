-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportTargetType" ADD VALUE 'COMMUNITY';
ALTER TYPE "ReportTargetType" ADD VALUE 'COMMUNITY_POST';

-- CreateTable
CREATE TABLE "community" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "normalized_name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "skill_id" TEXT NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "rules" TEXT[],
    "created_by_id" TEXT,
    "hidden_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_member" (
    "community_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "CommunityRole" NOT NULL DEFAULT 'MEMBER',
    "removed_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_member_pkey" PRIMARY KEY ("community_id","user_id")
);

-- CreateTable
CREATE TABLE "community_post" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "author_id" TEXT,
    "parent_id" TEXT,
    "body" VARCHAR(2000) NOT NULL,
    "hidden_at" TIMESTAMP(3),
    "edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_post_media" (
    "post_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "community_post_media_pkey" PRIMARY KEY ("post_id","position")
);

-- CreateTable
CREATE TABLE "community_moderation_log" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" VARCHAR(40) NOT NULL,
    "target_type" VARCHAR(20) NOT NULL,
    "target_id" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_moderation_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_normalized_name_key" ON "community"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "community_slug_key" ON "community"("slug");

-- CreateIndex
CREATE INDEX "community_skill_id_created_at_idx" ON "community"("skill_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "community_created_by_id_idx" ON "community"("created_by_id");

-- CreateIndex
CREATE INDEX "community_member_user_id_idx" ON "community_member"("user_id");

-- CreateIndex
CREATE INDEX "community_post_community_id_activity_at_idx" ON "community_post"("community_id", "activity_at" DESC);

-- CreateIndex
CREATE INDEX "community_post_parent_id_idx" ON "community_post"("parent_id");

-- CreateIndex
CREATE INDEX "community_post_author_id_idx" ON "community_post"("author_id");

-- CreateIndex
CREATE INDEX "community_post_media_media_id_idx" ON "community_post_media"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "community_post_media_post_id_media_id_key" ON "community_post_media"("post_id", "media_id");

-- CreateIndex
CREATE INDEX "community_moderation_log_community_id_created_at_idx" ON "community_moderation_log"("community_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "community" ADD CONSTRAINT "community_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community" ADD CONSTRAINT "community_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_member" ADD CONSTRAINT "community_member_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_member" ADD CONSTRAINT "community_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post" ADD CONSTRAINT "community_post_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post" ADD CONSTRAINT "community_post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post" ADD CONSTRAINT "community_post_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "community_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_media" ADD CONSTRAINT "community_post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_media" ADD CONSTRAINT "community_post_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_moderation_log" ADD CONSTRAINT "community_moderation_log_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_moderation_log" ADD CONSTRAINT "community_moderation_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
