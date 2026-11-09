import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  outputFileTracingIncludes: {
    "/api/chat": ["./MEMORY.md", "./skills/frontend-design/SKILL.md"]
  }
};

export default nextConfig;
