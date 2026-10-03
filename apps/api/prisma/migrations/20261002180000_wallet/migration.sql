-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('sale', 'refund', 'withdrawal', 'withdrawal_reversal');

-- CreateEnum
CREATE TYPE "MobileMoneyOperator" AS ENUM ('orange', 'mtn');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('pending', 'paid', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "marketplace_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "hold_days" INTEGER NOT NULL DEFAULT 7,
    "min_withdrawal" INTEGER NOT NULL DEFAULT 5000,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_entries" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "gross_amount" INTEGER,
    "commission" INTEGER,
    "commission_rate" DECIMAL(5,2),
    "available_at" TIMESTAMP(3) NOT NULL,
    "order_item_id" TEXT,
    "withdrawal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "operator" "MobileMoneyOperator" NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "account_name" VARCHAR(160) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'pending',
    "transfer_reference" VARCHAR(100),
    "admin_note" VARCHAR(500),
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_entries_seller_id_created_at_idx" ON "wallet_entries"("seller_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_entries_order_item_id_type_key" ON "wallet_entries"("order_item_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_entries_withdrawal_id_type_key" ON "wallet_entries"("withdrawal_id", "type");

-- CreateIndex
CREATE INDEX "withdrawals_seller_id_idx" ON "withdrawals"("seller_id");

-- CreateIndex
CREATE INDEX "withdrawals_status_idx" ON "withdrawals"("status");

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "withdrawals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

