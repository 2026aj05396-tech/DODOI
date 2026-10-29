-- AlterTable
ALTER TABLE "post" ADD COLUMN     "own_work_confirmed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "normalized_name" TEXT NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_tag" (
    "post_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "post_tag_pkey" PRIMARY KEY ("post_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tag_normalized_name_key" ON "tag"("normalized_name");

-- CreateIndex
CREATE INDEX "post_tag_tag_id_idx" ON "post_tag"("tag_id");

-- AddForeignKey
ALTER TABLE "post_tag" ADD CONSTRAINT "post_tag_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tag" ADD CONSTRAINT "post_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
