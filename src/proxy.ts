import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Keeps the admin session alive. Supabase access tokens expire hourly; this
 * refreshes them on each /admin request and writes the new cookies back.
 * It matches /admin, plus the bare homepage only to catch a stray reset link;
 * public pages are otherwise never touched and stay static.
 */
export default async function proxy(request: NextRequest) {
  // A password-reset link whose redirect Supabase refused (the site URL is not
  // on its allow list) lands on the homepage with the code or error still in
  // the query. Hand it to the recovery route instead of losing it. Any other
  // homepage request passes straight through, untouched.
  if (request.nextUrl.pathname === '/') {
    const q = request.nextUrl.searchParams;
    if (q.has('code') || q.has('error_code')) {
      const to = request.nextUrl.clone();
      to.pathname = '/admin/recover';
      return NextResponse.redirect(to);
    }
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const c of list) request.cookies.set(c.name, c.value);
        response = NextResponse.next({ request });
        for (const c of list) response.cookies.set(c.name, c.value, c.options);
      },
    },
  });

  // Touching the user is what triggers the refresh.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/'],
};
