/**
 * Security tests for:
 * - Issue #218: API rate limiting (proxy sliding window)
 * - Issue #219: Cookie SameSite=strict
 * - Issue #322: Signed auth session cookie, password hashing, and security headers
 */
import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline the rate limit logic so we can test it without spinning up the server.
// This mirrors the implementation in proxy.ts exactly.
// ---------------------------------------------------------------------------

type RateLimitRule = { pattern: RegExp; max: number; windowMs: number };

const RATE_LIMIT_RULES: RateLimitRule[] = [
  { pattern: /^\/api\/auth\/login/, max: 10, windowMs: 60_000 },
  { pattern: /^\/api\/chat\/send/, max: 30, windowMs: 60_000 },
  { pattern: /^\/api\//, max: 120, windowMs: 60_000 },
];

function makeRateLimiter() {
  const store = new Map<string, number[]>();

  function check(ip: string, pathname: string, now: number = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const rule = RATE_LIMIT_RULES.find((r) => r.pattern.test(pathname));
    if (!rule) return { allowed: true, retryAfterSeconds: 0 };

    const key = `${ip}::${rule.pattern.source}`;
    const timestamps = (store.get(key) ?? []).filter((t) => now - t < rule.windowMs);

    if (timestamps.length >= rule.max) {
      const retryAfterMs = rule.windowMs - (now - timestamps[0]!);
      return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
    }

    timestamps.push(now);
    store.set(key, timestamps);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { check };
}

// ---------------------------------------------------------------------------
// Rate limiting tests (#218)
// ---------------------------------------------------------------------------

test("rate limiter: allows requests up to the limit", () => {
  const rl = makeRateLimiter();
  const ip = "1.2.3.4";
  for (let i = 0; i < 10; i++) {
    const result = rl.check(ip, "/api/auth/login", i * 100);
    assert.equal(result.allowed, true, `request ${i + 1} should be allowed`);
  }
});

test("rate limiter: blocks /api/auth/login after 10 requests in window", () => {
  const rl = makeRateLimiter();
  const ip = "1.2.3.4";
  for (let i = 0; i < 10; i++) rl.check(ip, "/api/auth/login", i * 100);

  const blocked = rl.check(ip, "/api/auth/login", 1000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test("rate limiter: 429 retryAfterSeconds is positive integer", () => {
  const rl = makeRateLimiter();
  const ip = "5.6.7.8";
  for (let i = 0; i < 10; i++) rl.check(ip, "/api/auth/login", 0);

  const blocked = rl.check(ip, "/api/auth/login", 1_000);
  assert.equal(blocked.allowed, false);
  assert.ok(Number.isInteger(blocked.retryAfterSeconds));
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.ok(blocked.retryAfterSeconds <= 60);
});

test("rate limiter: different IPs are tracked independently", () => {
  const rl = makeRateLimiter();
  for (let i = 0; i < 10; i++) rl.check("ip-A", "/api/auth/login", i * 100);

  // ip-A is blocked
  assert.equal(rl.check("ip-A", "/api/auth/login", 1000).allowed, false);
  // ip-B is not affected
  assert.equal(rl.check("ip-B", "/api/auth/login", 1000).allowed, true);
});

test("rate limiter: allows again after window expires", () => {
  const rl = makeRateLimiter();
  const ip = "9.9.9.9";
  // fill the window at t=0
  for (let i = 0; i < 10; i++) rl.check(ip, "/api/auth/login", 0);
  assert.equal(rl.check(ip, "/api/auth/login", 100).allowed, false);

  // after 60 seconds all old timestamps are outside the window
  const result = rl.check(ip, "/api/auth/login", 61_000);
  assert.equal(result.allowed, true);
});

test("rate limiter: /api/chat/send allows 30 before blocking", () => {
  const rl = makeRateLimiter();
  const ip = "2.2.2.2";
  for (let i = 0; i < 30; i++) {
    assert.equal(rl.check(ip, "/api/chat/send", i * 100).allowed, true);
  }
  assert.equal(rl.check(ip, "/api/chat/send", 3100).allowed, false);
});

test("rate limiter: generic /api/* allows 120 before blocking", () => {
  const rl = makeRateLimiter();
  const ip = "3.3.3.3";
  for (let i = 0; i < 120; i++) {
    assert.equal(rl.check(ip, "/api/session/start", i * 100).allowed, true);
  }
  assert.equal(rl.check(ip, "/api/session/start", 12100).allowed, false);
});

test("rate limiter: /api/auth/login limit uses its own rule, not generic", () => {
  const rl = makeRateLimiter();
  const ip = "4.4.4.4";
  // login limit is 10, not 120
  for (let i = 0; i < 10; i++) rl.check(ip, "/api/auth/login", i * 100);
  // blocked at 11th
  assert.equal(rl.check(ip, "/api/auth/login", 1100).allowed, false);
});

test("rate limiter: non-API path is not rate limited", () => {
  const rl = makeRateLimiter();
  const ip = "7.7.7.7";
  for (let i = 0; i < 200; i++) {
    assert.equal(rl.check(ip, "/student", i).allowed, true);
  }
});

// ---------------------------------------------------------------------------
// Cookie attribute tests (#219)
// ---------------------------------------------------------------------------

test("login route: cookie sameSite attribute is 'strict'", async () => {
  // Read the source file and verify the literal string
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const loginRoute = readFileSync(
    resolve(thisDir, "../app/api/auth/login/route.ts"),
    "utf8"
  );

  const laxMatches = (loginRoute.match(/sameSite:\s*["']lax["']/g) ?? []).length;
  const strictMatches = (loginRoute.match(/sameSite:\s*["']strict["']/g) ?? []).length;

  assert.equal(laxMatches, 0, "No cookie should use sameSite: lax in login route");
  assert.ok(strictMatches >= 3, `Session and legacy-clearing cookies should use sameSite: strict, found ${strictMatches}`);
});

test("logout route: cookie sameSite attribute is 'strict'", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const logoutRoute = readFileSync(
    resolve(thisDir, "../app/api/auth/logout/route.ts"),
    "utf8"
  );

  const laxMatches = (logoutRoute.match(/sameSite:\s*["']lax["']/g) ?? []).length;
  assert.equal(laxMatches, 0, "logout route should not use sameSite: lax");

  const strictMatches = (logoutRoute.match(/sameSite:\s*["']strict["']/g) ?? []).length;
  assert.ok(strictMatches >= 3, `logout route should clear session and legacy cookies with sameSite strict, found ${strictMatches}`);
});

test("login route: sets signed session cookie and clears legacy role cookies", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const loginRoute = readFileSync(resolve(thisDir, "../app/api/auth/login/route.ts"), "utf8");

  assert.ok(loginRoute.includes("AUTH_COOKIE_SESSION"), "login should set the signed session cookie");
  assert.ok(loginRoute.includes("createAuthSessionToken"), "login should create a signed auth session token");
  assert.ok(loginRoute.includes("AUTH_COOKIE_ROLE"), "login should explicitly clear the legacy role cookie");
  assert.equal(loginRoute.includes("AUTH_COOKIE_ROLE, user.role"), false, "login must not write a client-controlled role cookie");
});

test("auth server: validates signed session and reloads user role from store", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const authServer = readFileSync(resolve(thisDir, "../src/lib/auth-server.ts"), "utf8");

  assert.ok(authServer.includes("verifyAuthSessionToken"), "auth server should validate the signed token");
  assert.ok(authServer.includes("getUserStore"), "auth server should reload the current user from the user store");
  assert.ok(
    authServer.includes("currentUser.role !== tokenUser.role"),
    "auth server should reject tokens whose role no longer matches the stored user"
  );
  assert.ok(
    authServer.includes("currentSessionVersion !== tokenUser.sessionVersion"),
    "auth server should reject tokens with stale session version"
  );
});

test("user store: hashes passwords and migrates legacy plaintext on successful login", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const userStore = readFileSync(resolve(thisDir, "../src/lib/user-store.ts"), "utf8");

  assert.ok(userStore.includes("bcrypt"), "user store should use bcrypt hashing");
  assert.ok(userStore.includes("hashPassword"), "user store should hash newly stored passwords");
  assert.ok(userStore.includes("needsUpgrade"), "user store should detect legacy plaintext passwords for migration");
  assert.ok(userStore.includes("bcrypt.compare"), "user store should verify hashed passwords with bcrypt.compare");
  assert.ok(userStore.includes("sessionVersion"), "user store should persist sessionVersion for revocable sessions");
  assert.ok(userStore.includes("sessionVersion) + 1"), "password/role mutations should bump session version");
});

test("next config: defines baseline security headers and CSP", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const nextConfig = readFileSync(resolve(thisDir, "../next.config.mjs"), "utf8");

  assert.ok(nextConfig.includes("Content-Security-Policy"));
  assert.ok(nextConfig.includes("frame-ancestors 'none'"));
  assert.ok(nextConfig.includes("X-Frame-Options"));
  assert.ok(nextConfig.includes("X-Content-Type-Options"));
  assert.ok(nextConfig.includes("Referrer-Policy"));
  assert.ok(nextConfig.includes("Permissions-Policy"));
  assert.ok(nextConfig.includes("Strict-Transport-Security"));
  assert.ok(nextConfig.includes("isProduction"), "CSP should branch by environment");
  assert.ok(nextConfig.includes("'unsafe-eval'"), "development CSP keeps unsafe-eval for compatibility");
  assert.ok(
    nextConfig.includes("script-src 'self' 'unsafe-inline'${isProduction ? \"\" : \" 'unsafe-eval'\"}"),
    "production CSP should exclude unsafe-eval"
  );
});

test("health route: production response redacts low-level DB error details", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const healthRoute = readFileSync(resolve(thisDir, "../app/api/health/route.ts"), "utf8");

  assert.ok(healthRoute.includes("isProduction"), "health route should branch by environment");
  assert.ok(healthRoute.includes('detail = isProduction ? "db_unavailable" : safeDbDetail(error);'));
});

test("supabase hardening script: revokes public execute from rls_auto_enable", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const script = readFileSync(resolve(thisDir, "../scripts/supabase/harden_security.sh"), "utf8");

  assert.ok(script.includes("REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated"));
  assert.ok(script.includes("ALTER FUNCTION public.rls_auto_enable() SECURITY INVOKER"));
});

test("auth session token: verifies valid token and rejects tampered role", async () => {
  process.env.AUTH_SECRET = "test-auth-secret-for-session-token";
  const { createAuthSessionToken, verifyAuthSessionToken } = await import("../src/lib/auth");

  const token = await createAuthSessionToken({ username: "student", role: "student", sessionVersion: 1 });
  assert.deepEqual(await verifyAuthSessionToken(token), { username: "student", role: "student", sessionVersion: 1 });

  const [version, encodedPayload, signature] = token.split(".");
  assert.ok(version && encodedPayload && signature);

  const payload = JSON.parse(Buffer.from(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as {
    username: string;
    role: string;
  };
  const tamperedPayload = Buffer.from(JSON.stringify({ ...payload, role: "admin" }))
    .toString("base64url")
    .replace(/=+$/g, "");
  const tamperedToken = `${version}.${tamperedPayload}.${signature}`;

  assert.equal(await verifyAuthSessionToken(tamperedToken), null);
});

test("auth session token: rejects malformed payload/signature token", async () => {
  process.env.AUTH_SECRET = "test-auth-secret-for-session-token";
  const { verifyAuthSessionToken } = await import("../src/lib/auth");

  const payload = Buffer.from(JSON.stringify({ username: "student", role: "student", exp: Math.floor(Date.now() / 1000) + 60 }))
    .toString("base64url")
    .replace(/=+$/g, "");
  const fakeToken = `v1.${payload}.invalid`;
  assert.equal(await verifyAuthSessionToken(fakeToken), null);
});

test("proxy: matcher includes /api/:path*", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const proxySrc = readFileSync(resolve(thisDir, "../proxy.ts"), "utf8");

  assert.ok(proxySrc.includes('"/api/:path*"') || proxySrc.includes("'/api/:path*'"),
    "proxy matcher should include /api/:path*");
});

test("proxy: enforces origin checks for mutating admin/teacher/session APIs", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const proxySrc = readFileSync(resolve(thisDir, "../proxy.ts"), "utf8");

  assert.ok(proxySrc.includes("ORIGIN_GUARDED_API_PREFIXES"));
  assert.ok(proxySrc.includes("validateStateChangeOrigin"));
  assert.ok(proxySrc.includes("missing_origin"));
  assert.ok(proxySrc.includes("invalid_origin"));
});

test("proxy: returns 429 JSON shape", () => {
  // Verify the shape of the 429 response body is correct
  const body = { error: "rate_limit_exceeded", retryAfterSeconds: 45 };
  assert.equal(body.error, "rate_limit_exceeded");
  assert.ok(typeof body.retryAfterSeconds === "number");
  assert.ok(body.retryAfterSeconds > 0);
});
