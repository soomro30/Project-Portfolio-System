import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.252.104.43"],
  outputFileTracingExcludes: {
    "/*": ["./.env*", "./reports/generated/**", "./outputs/**", "./tmp/**", "./.codex-spreadsheets/**"],
  },
  outputFileTracingIncludes: {
    "/api/projects/*/report": ["./public/imkan-logo.png", "./public/saal-logo.svg"],
  },
};

export default nextConfig;
