-- CreateTable
CREATE TABLE "Exchange" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "fromAmount" DECIMAL(14,2) NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "toAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exchange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exchange_userId_date_idx" ON "Exchange"("userId", "date");

-- AddForeignKey
ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: суммы в донгах не помещаются в DECIMAL(10,2)
ALTER TABLE "Expense" ALTER COLUMN "amount" TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB';
