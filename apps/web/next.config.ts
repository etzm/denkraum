import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * No third parties in the browser (docs/datenschutz/README.md section 5): everything is
 * served from our own origin. Next.js needs inline scripts for hydration; a nonce-based
 * policy can tighten script-src later without changing what may be loaded.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
];

const config: NextConfig = {
  poweredByHeader: false,
  transpilePackages: [
    "@denkraum/core",
    "@denkraum/db",
    "@denkraum/llm",
    "@denkraum/privacy",
    "@denkraum/mod-deutsch-schreibwerkstatt",
    "@denkraum/mod-mathematik-trigonometrie",
  ],
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "@anthropic-ai/sdk", "@anthropic-ai/bedrock-sdk"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
