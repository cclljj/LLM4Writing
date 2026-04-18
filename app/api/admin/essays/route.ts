import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { flushDomainState, getEssayPromptConfig, getEssays, hydrateDomainState, saveEssayPromptConfig, upsertEssay } from "@/src/lib/mock-data";
import { PromptConfig } from "@/src/lib/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await hydrateDomainState();
  const essays = getEssays().map((essay) => {
    const config = getEssayPromptConfig(essay.id);
    return {
      ...essay,
      step1Prompt: config.stepPrompts["1"] ?? "",
      subStep13Prompt: config.subStepPrompts["1-3"] ?? "",
      questionBank11: config.questionBanks["1-1"] ?? []
    };
  });

  return NextResponse.json({ essays });
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
    promptConfig?: PromptConfig;
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

  if (body.promptConfig) {
    saveEssayPromptConfig(saved.id, body.promptConfig);
  }
  await flushDomainState();

  const config = getEssayPromptConfig(saved.id);

  const savedWithPrompt = {
    ...saved,
    step1Prompt: config.stepPrompts["1"] ?? "",
    subStep13Prompt: config.subStepPrompts["1-3"] ?? "",
    questionBank11: config.questionBanks["1-1"] ?? []
  };

  return NextResponse.json({ saved: savedWithPrompt });
}
