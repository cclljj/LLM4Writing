import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import {
  flushDomainState,
  getOpenClasses,
  hydrateDomainState,
  upsertOpenClass
} from "@/src/lib/activity-store";
import { getUserStore, getUsersVisibleToTeacherStore, listUsersStore } from "@/src/lib/user-store";
import { listSessions } from "@/src/lib/store";

/**
 * Returns a Set of activityIds that already have at least one student message (#254).
 * Used by the openClasses GET to compute `hasStudentActivity` per task so the UI
 * can decide whether to show the delete button.
 */
async function computeActivityIdsWithStudentActivity(): Promise<Set<string>> {
  const sessions = await listSessions().catch(() => []);
  const ids = new Set<string>();
  for (const s of sessions) {
    if (!s.activityId) continue;
    if (ids.has(s.activityId)) continue;
    if (s.messages.some((m) => m.role === "student")) {
      ids.add(s.activityId);
    }
  }
  return ids;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();

  const allOpenClasses = getOpenClasses();
  const activityIdsWithActivity = await computeActivityIdsWithStudentActivity();

  let visibleOpenClasses = allOpenClasses;
  if (user.role === "teacher") {
    const visibleUsers = await getUsersVisibleToTeacherStore(user.username);
    const visibleStudents = visibleUsers.filter((item) => item.role === "student");
    const visibleClasses = new Set(visibleStudents.map((student) => `${student.school}::${student.classNumber ?? ""}`));
    visibleOpenClasses = allOpenClasses.filter((openClass) => visibleClasses.has(`${openClass.school}::${openClass.classNumber}`));
  }

  const enriched = visibleOpenClasses.map((openClass) => ({
    ...openClass,
    hasStudentActivity: activityIdsWithActivity.has(openClass.id)
  }));

  return NextResponse.json({ openClasses: enriched });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  const body = (await request.json()) as {
    id?: string;
    classNumber?: string;
    essayId?: string;
    school?: string;
    durationMinutes?: number;
    supplemental?: string;
    ownerTeacherUsername?: string;
  };

  if (!body.classNumber || !body.essayId || !body.durationMinutes || body.supplemental === undefined) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const profile = await getUserStore(user.username);
  if (!profile) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const classNumber = body.classNumber.trim();
  if (!classNumber) {
    return NextResponse.json({ error: "missing_class_number" }, { status: 400 });
  }

  if (user.role === "teacher") {
    const visibleUsers = await getUsersVisibleToTeacherStore(user.username);
    const allowedClassNumbers = new Set(
      visibleUsers
        .filter((item) => item.role === "student")
        .map((item) => item.classNumber)
        .filter((value): value is string => Boolean(value))
    );
    if (!allowedClassNumbers.has(classNumber)) {
      return NextResponse.json({ error: "class_not_in_teacher_scope" }, { status: 403 });
    }
  }

  // Resolve ownerTeacherUsername (#254): teacher → self; admin → from body or auto-derive.
  const targetSchool = user.role === "teacher" ? profile.school : (body.school ?? profile.school).trim();
  let ownerTeacherUsername: string | undefined;
  if (user.role === "teacher") {
    ownerTeacherUsername = user.username;
  } else if (typeof body.ownerTeacherUsername === "string" && body.ownerTeacherUsername.trim()) {
    ownerTeacherUsername = body.ownerTeacherUsername.trim();
  } else {
    // Auto-derive from the most common ownerTeacherUsername among that class's students.
    const allUsers = await listUsersStore();
    const classStudents = allUsers.filter(
      (u) => u.role === "student" && u.school === targetSchool && u.classNumber === classNumber
    );
    const counts = new Map<string, number>();
    for (const s of classStudents) {
      const t = s.ownerTeacherUsername;
      if (!t) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    let best: string | undefined;
    let bestCount = 0;
    for (const [t, c] of counts) {
      if (c > bestCount) {
        best = t;
        bestCount = c;
      }
    }
    ownerTeacherUsername = best;
  }

  const saved = upsertOpenClass({
    id: body.id,
    school: targetSchool,
    classNumber,
    essayId: body.essayId,
    durationMinutes: body.durationMinutes,
    supplemental: body.supplemental,
    ownerTeacherUsername
  });
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 400 });
  }

  await flushDomainState();

  return NextResponse.json({ saved: saved.saved });
}
