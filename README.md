# LearnGPT

LearnGPT is a Next.js AI learning workspace with PostgreSQL persistence and server-side OAuth.

## Vercel Environment Variables

Set these in Vercel Project Settings → Environment Variables. Mark sensitive values as Secret/encrypted where the Vercel UI provides that option. **Never use `NEXT_PUBLIC_` for secrets.**

Required:
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

The Google and GitHub client IDs are intentionally server-side too. The browser never receives OAuth configuration or client secrets.

## AI provider keys (bring your own key)

LearnGPT does **not** use server-side AI keys. Each user opens **Settings → Your API keys** and adds their own Gemini, OpenAI, or Anthropic key.

- Keys are stored only in the user's browser (`localStorage`, scoped per account). They are never saved in the database.
- On each chat request the key is sent over HTTPS to `/api/chat`, used once to call the provider, and discarded. It is never logged.
- The **Test** button calls `/api/settings/test-key`, which only lists models, so it spends no tokens.
- AI usage is billed to the user's own provider account.

## OAuth callback URLs

Google Authorized redirect URI:
`https://YOUR-DOMAIN/api/auth/google/callback`

GitHub Authorization callback URL:
`https://YOUR-DOMAIN/api/auth/github/callback`

For local development, use your local URL, for example `http://localhost:3000/api/auth/google/callback` and `http://localhost:3000/api/auth/github/callback`.

## Database

The build runs `prisma migrate deploy && next build`. PostgreSQL stores users, sessions, chats, messages, and settings.

## Chat features

- Image attachments (up to 4 per message; resized to JPEG in the browser) are stored on the message as JSON — migration `202610030001_message_images` runs automatically on build.
- Code blocks are syntax-highlighted. `html` / `svg` blocks get a sandboxed live preview (no `allow-same-origin`).
- When asked for a file, the AI replies with a ```` ```file:name.ext ```` block, rendered as a downloadable card (text-based formats only).
