import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { flushDomainState, getEssayPromptConfig, hydrateDomainState, saveEssayPromptConfig } from "@/src/lib/mock-data";
import { PromptConfig } from "@/src/lib/types";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  const essayId = request.nextUrl.searchParams.get("essayId") ?? "";
  if (!essayId) {
    return NextResponse.json({ error: "essayId_required" }, { status: 400 });
  }

  return NextResponse.json({ config: getEssayPromptConfig(essayId) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  const body = (await request.json()) as { essayId?: string; config?: PromptConfig };
  if (!body.essayId || !body.config) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const saved = saveEssayPromptConfig(body.essayId, body.config);
  await flushDomainState();
  return NextResponse.json({ saved });
}
