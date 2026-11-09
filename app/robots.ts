import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.learngpt.my.id";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/chat/"] }], sitemap: new URL("/sitemap.xml", base).toString() };
}
