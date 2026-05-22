import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * #386: Nonce-based Content Security Policy
 *
 * Generates a fresh cryptographic nonce per page request and injects it into
 * `script-src` via `'nonce-{nonce}' 'strict-dynamic'`, replacing the previous
 * `'unsafe-inline'` which neutralised XSS protection.
 *
 * The nonce is forwarded to the layout via `x-nonce` request header so that
 * Next.js Server Components can pass it to any inline `<script>` / `<Script>`.
 *
 * API routes and static assets are excluded — they do not render HTML and do
 * not need a per-request nonce.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isProduction = process.env.NODE_ENV === "production";

  const cspParts = [
    "default-src 'self'",
    // nonce + strict-dynamic replaces unsafe-inline; strict-dynamic allows
    // scripts loaded by a nonced script without listing every origin.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https:",
    "form-action 'self'",
    ...(isProduction ? ["upgrade-insecure-requests"] : [])
  ];
  const csp = cspParts.join("; ");

  // Forward nonce to layout via request header (readable by Server Components).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all page routes except:
     * - /api/* (API routes — JSON only, no script execution)
     * - /_next/static (static assets)
     * - /_next/image (image optimisation)
     * - /favicon.ico, /robots.txt, etc.
     */
    "/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt).*)"
  ]
};
