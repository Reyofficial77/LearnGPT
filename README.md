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

## AI provider (Google Gemini API / Gemma 4)

LearnGPT uses Google's hosted Gemma 4 models through the Gemini API. The API key is stored on the server; users never need to enter their own key.

Set in Vercel → Project Settings → Environment Variables:
- `GEMINI_API_KEY` (required; create one at https://aistudio.google.com/apikey)

| LearnGPT model | Gemma 4 model | Thinking level | Optional env override |
| --- | --- | --- | --- |
| Learn 1.0 Smart | `gemma-4-26b-a4b-it` | `minimal` | `GEMINI_MODEL_SMART` |
| Learn 1.0 Study | `gemma-4-31b-it` | `minimal` | `GEMINI_MODEL_STUDY` |
| Learn 2.0 Thinking | `gemma-4-31b-it` | `high` | `GEMINI_MODEL_THINKING` |

The model IDs and thinking levels are resolved on the server. The API key is sent only from the server to Google and is never exposed to the browser. Google AI Studio usage limits and billing apply to the Google account that owns the key. No Prisma migration is required for this provider change.

## OAuth callback URLs

Google Authorized redirect URI:
`https://YOUR-DOMAIN/api/auth/google/callback`

GitHub Authorization callback URL:
`https://YOUR-DOMAIN/api/auth/github/callback`

For local development, use your local URL, for example `http://localhost:3000/api/auth/google/callback` and `http://localhost:3000/api/auth/github/callback`.

## Database

The build runs `prisma migrate deploy && next build`. PostgreSQL stores users, sessions, chats, messages, and settings.

## Memory system

- `MEMORY.md` contains global LearnGPT behavior and learning principles. It is shared across accounts.
- Per-user memory follows `user/{account-id}/USER.md` and `user/{account-id}/MEMORY.md`; format templates are in `user/template/`. Runtime content is stored in PostgreSQL (`UserMemory`) under the authenticated internal user ID so it remains private and durable on Vercel. The root `USER.md` has been removed.
- Memory maintenance runs when a conversation contains a clear, durable user preference, learning goal, ongoing project, or correction. Shared memory changes only after an explicit global request.
- `GlobalMemory`, `UserMemory`, and message file attachments are created by migration `202611080001_memory_and_file_attachments`.

## Chat features

- The model switcher is inside the message composer and uses a custom menu. Settings open from the account menu at the bottom of the sidebar (or with `Ctrl+Shift+,`). Settings include the built-in frontend design skill, Web Search, appearance, and the voice input language.
- Users can choose `Documents & files`, `Images`, camera capture, one-message Web Search, or open Skills settings from the attachment menu. Supported documents include PDF, DOCX, text, CSV, JSON, and common code formats. PDF text extraction is best-effort; scanned PDFs may need to be uploaded as images.
- Uploaded document/file names are replaced with generated names in the browser before the request is sent, then assigned a fresh server-side name. Original filenames are not stored or sent to the AI provider.
- Up to 4 images or 4 documents/files can be staged. Individual documents/files are limited to 1 MB, and the combined attachment request is capped client-side to help stay within serverless request limits.
- Image attachments (up to 4 per message; resized to JPEG in the browser) are stored on the message as JSON — migration `202610030001_message_images` runs automatically on build.
- Code blocks are syntax-highlighted and use a compact header: language name on the left, Copy and (where supported) Run on the right. JavaScript and Python run in a sandboxed browser iframe; HTML, SVG and CSS show a visual preview. Fullscreen is available for visual previews.
- When asked for a file, the AI replies with a ```` ```file:name.ext ```` block, rendered as a downloadable card (text-based formats only).

## Sidebar, projects and chat titles

- Colors: dark page `#191919`, sidebar/popups `#1f1f1f`, composer input `#303030`, border `#2d2d2d`; light page `#ffffff`, sidebar `#fafafa`, border `#efefef`.
- Sidebar order: brand → `+ New Chat` → **Workspace** (projects, each with its own chat history) → **Chat** (chats outside any project) → account. Clicking the account opens a menu with Settings, Language, Help and Sign out.
- **Projects** have a name and a goal. The `Project` button opens the create dialog. The project name and goal are added to the AI system prompt for every chat inside that project. Deleting a project deletes its chats.
- Routes: plain chats use `/chat/{25-char-id}`; project pages use `/{project-slug}`; chats in a project use `/{project-slug}/{25-char-id}`. The slug is made from the project name and is unique per user; names such as `chat`, `api` or `auth` are reserved (see `lib/slug.ts`).
- **Chat titles** are written by the AI from the user's first prompt (2–6 words, in the user's language) in parallel with the first answer (`lib/chat-title.ts`). If the AI call fails, a shortened version of the prompt is used.
- `Language` offers 25 interface locales. English and Bahasa Indonesia cover the complete interface; the other locales translate core navigation, composer, and settings labels, with some secondary text falling back to English; chat titles and LearnGPT branding stay unchanged. The choice is kept in the browser (`localStorage`), and each new chat gets a varied greeting. English (US) is the default interface language; voice input language is configured separately in Settings.
- The composer has the message box on top and a toolbar below it: attach (+) and the model picker on the left, dictation (microphone) and send on the right. Dictation uses the browser Speech Recognition API (Chrome, Edge, Safari) and uses the selected voice input language (default: the browser/device language). Automatic mode uses the device locale; the browser speech API does not provide reliable automatic detection across multiple spoken languages.
- Projects and `Chat.projectId` are created by migration `202611080002_projects` (runs automatically on build).

