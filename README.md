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

## AI provider (Ollama Cloud)

LearnGPT uses **Ollama Cloud** through one server-side key. Users do not need to enter any API key.

Set in Vercel → Environment Variables:
- `OLLAMA_API_KEY` (required, create it at https://ollama.com/settings/keys)

| LearnGPT model | Ollama model | Optional env override |
| --- | --- | --- |
| Learn 1.0 Smart | `gemma4:31b` | `OLLAMA_MODEL_SMART` |
| Learn 1.0 Study | `beam` | `OLLAMA_MODEL_STUDY` |
| Learn 2.0 Thinking | `gpt-oss:120b` | `OLLAMA_MODEL_THINKING` |

The key is only read in `/api/chat` on the server and is never sent to the browser. You can list the model names your key can use with `curl https://ollama.com/api/tags`. Usage is billed to the Ollama account that owns the key.

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
