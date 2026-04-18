import { validateUserCredential } from "@/src/lib/mock-data";

export type AuthRole = "student" | "teacher";

export interface AuthUser {
  username: string;
  role: AuthRole;
}

export function validateCredential(username: string, password: string): AuthUser | undefined {
  const user = validateUserCredential(username, password);
  if (!user) {
    return undefined;
  }

  return { username: user.username, role: user.role };
}

export const AUTH_COOKIE_USER = "llm4w_user";
export const AUTH_COOKIE_ROLE = "llm4w_role";
