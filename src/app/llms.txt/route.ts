import { llmsTxt } from '@/lib/llms';

// Built once per deploy, like the pages it describes.
export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
