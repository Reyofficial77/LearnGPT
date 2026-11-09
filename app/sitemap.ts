import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.learngpt.my.id";
  return [{ url: new URL("/", base).toString(), lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
}
