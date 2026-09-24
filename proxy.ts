import { NextResponse } from 'next/server';
export function proxy() {
  const r = NextResponse.next();
  r.headers.set('X-Content-Type-Options', 'nosniff');
  r.headers.set('X-Frame-Options', 'DENY');
  r.headers.set('Referrer-Policy', 'no-referrer');
  r.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  r.headers.set('Cache-Control', 'private, no-store');
  r.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  return r;
}
export const config = { matcher: ['/((?!_next|assets|favicon|hero).*)'] };
