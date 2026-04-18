import { validateUserCredentialStore } from "@/src/lib/user-store";

export type AuthRole = "student" | "teacher" | "admin";

export interface AuthUser {
  username: string;
  role: AuthRole;
}

export async function validateCredential(username: string, password: string): Promise<AuthUser | undefined> {
  const user = await validateUserCredentialStore(username, password);
  if (!user) {
    return undefined;
  }

  return { username: user.username, role: user.role };
}

export const AUTH_COOKIE_USER = "llm4w_user";
export const AUTH_COOKIE_ROLE = "llm4w_role";
