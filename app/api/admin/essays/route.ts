import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { flushDomainState, getEssays, hydrateDomainState, upsertEssay } from "@/src/lib/activity-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  return NextResponse.json({ essays: getEssays() });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  const body = (await request.json()) as {
    id?: string;
    title?: string;
    genre?: string;
    description?: string;
    enabled?: boolean;
  };

  if (!body.title || !body.genre || !body.description) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const saved = upsertEssay({
    id: body.id,
    title: body.title,
    genre: body.genre,
    description: body.description,
    enabled: body.enabled ?? true
  });

  await flushDomainState();
  return NextResponse.json({ saved });
}
