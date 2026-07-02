-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "holyricsId" TEXT;

-- CreateTable
CREATE TABLE "HolyricsConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "token" TEXT NOT NULL DEFAULT '',
    "host" TEXT NOT NULL DEFAULT 'localhost:8091',

    CONSTRAINT "HolyricsConfig_pkey" PRIMARY KEY ("id")
);
