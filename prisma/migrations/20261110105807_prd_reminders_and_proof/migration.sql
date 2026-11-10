-- CreateEnum
CREATE TYPE "ProofVerification" AS ENUM ('CLIENT_REPORTED', 'INDEPENDENTLY_VERIFIED');

-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "WorkshopRegistration" ADD COLUMN     "reminderSentAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" UUID NOT NULL,
    "client" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "quote" TEXT,
    "videoUrl" TEXT,
    "verifiedOutcome" TEXT,
    "verification" "ProofVerification" NOT NULL DEFAULT 'CLIENT_REPORTED',
    "permissionOnFile" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProofStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStudy" (
    "id" UUID NOT NULL,
    "client" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "startingPoint" TEXT NOT NULL,
    "intervention" TEXT NOT NULL,
    "outcomeMetric" TEXT NOT NULL,
    "outcomeBaseline" TEXT NOT NULL,
    "outcomeResult" TEXT NOT NULL,
    "outcomePeriod" TEXT NOT NULL,
    "outcomeSource" TEXT NOT NULL,
    "verification" "ProofVerification" NOT NULL DEFAULT 'CLIENT_REPORTED',
    "caveat" TEXT NOT NULL,
    "videoUrl" TEXT,
    "permissionOnFile" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProofStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CaseStudy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Testimonial_status_sortOrder_idx" ON "Testimonial"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "CaseStudy_status_sortOrder_idx" ON "CaseStudy"("status", "sortOrder");
