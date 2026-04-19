import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import systemPromptConfig from "@/src/config/system-prompt-config.json";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ config: systemPromptConfig });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ error: "prompt_config_readonly_use_filesystem_json" }, { status: 400 });
}
