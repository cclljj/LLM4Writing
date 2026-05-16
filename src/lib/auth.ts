import { validateUserCredentialStore } from "@/src/lib/user-store";

export type AuthRole = "student" | "teacher" | "admin";

export interface AuthUser {
  username: string;
  role: AuthRole;
}

export interface AuthSessionClaims extends AuthUser {
  sessionVersion: number;
}

type AuthTokenPayload = {
  username: string;
  role: AuthRole;
  sessionVersion: number;
  exp: number;
  nonce: string;
};

const AUTH_TOKEN_VERSION = "v1";
const AUTH_SESSION_TTL_SECONDS = 60 * 60 * 12;

function normalizeSessionVersion(input: unknown): number {
  if (typeof input !== "number" || !Number.isFinite(input)) return 1;
  const asInt = Math.trunc(input);
  return asInt > 0 ? asInt : 1;
}

export async function validateCredential(username: string, password: string): Promise<AuthSessionClaims | undefined> {
  const user = await validateUserCredentialStore(username, password);
  if (!user) {
    return undefined;
  }

  return {
    username: user.username,
    role: user.role,
    sessionVersion: normalizeSessionVersion(user.sessionVersion)
  };
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("auth_secret_missing");
  }
  return "llm4writing-dev-auth-secret-change-me";
}

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmacSha256(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqualString(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i]! ^ bBytes[i]!;
  }
  return diff === 0;
}

function isAuthRole(role: unknown): role is AuthRole {
  return role === "student" || role === "teacher" || role === "admin";
}

export async function createAuthSessionToken(user: AuthSessionClaims, nowMs = Date.now()): Promise<string> {
  const payload: AuthTokenPayload = {
    username: user.username,
    role: user.role,
    sessionVersion: normalizeSessionVersion(user.sessionVersion),
    exp: Math.floor(nowMs / 1000) + AUTH_SESSION_TTL_SECONDS,
    nonce: crypto.randomUUID()
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256(`${AUTH_TOKEN_VERSION}.${encoded}`);
  return `${AUTH_TOKEN_VERSION}.${encoded}.${signature}`;
}

export async function verifyAuthSessionToken(token: string, nowMs = Date.now()): Promise<AuthSessionClaims | null> {
  const [version, encoded, signature, extra] = token.split(".");
  if (version !== AUTH_TOKEN_VERSION || !encoded || !signature || extra !== undefined) return null;

  const expectedSignature = await hmacSha256(`${version}.${encoded}`);
  if (!timingSafeEqualString(signature, expectedSignature)) return null;

  let payload: Partial<AuthTokenPayload>;
  try {
    payload = JSON.parse(base64UrlDecode(encoded)) as Partial<AuthTokenPayload>;
  } catch {
    return null;
  }

  if (!payload.username || !isAuthRole(payload.role)) return null;
  if (!Number.isFinite(payload.sessionVersion)) return null;
  if (!Number.isFinite(payload.exp) || payload.exp! <= Math.floor(nowMs / 1000)) return null;
  return {
    username: payload.username,
    role: payload.role,
    sessionVersion: normalizeSessionVersion(payload.sessionVersion)
  };
}

export const AUTH_COOKIE_SESSION = "llm4w_session";
export const AUTH_COOKIE_USER = "llm4w_user";
export const AUTH_COOKIE_ROLE = "llm4w_role";
export const AUTH_SESSION_MAX_AGE = AUTH_SESSION_TTL_SECONDS;
