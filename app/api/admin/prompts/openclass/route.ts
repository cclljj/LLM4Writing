import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getOpenClassPromptConfig, saveOpenClassPromptConfig } from "@/src/lib/mock-data";
import { PromptConfig } from "@/src/lib/types";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const openClassId = request.nextUrl.searchParams.get("openClassId") ?? "";
  if (!openClassId) {
    return NextResponse.json({ error: "openClassId_required" }, { status: 400 });
  }

  return NextResponse.json({ config: getOpenClassPromptConfig(openClassId) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { openClassId?: string; config?: PromptConfig };
  if (!body.openClassId || !body.config) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const saved = saveOpenClassPromptConfig(body.openClassId, body.config);
  return NextResponse.json({ saved });
}
