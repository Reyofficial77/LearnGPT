import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = { title: "LearnGPT", description: "Your AI learning assistant." };
// viewport-fit=cover lets the layout use the safe-area insets (notch / home bar);
// resizes-content keeps the composer above the on-screen keyboard on Android.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content", themeColor: "#313338", colorScheme: "dark" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
