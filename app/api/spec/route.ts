import { NextResponse } from "next/server";
import { getDefaultStep9Questions } from "@/src/lib/spec";
import { resolveDefaultCourseWorkflowSteps } from "@/src/lib/prompt-config";

export async function GET() {
  return NextResponse.json({
    steps: resolveDefaultCourseWorkflowSteps(),
    reflectionQuestions: getDefaultStep9Questions()
  });
}
