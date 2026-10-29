-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProjectVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- AlterTable
ALTER TABLE "post" ADD COLUMN     "project_id" TEXT;

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "skill_id" TEXT,
    "source_post_id" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "visibility" "ProjectVisibility" NOT NULL DEFAULT 'PRIVATE',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_material" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "note" VARCHAR(200),
    "checked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "project_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_entry" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" VARCHAR(80),
    "body" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_entry_media" (
    "entry_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "project_entry_media_pkey" PRIMARY KEY ("entry_id","media_id")
);

-- CreateIndex
CREATE INDEX "project_owner_id_updated_at_idx" ON "project"("owner_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "project_skill_id_idx" ON "project"("skill_id");

-- CreateIndex
CREATE INDEX "project_source_post_id_idx" ON "project"("source_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_material_project_id_position_key" ON "project_material"("project_id", "position");

-- CreateIndex
CREATE INDEX "project_entry_project_id_created_at_idx" ON "project_entry"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "project_entry_media_media_id_idx" ON "project_entry_media"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_entry_media_entry_id_position_key" ON "project_entry_media"("entry_id", "position");

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_source_post_id_fkey" FOREIGN KEY ("source_post_id") REFERENCES "post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_material" ADD CONSTRAINT "project_material_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_entry" ADD CONSTRAINT "project_entry_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_entry_media" ADD CONSTRAINT "project_entry_media_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "project_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_entry_media" ADD CONSTRAINT "project_entry_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
