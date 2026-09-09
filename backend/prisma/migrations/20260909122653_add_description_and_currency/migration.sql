-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'LBP');

-- AlterTable
ALTER TABLE "Financial" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "description" TEXT;
