import type { NextConfig } from "next";

/**
 * Every public page is prerendered, so the site can also be emitted as plain
 * files for a static host. That path is opt-in through STATIC_EXPORT so the
 * normal build keeps the door open for the admin panel and its API routes.
 */
const staticExport = process.env.STATIC_EXPORT === "1";

/**
 * Paths from the previous mymp.bd site. Anyone holding an old bookmark or a
 * search result lands on the matching section here instead of a 404. The old
 * per-member ids do not map onto the new slugs, so those fall back to the list.
 */
const legacyRedirects = [
  // One address for search engines and shares: www.mymp.bd served the same
  // pages as a second site until 2026-10-12.
  {
    source: "/:path*",
    has: [{ type: "host" as const, value: "www.mymp.bd" }],
    destination: "https://mymp.bd/:path*",
    permanent: true,
  },
  { source: "/mps", destination: "/mp", permanent: true },
  { source: "/mps/:id", destination: "/mp", permanent: true },
  { source: "/parties", destination: "/dol", permanent: true },
  { source: "/parties/:slug", destination: "/dol", permanent: true },
  { source: "/about", destination: "/somporke", permanent: true },
  { source: "/contact", destination: "/jogajog", permanent: true },
  { source: "/privacy", destination: "/gopaniyota", permanent: true },
  { source: "/terms", destination: "/gopaniyota", permanent: true },
  // Still in Google's index on 2026-09-19 as "Statistics — MY MP".
  { source: "/statistics", destination: "/parisonkhan", permanent: true },
  { source: "/stats", destination: "/parisonkhan", permanent: true },
  // English paths from the footer spec (2026-09-12) that the site spells in Bangla.
  { source: "/election-2026", destination: "/nirbachon", permanent: true },
  { source: "/sources", destination: "/sutro", permanent: true },
  // The old Laravel admin lived at /admin/login too; that path is now the real
  // admin panel, so there is deliberately no redirect for /admin here.

  // District pages that came from irregular seat names and were in the sitemap
  // for a day; each now belongs to its real district (see districtOf).
  {
    source: "/jela/chittagong",
    destination: "/jela/chattogram",
    permanent: true,
  },
  { source: "/jela/pabna-5", destination: "/jela/pabna", permanent: true },
  {
    source: "/jela/cox-sbazar",
    destination: "/jela/coxs-bazar",
    permanent: true,
  },
];

const HARFBUZZ_WASM = "./node_modules/harfbuzzjs/dist/harfbuzz.wasm";

/**
 * Security headers on every response (2026-10-15, after the database was
 * reached through an open Supabase Studio). The policy leaves scripts alone:
 * a nonce would make every page dynamic and end the prerendering. What it
 * does stop: the site being framed by another (clickjacking), a form or a
 * <base> pointing elsewhere, plugins, plain-HTTP loads, MIME sniffing, and
 * the browser sending full addresses to other sites.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(staticExport
    ? {
        output: "export",
        images: { unoptimized: true },
        basePath: process.env.BASE_PATH || "",
      }
    : {
        async redirects() {
          return legacyRedirects;
        },
        async headers() {
          return [
            { source: "/:path*", headers: securityHeaders },
            // The admin is never cached by a browser or a proxy.
            { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
          ];
        },
      }),
  trailingSlash: staticExport,
  // The preview images shape Bangla with HarfBuzz (WASM) and read two font files at run time, all from
  // node_modules, so the function must ship them. src/lib/og/banglaText.ts reads each font by a literal
  // path, which the build traces exactly; the fonts are not listed here because Turbopack also pulls in
  // the `.ttf.png` previews beside any font entry. The WASM, opened by harfbuzzjs itself, is the backstop.
  // Keys are globs: an unescaped `[slug]` never matches under Turbopack.
  serverExternalPackages: ["harfbuzzjs"],
  outputFileTracingIncludes: {
    "/api/og/mp/\\[slug\\]": [HARFBUZZ_WASM],
    "/api/og/party/\\[slug\\]": [HARFBUZZ_WASM, "./public/party/og/*.jpg"],
  },
};

export default nextConfig;
