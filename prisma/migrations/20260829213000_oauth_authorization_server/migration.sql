-- CreateTable
CREATE TABLE "OAuthAuthCode" (
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAuthCode_pkey" PRIMARY KEY ("codeHash")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "clientId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OAuthAuthCode_expiresAt_idx" ON "OAuthAuthCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_accessTokenHash_key" ON "OAuthToken"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_refreshTokenHash_key" ON "OAuthToken"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "OAuthToken_expiresAt_idx" ON "OAuthToken"("expiresAt");

