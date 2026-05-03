import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, verifySessionToken } from '@/lib/auth-token';

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const email = verifySessionToken(token);
  const isLoginPath = pathname === '/login';

  if (!email && !isLoginPath) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/') {
      url.searchParams.set('next', pathname + (search ?? ''));
    }
    return NextResponse.redirect(url);
  }

  if (email && isLoginPath) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)'],
};
