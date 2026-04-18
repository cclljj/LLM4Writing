import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import {
  getOpenClasses,
  saveOpenClassPromptConfig,
  upsertOpenClass
} from "@/src/lib/mock-data";
import { PromptConfig } from "@/src/lib/types";
import { getUserStore, getUsersVisibleToTeacherStore } from "@/src/lib/user-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (user.role === "admin") {
    return NextResponse.json({ openClasses: getOpenClasses() });
  }

  const visibleUsers = await getUsersVisibleToTeacherStore(user.username);
  const visibleStudents = visibleUsers.filter((item) => item.role === "student");
  const visibleClasses = new Set(visibleStudents.map((student) => `${student.school}::${student.classNumber ?? ""}`));
  const openClasses = getOpenClasses().filter((openClass) => visibleClasses.has(`${openClass.school}::${openClass.classNumber}`));

  return NextResponse.json({ openClasses });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    classNumber?: string;
    essayId?: string;
    school?: string;
    durationMinutes?: number;
    supplemental?: string;
    promptOverride?: PromptConfig;
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

  const saved = upsertOpenClass({
    id: body.id,
    school: user.role === "teacher" ? profile.school : (body.school ?? profile.school).trim(),
    classNumber,
    essayId: body.essayId,
    durationMinutes: body.durationMinutes,
    supplemental: body.supplemental
  });
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 400 });
  }

  if (body.promptOverride) {
    saveOpenClassPromptConfig(saved.saved.id, body.promptOverride);
  }

  return NextResponse.json({ saved: saved.saved });
}
