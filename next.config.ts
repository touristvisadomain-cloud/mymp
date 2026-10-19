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
/**
 * The previous site's party slugs (its English names, spelled several ways),
 * to the slugs here (data/parties.json). A slug not listed goes to the list.
 */
const OLD_PARTY_SLUGS: Record<string, string> = {
  "bangladesh-nationalist-party": "bnp",
  "bangladesh-nationalist-party-bnp": "bnp",
  "bangladesh-jamaat-e-islami": "bjei",
  "bangladesh-jamaat-e-islami-bjei": "bjei",
  "jamaat-e-islami": "bjei",
  independent: "ind",
  "national-citizen-party": "ncp",
  "national-citizens-party": "ncp",
  "national-citizens-party-ncp": "ncp",
  "bangladesh-khilafat-majlis": "bkm",
  "bangladesh-khelafat-majlis": "bkm",
  "islami-andolan-bangladesh": "imb",
  "islamic-movement-bangladesh": "imb",
  "gono-odhikar-parishad": "gop",
  "gonoodhikar-parishad": "gop",
  "gana-adhikar-parishad": "gop",
  "council-on-people": "gop",
  "bangladesh-jatiyo-party": "bjp",
  "bangladesh-jatiya-party": "bjp",
  "bangladesh-national-party-bjp": "bjp",
  "khilafat-majlis": "km",
  "khelafat-majlis": "km",
  "ganosamhati-andolon": "psm",
  "gonosamhati-andolon": "psm",
  "ganosamhati-andolan": "psm",
  "peoples-solidarity-movement": "psm",
  "jatiya-ganatantrik-party": "jagpa",
  "jatiya-ganatantrik-party-jagpa": "jagpa",
};

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
  // A party's old page goes to its page here (Search Console, 2026-10-19:
  // /parties/national-citizen-party and others were landing on the list).
  ...Object.entries(OLD_PARTY_SLUGS).map(([old, slug]) => ({
    source: `/parties/${old}`,
    destination: `/dol/${slug}`,
    permanent: true,
  })),
  {
    source: "/parties/:slug(bnp|bjei|ind|ncp|bkm|imb|gop|bjp|km|psm|jagpa)",
    destination: "/dol/:slug",
    permanent: true,
  },
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
  // The public site has a root layout per language (app/[lang]) and the admin its own, so an
  // address no route answers gets app/global-not-found.tsx.
  experimental: { globalNotFound: true },
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
            // Files in public/ came with max-age=0, so every visit asked for them again. They
            // change with a build at most: a browser keeps them an hour and may use a copy up
            // to a day old while it checks for a new one.
            ...["/geo/:path*", "/search-index.json", "/party/:path*", "/icon-:size.png", "/logo.svg"].map((source) => ({
              source,
              headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
            })),
            // The app draws seat and election maps from these; its web build needs them readable cross-origin,
            // like the /api/app routes. Public, read-only data.
            { source: "/geo/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
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
    "/api/og/mp/\\[slug\\]/en": [HARFBUZZ_WASM],
    "/api/og/party/\\[slug\\]": [HARFBUZZ_WASM, "./public/party/og/*.jpg"],
    "/api/og/party/\\[slug\\]/en": [HARFBUZZ_WASM, "./public/party/og/*.jpg"],
    "/api/og/jela/\\[slug\\]": [HARFBUZZ_WASM],
    "/api/og/jela/\\[slug\\]/en": [HARFBUZZ_WASM],
    "/api/og/committee/\\[slug\\]": [HARFBUZZ_WASM],
    "/api/og/committee/\\[slug\\]/en": [HARFBUZZ_WASM],
    "/api/og/ministers/\\[slug\\]": [HARFBUZZ_WASM],
    "/api/og/ministers/\\[slug\\]/en": [HARFBUZZ_WASM],
    "/api/og/pages/\\[key\\]": [HARFBUZZ_WASM],
    "/api/og/pages/\\[key\\]/en": [HARFBUZZ_WASM],
  },
};

export default nextConfig;
