-- CreateEnum
CREATE TYPE "AIContextType" AS ENUM ('NONE', 'POST', 'SKILL');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AIMessageStatus" AS ENUM ('OK', 'BLOCKED', 'ERROR');

-- CreateEnum
CREATE TYPE "AIUsageStatus" AS ENUM ('OK', 'BLOCKED', 'ERROR', 'QUOTA');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('AI_IMAGES', 'AI_PROFILE_CONTEXT');

-- CreateTable
CREATE TABLE "ai_conversation" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "context_type" "AIContextType" NOT NULL DEFAULT 'NONE',
    "context_id" TEXT,
    "title" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_message" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" VARCHAR(8000) NOT NULL,
    "image_media_id" TEXT,
    "prompt_version" TEXT,
    "status" "AIMessageStatus" NOT NULL DEFAULT 'OK',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_micros" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL,
    "status" "AIUsageStatus" NOT NULL,
    "has_image" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedback" (
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "comment" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "consent" (
    "user_id" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "policy_version" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "consent_pkey" PRIMARY KEY ("user_id","type")
);

-- CreateIndex
CREATE INDEX "ai_conversation_user_id_updated_at_idx" ON "ai_conversation"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "ai_conversation_updated_at_idx" ON "ai_conversation"("updated_at");

-- CreateIndex
CREATE INDEX "ai_message_conversation_id_created_at_idx" ON "ai_message"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_message_image_media_id_idx" ON "ai_message"("image_media_id");

-- CreateIndex
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage"("created_at");

-- CreateIndex
CREATE INDEX "ai_usage_user_id_created_at_idx" ON "ai_usage"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_feedback_user_id_idx" ON "ai_feedback"("user_id");

-- AddForeignKey
ALTER TABLE "ai_conversation" ADD CONSTRAINT "ai_conversation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ai_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent" ADD CONSTRAINT "consent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
