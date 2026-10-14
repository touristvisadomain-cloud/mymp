import { NextResponse, type NextRequest } from 'next/server';
import { supabaseSession, supabaseConfigured } from '@/lib/supabase/server';

/**
 * Where a password-reset email lands.
 *
 * `resetPasswordForEmail` (the /admin/forgot form) uses the PKCE flow, so
 * Supabase sends the reader here with `?code=`; the verifier it pairs with is
 * a cookie in the browser that asked, which is why the link has to be opened
 * there. `token_hash` + `type` covers a template that links straight to the
 * site instead of through Supabase. Either way a success becomes a signed-in
 * session and lands on the password form; anything else goes back to the
 * forgot form with a reason it can explain.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const back = (error: string) => NextResponse.redirect(new URL(`/admin/forgot?error=${error}`, request.url));
  if (!supabaseConfigured()) return NextResponse.redirect(new URL('/admin/setup', request.url));

  // Supabase reports a dead link on the redirect itself, e.g. otp_expired.
  if (q.get('error_code') || q.get('error')) return back(q.get('error_code') === 'otp_expired' ? 'expired' : 'link');

  const sb = await supabaseSession();
  const code = q.get('code');
  const tokenHash = q.get('token_hash');
  const type = q.get('type');

  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return back(/verifier/i.test(error.message) ? 'browser' : 'link');
  } else if (tokenHash && (type === 'recovery' || type === 'magiclink' || type === 'email')) {
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return back('link');
  } else {
    return back('link');
  }

  return NextResponse.redirect(new URL('/admin/password?recovered=1', request.url));
}
