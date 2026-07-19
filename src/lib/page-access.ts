import type { AuthUser } from "@/src/lib/auth";

export type ProtectedPageArea = "student" | "teacher" | "admin";

export function resolveProtectedPageRedirect(user: AuthUser | null, area: ProtectedPageArea): string | null {
  if (!user) return "/login";

  if (area === "student") {
    if (user.role === "student") return null;
    return user.role === "admin" ? "/admin" : "/teacher";
  }

  if (area === "teacher") {
    return user.role === "student" ? "/student" : null;
  }

  if (user.role === "admin") return null;
  return user.role === "student" ? "/student" : "/teacher";
}
