import { NextResponse } from "next/server";
import { getDefaultStep9Questions, STEP_DEFINITIONS } from "@/src/lib/spec";

export async function GET() {
  return NextResponse.json({
    steps: STEP_DEFINITIONS,
    reflectionQuestions: getDefaultStep9Questions()
  });
}
