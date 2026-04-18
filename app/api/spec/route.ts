import { NextResponse } from "next/server";
import { REFLECTION_QUESTIONS, STEP_DEFINITIONS } from "@/src/lib/spec";

export async function GET() {
  return NextResponse.json({
    steps: STEP_DEFINITIONS,
    reflectionQuestions: REFLECTION_QUESTIONS
  });
}
