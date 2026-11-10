# LearnGPT Desktop (Tauri 2)

LearnGPT Desktop is a lightweight Windows desktop shell built with Tauri 2. It loads the hosted LearnGPT application from `https://www.learngpt.my.id`, so the Next.js API routes, PostgreSQL data, user accounts, custom skills, and AI provider calls continue to run on the existing hosted backend.

This is an online desktop client, not an offline copy of the Next.js server. An internet connection and an available LearnGPT deployment are required. Updating the web app on the hosted domain updates the content shown inside the desktop client without rebuilding the installer.

## Build automatically with GitHub Actions

The workflow at `.github/workflows/desktop-build.yml` runs on every push to `main` and can also be started manually:

1. Push this project to the `main` branch of the GitHub repository.
2. Open the repository's **Actions** tab.
3. Select **Build LearnGPT Desktop** and open the latest run.
4. Wait for the Windows build to finish successfully.
5. Download the `LearnGPT-Desktop-Windows-*` artifact from the run's **Artifacts** section.

The artifact contains both the NSIS `.exe` installer and the WiX `.msi` installer. Artifacts are retained for 30 days. No Vercel, database, OAuth, or AI API secrets are needed by this workflow because it compiles only the desktop shell and does not run the backend build or migrations.

## Local development

Install the project's Node dependencies, ensure the Next.js environment variables required by the development server are configured, and install the Tauri 2 Windows prerequisites (Rust, Microsoft C++ Build Tools, and WebView2).

```bash
npm install
npm run desktop:dev
```

To build a Windows installer locally:

```bash
npm run desktop:build
```

The production desktop build uses the URL set in `src-tauri/tauri.conf.json` under `build.frontendDist`. Change that URL if the production LearnGPT domain changes.

## Important authentication note

Google blocks OAuth authorization requests made inside embedded webviews under its OAuth security policy. Therefore, Google sign-in may show `disallowed_useragent` in this basic Tauri wrapper until a dedicated system-browser OAuth flow with a secure return-to-app mechanism is implemented. Do not work around this by weakening Google's OAuth restrictions or by exposing OAuth secrets in the desktop app. Test email/password and GitHub sign-in separately in the generated installer as well.

## Security model

The desktop shell does not register native Tauri commands or expose filesystem, shell, or process plugins to the hosted page. Its capability list is empty; the remote frontend receives no native IPC permissions. Backend secrets remain on the hosted server and must never be added to the Tauri configuration or GitHub Actions workflow.
