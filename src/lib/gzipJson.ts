/**
 * A route's JSON, gzipped for a browser that accepts it. The server compresses
 * pages and static files but not what a route handler returns, so a member's
 * news feed (300 stories, about 360 KB) went over the wire as it was; gzipped
 * it is about a tenth of that.
 */
import { gzipSync } from 'node:zlib';

/** Below this a response is not worth the work of compressing. */
const MIN_BYTES = 1024;

export async function gzipJson(req: Request, res: Response): Promise<Response> {
  if (res.headers.has('content-encoding') || !/\bgzip\b/i.test(req.headers.get('accept-encoding') ?? '')) return res;
  const body = new Uint8Array(await res.arrayBuffer());
  const headers = new Headers(res.headers);
  headers.append('vary', 'Accept-Encoding');
  if (body.byteLength < MIN_BYTES) return new Response(body, { status: res.status, statusText: res.statusText, headers });
  headers.set('content-encoding', 'gzip');
  headers.delete('content-length');
  return new Response(gzipSync(body), { status: res.status, statusText: res.statusText, headers });
}
