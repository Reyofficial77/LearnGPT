# LearnGPT Desktop (Tauri 2)

LearnGPT Desktop is a lightweight Windows desktop shell built with Tauri 2. It loads the hosted LearnGPT application from `https://www.learngpt.my.id`, so the Next.js API routes, PostgreSQL data, user accounts, custom skills, and AI provider calls continue to run on the existing hosted backend.

This is an online desktop client, not an offline copy of the Next.js server. An internet connection and an available LearnGPT deployment are required. Updating the web app on the hosted domain updates the content shown inside the desktop client without rebuilding the installer.

## Build automatically with GitHub Actions

The workflow at `.github/workflows/desktop-build.yml` runs on every push to `main` and can also be started manually:

1. Push this project to the `main` branch of the GitHub repository.
2. Open the repository's **Actions** tab.
3. Select **LearnGPT All Platforms** and open the latest run.
4. Wait for the jobs to finish (Windows, Linux, macOS, Android, iOS Simulator).
5. Download the artifacts from the run's **Artifacts** section: `LearnGPT-Windows-*`, `LearnGPT-Linux-*`, `LearnGPT-macOS-*`, `LearnGPT-Android-APK-*`, `LearnGPT-Android-AAB-*`, `LearnGPT-iOS-iPadOS-Simulator-*`.

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

The OAuth provider console redirect URLs remain the hosted callback URLs:

- Google: `https://www.learngpt.my.id/api/auth/google/callback`
- GitHub: `https://www.learngpt.my.id/api/auth/github/callback`

No Google or GitHub client secret belongs in the Windows installer. The `learngpt://` return protocol is registered by the installed desktop application, not by either OAuth provider.

The desktop shell does not expose filesystem, shell, or process access to the hosted page. Its remote capability is limited to the verified LearnGPT production origin and grants only deep-link event access plus opening URLs on that same LearnGPT origin. OAuth handoff codes are random, hashed before storage, expire after two minutes, and can be consumed only once. Normal session cookies remain HttpOnly and are created by the hosted backend. Backend secrets remain on the hosted server and must never be added to the Tauri configuration or GitHub Actions workflow.


## Build notes (all platforms)

- App icons come from `src-tauri/app-icon.png` (1024×1024). The workflow runs `tauri icon` on it for every platform, so the desktop, Android and iOS icon sets are always complete. Run `npm run icons:generate` locally after changing the logo and commit the result.
- The apps only load the hosted site, so the jobs do not run `npm ci`, Prisma or any backend step.
- Android: release APKs are signed in CI so they can be installed. Add the repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` to keep one signing key across builds; without them a throw-away key is created for each run.
- iOS: the build is a Simulator `.app` (zipped). A real device or App Store build needs an Apple Developer team and signing secrets.
- Drag-and-drop of files is handled by the web page itself (`dragDropEnabled` is off in the window config).
