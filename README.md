# LearnGPT

LearnGPT is a Next.js App Router learning assistant with Gemini, OpenAI, and Anthropic support. It uses client-side Google Identity Services and GitHub OAuth with PKCE. Firebase is not used.

## Run

```bash
npm install
npm run dev
```

## Client OAuth setup

Create `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_web_client_id
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
```

### Google
Create a Web OAuth client in Google Cloud and configure the site's authorized JavaScript origin. Google Identity Services renders the sign-in button in the browser.

### GitHub
Create a GitHub OAuth App or GitHub App with user authorization enabled. Set the callback URL to:

`http://localhost:3000/auth/login`

For production, use your production HTTPS URL instead. LearnGPT uses the authorization-code flow with PKCE, so no GitHub client secret is placed in the browser.

## AI provider keys

API keys for Gemini/OpenAI/Anthropic are configured from LearnGPT Settings and stored in the browser. The Next.js `/api/chat` route forwards the selected request to the chosen provider. For production, use a server-side secret/proxy instead of exposing provider keys in a browser.

## LearnGPT Model Mapping

LearnGPT exposes three internal model names. The selected provider determines the real API model:

- `learn-1.0-smart` → Gemini `gemini-3.6-flash` / OpenAI `gpt-6-luna` / Anthropic `claude-sonnet-5-5`
- `learn-1.0-study` → Gemini `gemini-3.7-flash` / OpenAI `gpt-6.1-sol` / Anthropic `claude-opus-5-5`
- `learn-2.0-thinking` → Gemini `gemini-3.8-flash` / OpenAI `gpt-6-astra` / Anthropic `claude-fable-5-1`

The browser sends only the LearnGPT model name to `/api/chat`; the server route resolves it to the provider-specific model ID.
