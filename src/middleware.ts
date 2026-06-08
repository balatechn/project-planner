import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Lightweight edge gate: redirect unauthenticated users away from app
// routes by checking for the Auth.js session cookie. Full authorization
// (roles/permissions) is enforced in server components and API routes.

const PUBLIC_PATHS = ["/login", "/unauthorized", "/api/auth"];

function hasSessionCookie(req: NextRequest): boolean {
  return (
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token")
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.svg" ||
    pathname.startsWith("/uploads")
  ) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(req)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|uploads).*)"],
};
