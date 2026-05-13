import { cookies } from "next/headers";
import { AUTH_COOKIE_SESSION, AuthUser, verifyAuthSessionToken } from "@/src/lib/auth";
import { getUserStore } from "@/src/lib/user-store";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_SESSION)?.value;
  if (!token) return null;

  const tokenUser = await verifyAuthSessionToken(token);
  if (!tokenUser) return null;

  const currentUser = await getUserStore(tokenUser.username);
  if (!currentUser || currentUser.role !== tokenUser.role) return null;
  return { username: currentUser.username, role: currentUser.role };
}
