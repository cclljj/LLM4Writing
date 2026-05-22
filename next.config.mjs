const isProduction = process.env.NODE_ENV === "production";

// NOTE (#386): script-src is no longer set here.
// middleware.ts generates a per-request nonce and sets `script-src 'nonce-…'
// 'strict-dynamic'` on all page responses, replacing the previous
// `'unsafe-inline'` which neutralised XSS protection.
// The CSP below covers API routes and static assets (which do not render HTML
// and don't need a dynamic nonce).
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self'${isProduction ? "" : " 'unsafe-eval'"}`,
  "connect-src 'self' https:",
  "form-action 'self'"
];

if (isProduction) {
  cspDirectives.push("upgrade-insecure-requests");
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; ")
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)"
  }
];

if (isProduction) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains"
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": [
      "./src/config/structure-tree/**/*",
      "./src/config/structure-tree.json",
      "./src/config/step-opening/**/*"
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
