# LearnGPT multi-platform builds

LearnGPT uses Tauri 2 with the hosted LearnGPT web application at `https://www.learngpt.my.id`.
The same account, chat history, and AI backend are used across supported clients.

## Supported targets

- Windows: NSIS `.exe` and MSI installer.
- Linux: `.deb`, `.rpm`, and AppImage.
- macOS: `.dmg` and `.app` bundle (Intel/Apple Silicon according to the runner architecture).
- Android: installable `.apk` and Play Store `.aab`.
- iOS/iPadOS: the workflow builds an iOS Simulator `.app` archive for smoke testing.

## GitHub Actions

Push to `main` or run **Build LearnGPT for All Platforms** manually from Actions.
Each platform is uploaded as a separate workflow artifact.

## iPhone/iPad distribution

The iOS Simulator artifact is for Simulator only; it cannot be installed on a physical iPhone/iPad.
A device IPA and App Store/TestFlight distribution require Apple signing credentials and provisioning.
Add signing configuration and secrets (Apple Development Team, certificate, and provisioning profile)
before enabling a signed device build. Do not commit certificates, profiles, keystores, or API keys.

## Android distribution

The generated APK is suitable for testing. The AAB is the package format intended for Google Play.
Production Play Store releases should use a protected upload keystore and signing secrets.

## OAuth

The app uses the `learngpt://auth/callback` custom URI scheme on desktop, Android, and iOS.
The hosted callback URLs remain:
- `https://www.learngpt.my.id/api/auth/google/callback`
- `https://www.learngpt.my.id/api/auth/github/callback`

Mobile OAuth returns to the installed app through the registered custom URI scheme.
