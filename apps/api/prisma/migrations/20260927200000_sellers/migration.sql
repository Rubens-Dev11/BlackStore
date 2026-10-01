-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('pending', 'approved', 'suspended');

-- CreateEnum
CREATE TYPE "SellerTokenType" AS ENUM ('email_verification', 'password_reset');

-- CreateTable
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "status" "SellerStatus" NOT NULL DEFAULT 'pending',
    "email_verified_at" TIMESTAMP(3),
    "status_changed_at" TIMESTAMP(3),
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_tokens" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "type" "SellerTokenType" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sellers_email_key" ON "sellers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "seller_tokens_token_hash_key" ON "seller_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "seller_tokens_seller_id_type_idx" ON "seller_tokens"("seller_id", "type");

-- AddForeignKey
ALTER TABLE "seller_tokens" ADD CONSTRAINT "seller_tokens_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

