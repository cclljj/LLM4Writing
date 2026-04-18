import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getOpenClasses, upsertOpenClass } from "@/src/lib/mock-data";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ openClasses: getOpenClasses() });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    className?: string;
    essayTitle?: string;
    durationMinutes?: number;
    supplemental?: string;
  };

  if (!body.className || !body.essayTitle || !body.durationMinutes || body.supplemental === undefined) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const saved = upsertOpenClass({
    id: body.id,
    className: body.className,
    essayTitle: body.essayTitle,
    durationMinutes: body.durationMinutes,
    supplemental: body.supplemental
  });

  return NextResponse.json({ saved });
}
