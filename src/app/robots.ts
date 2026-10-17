import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * The AI assistants' crawlers, welcomed by name: these are the ones that read
 * a page so ChatGPT, Claude, Perplexity, Gemini, Copilot and Apple can answer
 * "who is the MP for Dhaka-17" from it and link back. The general rule lets
 * them in anyway; naming them says plainly that the site is open to them. A
 * crawler with its own group ignores the general one, so the group repeats
 * what stays closed.
 */
const AI_CRAWLERS = [
  'OAI-SearchBot', 'ChatGPT-User', 'GPTBot',
  'Claude-SearchBot', 'Claude-User', 'ClaudeBot',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'bingbot', 'DuckAssistBot', 'meta-externalagent',
];

const OPEN = ['/', '/api/og/'];
const CLOSED = ['/admin', '/api/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Link-preview crawlers (X, LinkedIn, Slack) obey robots.txt, so the member preview images under /api/og stay open.
      { userAgent: '*', allow: OPEN, disallow: CLOSED },
      { userAgent: AI_CRAWLERS, allow: OPEN, disallow: CLOSED },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
