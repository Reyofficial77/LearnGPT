ALTER TABLE "UserSettings" DROP COLUMN IF EXISTS "systemPrompt";
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "enabledSkills" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "webSearchEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "dictationLanguage" TEXT NOT NULL DEFAULT 'id-ID';

UPDATE "UserSettings" SET "dictationLanguage" = 'id-ID' WHERE "dictationLanguage" = 'auto';
