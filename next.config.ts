import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium"],
  allowedDevOrigins: ["10.252.104.43"],
  outputFileTracingExcludes: {
    "/*": ["./.env*", "./reports/generated/**", "./outputs/**", "./tmp/**", "./.codex-spreadsheets/**"],
  },
  outputFileTracingIncludes: {
    "/api/projects/*/report": [
      "./public/imkan-logo.png", "./public/saal-logo.svg", "./node_modules/@sparticuz/chromium/bin/**",
    ],
    "/api/admin/batch-reports": [
      "./public/imkan-logo.png", "./public/saal-logo.svg", "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
};

export default nextConfig;
