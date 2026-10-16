import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Two jobs.
 *
 * The public site's language. Bangla pages live at the plain addresses
 * (/mp/x) and English ones under /en (/en/mp/x), but in the app both are
 * built under app/[lang]: a plain address is quietly served from /bn, so no
 * Bangla link or bookmark changes. Someone who types /bn/... is sent to the
 * plain address, so each Bangla page has one address only. The pages
 * themselves stay prerendered; this only picks which one.
 *
 * The admin session. Supabase access tokens expire hourly; this refreshes
 * them on each /admin request and writes the new cookies back.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin' || pathname.startsWith('/admin/')) return adminSession(request);

  // A password-reset link whose redirect Supabase refused (the site URL is not
  // on its allow list) lands on the homepage with the code or error still in
  // the query. Hand it to the recovery route instead of losing it.
  if (pathname === '/') {
    const q = request.nextUrl.searchParams;
    if (q.has('code') || q.has('error_code')) {
      const to = request.nextUrl.clone();
      to.pathname = '/admin/recover';
      return NextResponse.redirect(to);
    }
  }

  // English: served as it is.
  if (pathname === '/en' || pathname.startsWith('/en/')) return NextResponse.next();

  // The internal Bangla prefix, typed by hand: the plain address is the page's one address.
  if (pathname === '/bn' || pathname.startsWith('/bn/')) {
    const to = request.nextUrl.clone();
    to.pathname = pathname.slice(3) || '/';
    return NextResponse.redirect(to, 308);
  }

  const to = request.nextUrl.clone();
  to.pathname = pathname === '/' ? '/bn' : `/bn${pathname}`;
  return NextResponse.rewrite(to);
}

async function adminSession(request: NextRequest) {
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
  // Every page, of either language, and the admin. Not the API, Next's own
  // files, or any file in public/ or app/ with an extension (geo/*.json,
  // sitemap.xml, icons), which are the same in both languages.
  matcher: ['/((?!api/|_next/|.*\\.[A-Za-z0-9]+$).*)'],
};