## Recent workspace features

- The sidebar can be collapsed on desktop and opened as a drawer on smaller screens.
- Chat actions support renaming, pinning, deleting, and public sharing. Public links use `/shared/c/{chatId}`; choosing **Make private** revokes the link.
- Settings include dark, light, and system themes. Theme choice is stored with the signed-in user's settings.
- Code blocks follow a compact inline layout inspired by the supplied reference: language label, Copy icon, and an English **Run** button. JavaScript and Python execute in a sandboxed browser iframe; HTML and SVG render in a preview; CSS is applied to a sample preview page. Copy and Run labels remain in English regardless of the selected LearnGPT UI language. Python uses Pyodide 314.0.7 in the browser; the first run downloads the runtime from its CDN and therefore requires an internet connection. Code does not execute on the LearnGPT server.
- HTML, SVG and CSS previews open when the inline Run button is pressed. Full-screen preview is rendered outside the scrolling chat viewport.

### Database migration

The new migration `202611080003_chat_sharing_and_preferences` adds `Chat.pinned`, `Chat.isPublic`, and `UserSettings.theme`. The production build already runs `prisma migrate deploy`, so make sure `DATABASE_URL` is configured in the deployment environment before deploying.

### Code execution notes

JavaScript runs inside an iframe sandbox without access to the LearnGPT session or storage. Python runs locally in the browser using Pyodide 314.0.7; Python packages beyond the standard library may need to be installed in the Python runtime and are not automatically provisioned. HTML, SVG and CSS blocks are previewed in an isolated iframe. Long-running or platform-specific programs (for example, desktop GUI applications, native binaries, or Node.js-only APIs) are not supported by this browser execution environment.


## Search engine visibility

- The public home page contains crawlable LearnGPT product copy and SoftwareApplication JSON-LD. Metadata includes title, description, keywords, canonical URL, Open Graph, Twitter summary, and index/follow directives.
- `app/sitemap.ts` and `app/robots.ts` publish `/sitemap.xml` and `/robots.txt`.
- Set `NEXT_PUBLIC_SITE_URL` to the exact production origin (for example `https://your-domain.example`) in Vercel. Then submit `https://your-domain.example/sitemap.xml` in Google Search Console. Search Console submission requests crawling; Google controls indexing and ranking, so a query for `LearnGPT` cannot be guaranteed to show a specific position.

## New features

- The `+` menu offers camera capture, a one-message Web Search override, and a shortcut to Skills settings. Web Search can also be enabled persistently in Settings.
- `project:project-name` JSON fenced blocks are packaged into validated ZIP downloads. Standalone `file:filename.ext` fenced blocks download as separate files. ZIP is currently the supported archive format; 7z and RAR creation are not included.
- The sidebar search matches conversation titles and chat IDs. The brand-side arrow keeps the desktop sidebar collapsed to icons; on phones the sidebar remains a drawer.

## Account folders and custom skills

Every account receives a private, unique 8-digit `directoryId`. It is not included in session or client-facing account data. Custom Markdown skills are stored durably in PostgreSQL and mirrored locally to `users/{directoryId}/Skill/{skill-slug}/SKILL.md`; the `users/` directory is ignored by Git because it contains private account data. On serverless deployments, PostgreSQL is the persistent source of truth because the function filesystem may be temporary.

Custom skills can be uploaded from Settings or the `/` composer menu. Leave the skill name empty to use the first Markdown H1 (`# Skill name`). Use `/{skill-slug}` in a message to attach that skill's task-specific guidance. The built-in `frontend-design` skill is always active.

## Windows desktop application (Tauri 2)

LearnGPT includes a Tauri 2 desktop shell. See [`DESKTOP.md`](./DESKTOP.md) for the GitHub Actions build process, local development commands, and platform notes. The Windows workflow builds both `.exe` (NSIS) and `.msi` installers and publishes them as a downloadable GitHub Actions artifact.

The desktop shell loads `https://www.learngpt.my.id`; the Next.js backend, PostgreSQL database, and provider credentials stay on the hosted server. This keeps the Windows package small, but the app requires an internet connection and a working LearnGPT deployment. Google OAuth inside embedded webviews may be rejected by Google's policy; see the authentication note in `DESKTOP.md`.
