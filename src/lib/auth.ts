export type AuthRole = "student" | "teacher";

export interface AuthUser {
  username: string;
  role: AuthRole;
}

const DEFAULT_STUDENT_USER = process.env.DEFAULT_STUDENT_USER ?? "student";
const DEFAULT_STUDENT_PASS = process.env.DEFAULT_STUDENT_PASS ?? "student123";
const DEFAULT_TEACHER_USER = process.env.DEFAULT_TEACHER_USER ?? "teacher";
const DEFAULT_TEACHER_PASS = process.env.DEFAULT_TEACHER_PASS ?? "teacher123";

export function validateCredential(username: string, password: string): AuthUser | undefined {
  if (username === DEFAULT_STUDENT_USER && password === DEFAULT_STUDENT_PASS) {
    return { username, role: "student" };
  }

  if (username === DEFAULT_TEACHER_USER && password === DEFAULT_TEACHER_PASS) {
    return { username, role: "teacher" };
  }

  return undefined;
}

export const AUTH_COOKIE_USER = "llm4w_user";
export const AUTH_COOKIE_ROLE = "llm4w_role";
