-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "admin_password_challenges" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_password_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_password_challenges_token_hash_key" ON "admin_password_challenges"("token_hash");

-- CreateIndex
CREATE INDEX "admin_password_challenges_admin_id_created_at_idx" ON "admin_password_challenges"("admin_id", "created_at");

-- AddForeignKey
ALTER TABLE "admin_password_challenges" ADD CONSTRAINT "admin_password_challenges_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Les comptes existants ont été créés avec un mot de passe publié dans l'historique Git : il doit être remplacé,
-- après confirmation par un code envoyé à l'adresse de l'admin.
UPDATE "admins" SET "must_change_password" = true;
