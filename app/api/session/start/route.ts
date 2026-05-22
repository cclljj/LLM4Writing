import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/src/lib/engine";
import { saveSession } from "@/src/lib/store";
import { StartSessionPayload } from "@/src/lib/types";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";

export async function POST(request: NextRequest) {
  // #383: Require teacher or admin role — prevents unauthenticated session creation
  // and LLM prompt injection via malicious promptConfig.
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as StartSessionPayload;
  const participants = Array.from(
    new Set(
      (payload.participants ?? [])
        .map((participant) => participant.trim())
        .filter(Boolean)
    )
  );

  if (participants.length === 0) {
    return NextResponse.json({ error: "participants_required" }, { status: 400 });
  }
  const visibleUsers = user.role === "admin"
    ? await listUsersStore()
    : await getUsersVisibleToTeacherStore(user.username);
  const allowedStudents = new Set(
    visibleUsers
      .filter((visibleUser) => visibleUser.role === "student")
      .map((visibleStudent) => visibleStudent.username)
  );
  const invalidParticipants = participants.filter((participant) => !allowedStudents.has(participant));
  if (invalidParticipants.length > 0) {
    return NextResponse.json(
      { error: "invalid_participants_scope", participants: invalidParticipants },
      { status: 403 }
    );
  }

  const session = createSession({ ...payload, participants });
  await saveSession(session);

  return NextResponse.json(session, { status: 201 });
}
