-- Trigram matching for partial and typo-tolerant search (SYSTEM_ARCHITECTURE §10).
-- Hand-added: Prisma does not manage PostgreSQL extensions in this setup.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('CURIOUS', 'BEGINNER', 'INTERMEDIATE', 'EXPERIENCED');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CollectionVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "SkillOrigin" AS ENUM ('PREDEFINED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('ACTIVE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "SkillAccent" AS ENUM ('BUTTER', 'BLUSH', 'LAVENDER', 'MINT', 'SKY', 'CORAL');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('FIRST_ATTEMPT', 'TUTORIAL', 'WORK_IN_PROGRESS', 'JOURNAL', 'FINISHED', 'TIP');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('TEAM_ORIGINAL', 'INVITED_CREATOR', 'STOCK_LICENSED', 'CREATIVE_COMMONS', 'USER_UPLOAD');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('SKILL', 'PROFILE');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('OFFENSIVE', 'SPAM', 'IMPERSONATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "password_hash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "onboarding_completed_at" TIMESTAMP(3),
    "age_confirmed_at" TIMESTAMP(3),
    "deletion_requested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile" (
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "username_changed_at" TIMESTAMP(3),
    "display_name" VARCHAR(50) NOT NULL,
    "bio" VARCHAR(300),
    "avatar_media_id" TEXT,
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "hint" VARCHAR(40),
    "pitch" VARCHAR(140),
    "origin" "SkillOrigin" NOT NULL DEFAULT 'PREDEFINED',
    "status" "SkillStatus" NOT NULL DEFAULT 'ACTIVE',
    "accent" "SkillAccent" NOT NULL,
    "cover_media_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_relation" (
    "from_skill_id" TEXT NOT NULL,
    "to_skill_id" TEXT NOT NULL,

    CONSTRAINT "skill_relation_pkey" PRIMARY KEY ("from_skill_id","to_skill_id")
);

-- CreateTable
CREATE TABLE "user_skill" (
    "user_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "is_interest" BOOLEAN NOT NULL DEFAULT false,
    "can_help" BOOLEAN NOT NULL DEFAULT false,
    "wants_to_learn" BOOLEAN NOT NULL DEFAULT false,
    "level" "ExperienceLevel",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_skill_pkey" PRIMARY KEY ("user_id","skill_id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" TEXT NOT NULL,
    "author_id" TEXT,
    "seed_key" TEXT,
    "type" "PostType" NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "difficulty" "ExperienceLevel",
    "estimated_minutes" INTEGER,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_skill" (
    "post_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "post_skill_pkey" PRIMARY KEY ("post_id","skill_id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT,
    "type" "MediaType" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'cloudinary',
    "public_id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "duration_sec" DOUBLE PRECISION,
    "alt_text" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "post_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("post_id","media_id")
);

-- CreateTable
CREATE TABLE "post_step" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "media_id" TEXT,

    CONSTRAINT "post_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_material" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "note" VARCHAR(200),

    CONSTRAINT "post_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_attribution" (
    "post_id" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "license" TEXT NOT NULL,
    "attribution_text" TEXT NOT NULL,
    "original_author" TEXT,
    "original_url" TEXT,
    "permission_ref" TEXT,

    CONSTRAINT "post_attribution_pkey" PRIMARY KEY ("post_id")
);

-- CreateTable
CREATE TABLE "theme" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cover_media_id" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theme_post" (
    "theme_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "theme_post_pkey" PRIMARY KEY ("theme_id","post_id")
);

-- CreateTable
CREATE TABLE "save" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "save_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "name_normalized" VARCHAR(80) NOT NULL,
    "visibility" "CollectionVisibility" NOT NULL DEFAULT 'PRIVATE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_item" (
    "collection_id" TEXT NOT NULL,
    "save_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_item_pkey" PRIMARY KEY ("collection_id","save_id")
);

-- CreateTable
CREATE TABLE "feed_session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filter" TEXT NOT NULL DEFAULT 'for-you',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_impression" (
    "session_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "served_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_impression_pkey" PRIMARY KEY ("session_id","post_id")
);

-- CreateTable
CREATE TABLE "feed_feedback" (
    "user_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_feedback_pkey" PRIMARY KEY ("user_id","post_id","type")
);

-- CreateTable
CREATE TABLE "post_progress" (
    "user_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "checked_material_ids" TEXT[],
    "completed_step_positions" INTEGER[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_progress_pkey" PRIMARY KEY ("user_id","post_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "note" VARCHAR(500),
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_bucket" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limit_bucket_pkey" PRIMARY KEY ("key","window_start")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_provider_provider_account_id_key" ON "account"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_token_token_hash_key" ON "auth_token"("token_hash");

-- CreateIndex
CREATE INDEX "auth_token_user_id_type_idx" ON "auth_token"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "profile_username_key" ON "profile"("username");

-- CreateIndex
CREATE UNIQUE INDEX "profile_avatar_media_id_key" ON "profile"("avatar_media_id");

-- CreateIndex
CREATE INDEX "profile_username_trgm_idx" ON "profile" USING GIN ("username" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "profile_display_name_trgm_idx" ON "profile" USING GIN ("display_name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "skill_normalized_name_key" ON "skill"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "skill_slug_key" ON "skill"("slug");

-- CreateIndex
CREATE INDEX "skill_origin_status_idx" ON "skill"("origin", "status");

-- CreateIndex
CREATE INDEX "skill_name_trgm_idx" ON "skill" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "skill_relation_to_skill_id_idx" ON "skill_relation"("to_skill_id");

-- CreateIndex
CREATE INDEX "user_skill_skill_id_idx" ON "user_skill"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_seed_key_key" ON "post"("seed_key");

-- CreateIndex
CREATE INDEX "post_status_published_at_idx" ON "post"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "post_author_id_idx" ON "post"("author_id");

-- CreateIndex
CREATE INDEX "post_search_vector_idx" ON "post" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "post_title_trgm_idx" ON "post" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "post_skill_skill_id_idx" ON "post_skill"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_public_id_key" ON "media_asset"("public_id");

-- CreateIndex
CREATE INDEX "media_asset_owner_id_idx" ON "media_asset"("owner_id");

-- CreateIndex
CREATE INDEX "post_media_media_id_idx" ON "post_media"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_media_post_id_position_key" ON "post_media"("post_id", "position");

-- CreateIndex
CREATE INDEX "post_step_media_id_idx" ON "post_step"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_step_post_id_position_key" ON "post_step"("post_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "post_material_post_id_position_key" ON "post_material"("post_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "theme_slug_key" ON "theme"("slug");

-- CreateIndex
CREATE INDEX "theme_post_post_id_idx" ON "theme_post"("post_id");

-- CreateIndex
CREATE INDEX "save_user_id_created_at_idx" ON "save"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "save_post_id_idx" ON "save"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "save_user_id_post_id_key" ON "save"("user_id", "post_id");

-- CreateIndex
CREATE INDEX "collection_user_id_idx" ON "collection"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_user_id_name_normalized_key" ON "collection"("user_id", "name_normalized");

-- CreateIndex
CREATE INDEX "collection_item_save_id_idx" ON "collection_item"("save_id");

-- CreateIndex
CREATE INDEX "feed_session_user_id_created_at_idx" ON "feed_session"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "feed_session_expires_at_idx" ON "feed_session"("expires_at");

-- CreateIndex
CREATE INDEX "feed_impression_post_id_idx" ON "feed_impression"("post_id");

-- CreateIndex
CREATE INDEX "feed_feedback_user_id_created_at_idx" ON "feed_feedback"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "feed_feedback_post_id_idx" ON "feed_feedback"("post_id");

-- CreateIndex
CREATE INDEX "post_progress_post_id_idx" ON "post_progress"("post_id");

-- CreateIndex
CREATE INDEX "audit_log_target_type_target_id_idx" ON "audit_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "report_status_created_at_idx" ON "report"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "report_target_type_target_id_idx" ON "report"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "report_reporter_id_idx" ON "report"("reporter_id");

-- CreateIndex
CREATE INDEX "report_resolved_by_id_idx" ON "report"("resolved_by_id");

-- CreateIndex
CREATE INDEX "rate_limit_bucket_window_start_idx" ON "rate_limit_bucket"("window_start");

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_token" ADD CONSTRAINT "auth_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile" ADD CONSTRAINT "profile_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill" ADD CONSTRAINT "skill_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill" ADD CONSTRAINT "skill_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_relation" ADD CONSTRAINT "skill_relation_from_skill_id_fkey" FOREIGN KEY ("from_skill_id") REFERENCES "skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_relation" ADD CONSTRAINT "skill_relation_to_skill_id_fkey" FOREIGN KEY ("to_skill_id") REFERENCES "skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skill" ADD CONSTRAINT "user_skill_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skill" ADD CONSTRAINT "user_skill_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_skill" ADD CONSTRAINT "post_skill_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_skill" ADD CONSTRAINT "post_skill_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_step" ADD CONSTRAINT "post_step_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_step" ADD CONSTRAINT "post_step_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_material" ADD CONSTRAINT "post_material_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_attribution" ADD CONSTRAINT "post_attribution_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme" ADD CONSTRAINT "theme_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_post" ADD CONSTRAINT "theme_post_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_post" ADD CONSTRAINT "theme_post_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "save" ADD CONSTRAINT "save_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "save" ADD CONSTRAINT "save_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_save_id_fkey" FOREIGN KEY ("save_id") REFERENCES "save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_session" ADD CONSTRAINT "feed_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_impression" ADD CONSTRAINT "feed_impression_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "feed_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_impression" ADD CONSTRAINT "feed_impression_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_feedback" ADD CONSTRAINT "feed_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_feedback" ADD CONSTRAINT "feed_feedback_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_progress" ADD CONSTRAINT "post_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_progress" ADD CONSTRAINT "post_progress_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
