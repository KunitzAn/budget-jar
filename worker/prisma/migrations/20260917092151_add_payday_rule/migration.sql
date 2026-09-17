-- CreateTable
CREATE TABLE "PaydayRule" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "dayOfMonth" INTEGER,
    "weekday" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaydayRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaydayRule_userId_effectiveFrom_idx" ON "PaydayRule"("userId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "PaydayRule" ADD CONSTRAINT "PaydayRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
