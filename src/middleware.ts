import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

// Lightweight edge gate: redirect unauthenticated users away from app
// routes by checking for the Auth.js session cookie. Full authorization
// (roles/permissions) is enforced in server components and API routes.

const PUBLIC_PATHS = ["/login", "/unauthorized", "/api/auth"];

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
// 60 writes per minute per client — generous for humans, stops abuse
const WRITE_LIMIT = 60;
const WRITE_WINDOW_MS = 60_000;

function hasSessionCookie(req: NextRequest): boolean {
  return (
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token")
  );
}

function clientKey(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
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
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Rate-limit API write methods per client IP
  if (pathname.startsWith("/api/") && WRITE_METHODS.has(req.method)) {
    const { allowed, retryAfterSeconds } = rateLimit(
      `${clientKey(req)}:write`,
      WRITE_LIMIT,
      WRITE_WINDOW_MS,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests — please slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|uploads).*)"],
};
