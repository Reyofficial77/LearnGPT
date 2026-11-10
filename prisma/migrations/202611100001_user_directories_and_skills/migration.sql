ALTER TABLE "User" ADD COLUMN "directoryId" TEXT;

DO $$
DECLARE
  account RECORD;
  candidate TEXT;
BEGIN
  FOR account IN SELECT "id" FROM "User" WHERE "directoryId" IS NULL LOOP
    LOOP
      candidate := lpad((floor(random() * 90000000) + 10000000)::bigint::text, 8, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "User" WHERE "directoryId" = candidate);
    END LOOP;
    UPDATE "User" SET "directoryId" = candidate WHERE "id" = account."id";
  END LOOP;
END $$;

ALTER TABLE "User" ALTER COLUMN "directoryId" SET NOT NULL;
CREATE UNIQUE INDEX "User_directoryId_key" ON "User"("directoryId");

CREATE TABLE "UserSkill" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserSkill_userId_slug_key" ON "UserSkill"("userId", "slug");
CREATE INDEX "UserSkill_userId_updatedAt_idx" ON "UserSkill"("userId", "updatedAt");
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSettings" ALTER COLUMN "enabledSkills" SET DEFAULT '["frontend-design"]'::jsonb;
ALTER TABLE "UserSettings" RENAME COLUMN "dictationLanguage" TO "speechLanguage";
ALTER TABLE "UserSettings" ALTER COLUMN "speechLanguage" SET DEFAULT 'auto';
UPDATE "UserSettings" SET "enabledSkills" = '["frontend-design"]'::jsonb WHERE "enabledSkills" IS NULL OR "enabledSkills" = '[]'::jsonb;
