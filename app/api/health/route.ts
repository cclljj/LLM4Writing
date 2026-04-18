import { NextResponse } from "next/server";
import { getStorageMode } from "@/src/lib/store";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "llm4writing-vercel-native",
    storage: getStorageMode(),
    ts: new Date().toISOString()
  });
}
