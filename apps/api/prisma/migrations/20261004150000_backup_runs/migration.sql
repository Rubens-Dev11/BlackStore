-- CreateEnum
CREATE TYPE "BackupKind" AS ENUM ('database', 'files', 'retention');

-- CreateEnum
CREATE TYPE "BackupRunStatus" AS ENUM ('running', 'success', 'failed');

-- CreateTable
CREATE TABLE "backup_runs" (
    "id" TEXT NOT NULL,
    "kind" "BackupKind" NOT NULL,
    "status" "BackupRunStatus" NOT NULL DEFAULT 'running',
    "trigger" VARCHAR(20) NOT NULL,
    "file_name" VARCHAR(200),
    "size_bytes" BIGINT,
    "sha256" VARCHAR(64),
    "offsite" VARCHAR(30),
    "details" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_runs_kind_started_at_idx" ON "backup_runs"("kind", "started_at");
