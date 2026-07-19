CREATE TABLE "AccountResetBatch" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "userCount" INTEGER NOT NULL,
    "committedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountResetBatch_pkey" PRIMARY KEY ("id")
);