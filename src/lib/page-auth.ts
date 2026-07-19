import { redirect } from "next/navigation";
import type { AuthUser } from "@/src/lib/auth";
import { getCurrentUser } from "@/src/lib/auth-server";
import { resolveProtectedPageRedirect, type ProtectedPageArea } from "@/src/lib/page-access";

export async function requireProtectedPage(area: ProtectedPageArea): Promise<AuthUser> {
  const user = await getCurrentUser();
  const redirectTarget = resolveProtectedPageRedirect(user, area);
  if (redirectTarget) redirect(redirectTarget);
  return user!;
}
