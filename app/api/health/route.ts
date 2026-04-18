import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "llm4writing-vercel-native",
    ts: new Date().toISOString()
  });
}
