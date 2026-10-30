-- CreateEnum
CREATE TYPE "MessagePolicy" AS ENUM ('EVERYONE', 'FOLLOWING', 'NOBODY');

-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'MESSAGE';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "message_policy" "MessagePolicy" NOT NULL DEFAULT 'EVERYONE';

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "user_a_id" TEXT NOT NULL,
    "user_b_id" TEXT NOT NULL,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hidden_for_a" BOOLEAN NOT NULL DEFAULT false,
    "hidden_for_b" BOOLEAN NOT NULL DEFAULT false,
    "last_read_at_a" TIMESTAMP(3),
    "last_read_at_b" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_user_a_id_last_message_at_idx" ON "conversation"("user_a_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "conversation_user_b_id_last_message_at_idx" ON "conversation"("user_b_id", "last_message_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_user_a_id_user_b_id_key" ON "conversation"("user_a_id", "user_b_id");

-- CreateIndex
CREATE INDEX "message_conversation_id_created_at_idx" ON "message"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "message_sender_id_idx" ON "message"("sender_id");

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
