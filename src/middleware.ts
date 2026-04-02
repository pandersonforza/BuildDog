import { NextRequest, NextResponse } from "next/server";
import { getSessionTokenFromCookie } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/register", "/bid", "/api/auth", "/api/bids", "/api/email/inbound"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = getSessionTokenFromCookie(
    request.headers.get("cookie")
  );

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Let the request through — full session validation happens in API routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo\\.svg|bid|api/bids).*)",
  ],
};
