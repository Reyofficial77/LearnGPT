import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.learngpt.my.id";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "LearnGPT – AI Learning and Coding Assistant", template: "%s | LearnGPT" },
  description: "LearnGPT is an AI assistant for learning, coding, web research, running Python and JavaScript, and creating downloadable projects.",
  applicationName: "LearnGPT",
  keywords: ["LearnGPT", "AI learning assistant", "AI coding assistant", "learn programming", "Python AI", "JavaScript AI", "downloadable code projects"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", siteName: "LearnGPT", title: "LearnGPT – AI Learning and Coding Assistant", description: "Learn, research, run code, and create downloadable projects with LearnGPT." },
  twitter: { card: "summary", title: "LearnGPT – AI Learning and Coding Assistant", description: "An AI workspace for learning, coding, research, and project creation." },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: "/icon.ico", shortcut: "/icon.ico", apple: "/images/book-open.svg" }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content", themeColor: "#191919", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
