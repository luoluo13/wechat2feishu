/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Article` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "password" TEXT,
    "phoneNumber" TEXT,
    "wechatUnionId" TEXT,
    "wechatOpenId" TEXT,
    "feishuUserId" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiry" DATETIME,
    "emailVerified" DATETIME,
    "lastLoginAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "articleQuota" INTEGER NOT NULL DEFAULT 20
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "encryptedAccessToken", "encryptedRefreshToken", "feishuUserId", "id", "lastLoginAt", "name", "tokenExpiry", "updatedAt") SELECT "avatarUrl", "createdAt", "encryptedAccessToken", "encryptedRefreshToken", "feishuUserId", "id", "lastLoginAt", "name", "tokenExpiry", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
CREATE UNIQUE INDEX "User_wechatUnionId_key" ON "User"("wechatUnionId");
CREATE UNIQUE INDEX "User_wechatOpenId_key" ON "User"("wechatOpenId");
CREATE UNIQUE INDEX "User_feishuUserId_key" ON "User"("feishuUserId");
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "accountName" TEXT,
    "publishDate" DATETIME,
    "originalUrl" TEXT NOT NULL,
    "localPath" TEXT,
    "thumbnailPath" TEXT,
    "feishuUrl" TEXT,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Article_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Article" ("accountName", "author", "createdAt", "feishuUrl", "id", "localPath", "originalUrl", "publishDate", "status", "thumbnailPath", "title", "updatedAt", "userId") SELECT "accountName", "author", "createdAt", "feishuUrl", "id", "localPath", "originalUrl", "publishDate", "status", "thumbnailPath", "title", "updatedAt", "userId" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE UNIQUE INDEX "Article_userId_originalUrl_key" ON "Article"("userId", "originalUrl");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
