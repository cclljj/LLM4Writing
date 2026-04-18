import { cookies } from "next/headers";
import { AUTH_COOKIE_ROLE, AUTH_COOKIE_USER, AuthRole, AuthUser } from "@/src/lib/auth";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const username = store.get(AUTH_COOKIE_USER)?.value;
  const roleValue = store.get(AUTH_COOKIE_ROLE)?.value;

  if (!username || (roleValue !== "student" && roleValue !== "teacher" && roleValue !== "admin")) {
    return null;
  }

  return { username, role: roleValue as AuthRole };
}
