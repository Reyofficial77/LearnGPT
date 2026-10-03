-- Image attachments (resized JPEG data URLs) stored per message.
ALTER TABLE "Message" ADD COLUMN "images" JSONB;
