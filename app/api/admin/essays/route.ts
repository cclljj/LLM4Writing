import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getEssays, upsertEssay } from "@/src/lib/mock-data";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ essays: getEssays() });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

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

  return NextResponse.json({ saved });
}
