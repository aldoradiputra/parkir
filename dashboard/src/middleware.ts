import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("parkir_auth")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - /login
     * - /_next (Next.js internals)
     * - /favicon.ico, /icons, /images (static assets)
     * - files with extensions (e.g. .js, .css, .png)
     */
    "/((?!login|_next|favicon\\.ico|icons|images|.*\\.).*)",
  ],
};
