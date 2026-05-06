import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import systemPromptConfig from "@/src/config/system-prompt-config.json";
import { listSessions } from "@/src/lib/store";

function readEnvFlag(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function countRecord(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.keys(value).length;
}

function countWritingTaskQuestionBanks(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.values(value as Record<string, unknown>).reduce<number>((sum, task) => {
    if (!task || typeof task !== "object" || Array.isArray(task)) return sum;
    const questionBanks = (task as Record<string, unknown>).questionBanks;
    return sum + countRecord(questionBanks);
  }, 0);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const config = systemPromptConfig as Record<string, unknown>;
  const sessions = await listSessions();
  const specSessions = sessions.filter((session) => session.workflow === "spec10");
  const recentSessions = specSessions
    .slice()
    .sort((a, b) => {
      const aLast = a.messages.at(-1)?.at ?? a.createdAt;
      const bLast = b.messages.at(-1)?.at ?? b.createdAt;
      return bLast.localeCompare(aLast);
    })
    .slice(0, 5)
    .map((session) => ({
      sessionId: session.id,
      activityTitle: session.activityTitle ?? session.activityId ?? "未命名課程",
      groupName: session.groupName ?? session.groupId ?? "未命名組",
      currentStep: session.currentStep,
      participantCount: session.participants.length,
      messageCount: session.messages.length,
      lastMessageAt: session.messages.at(-1)?.at ?? session.createdAt
    }));

  const llm = {
    configured: readEnvFlag("LLM_URL") && (readEnvFlag("LLM_KEY") || readEnvFlag("LLM_key")) && readEnvFlag("LLM_MODEL"),
    urlPresent: readEnvFlag("LLM_URL"),
    keyPresent: readEnvFlag("LLM_KEY") || readEnvFlag("LLM_key"),
    modelPresent: readEnvFlag("LLM_MODEL"),
    model: readEnvFlag("LLM_MODEL") ? process.env.LLM_MODEL : null
  };

  return NextResponse.json({
    llm,
    promptConfig: {
      hasSystemPrompt: typeof config.systemPrompt === "string" && config.systemPrompt.trim().length > 0,
      stepPrompts: countRecord(config.stepPrompts),
      stepPromptsOld: countRecord(config.stepPrompts_old),
      subStepPrompts: countRecord(config.subStepPrompts),
      subStepPromptsFallbacks: countRecord(config.subStepPrompts_fallbacks),
      baseQuestionBanks: countRecord(config.questionBanks),
      writingTaskQuestionBanks: countWritingTaskQuestionBanks(config.writingTasks),
      writingTasks: countRecord(config.writingTasks),
      step9Questions: countRecord(config.step9Questions),
      stepOpenings: countRecord(config.stepOpenings)
    },
    sessions: {
      total: sessions.length,
      spec10: specSessions.length,
      recent: recentSessions
    },
    generatedAt: new Date().toISOString()
  });
}
