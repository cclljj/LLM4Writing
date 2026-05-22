import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import type { AuthUser } from "@/src/lib/auth";
import { getSession } from "@/src/lib/store";
import { markUserOnline } from "@/src/lib/session-presence";
import type { SessionState } from "@/src/lib/types";

// #388: Maximum character length for student text input.
// Prevents oversized payloads from consuming excessive LLM tokens or causing OOM.
export const STUDENT_TEXT_MAX_LENGTH = 10_000;

export type StudentSession = {
  user: AuthUser;
  session: SessionState;
};

/**
 * Validates the common preamble shared by all student step routes:
 *   - caller is a logged-in student
 *   - sessionId is provided
 *   - session exists
 *   - caller is a session participant
 *   - marks caller online
 *
 * Returns { user, session } on success, or a NextResponse error on failure.
 */
export async function requireStudentInSession(
  sessionId: string | undefined
): Promise<StudentSession | NextResponse> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!sessionId) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (!session.participants.includes(user.username)) {
    return NextResponse.json({ error: "not_participant" }, { status: 403 });
  }
  await markUserOnline(session.id, user.username);
  return { user, session };
}

/**
 * #388: Validate a student-submitted text field.
 * Returns a NextResponse error if the value is not a non-empty string within
 * the allowed length, or null if the value is acceptable.
 */
export function validateTextInput(
  value: unknown,
  fieldName = "text"
): NextResponse | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return NextResponse.json({ error: "missing_required_fields", field: fieldName }, { status: 400 });
  }
  if (value.length > STUDENT_TEXT_MAX_LENGTH) {
    return NextResponse.json(
      { error: "input_too_long", field: fieldName, maxLength: STUDENT_TEXT_MAX_LENGTH },
      { status: 400 }
    );
  }
  return null;
}
