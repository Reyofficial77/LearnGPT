-- Images created by the AI. Stored as bytes and served from /api/images/{id}.
CREATE TABLE "GeneratedImage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "chatId" TEXT,
  "mimeType" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "prompt" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeneratedImage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GeneratedImage_userId_createdAt_idx" ON "GeneratedImage"("userId", "createdAt");
CREATE INDEX "GeneratedImage_chatId_createdAt_idx" ON "GeneratedImage"("chatId", "createdAt");
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
