import { NextResponse } from "next/server";
import { getStorageMode } from "@/src/lib/store";
import { getDatabaseUrl, isDatabaseEnabled } from "@/src/lib/db-config";
import postgres from "postgres";

function safeDbDetail(error: unknown): string {
  if (!error) return "unknown";
  if (error instanceof Error) {
    return (error.message || "error")
      .replace(/postgres:\/\/[^\\s]+/gi, "postgres://[redacted]")
      .slice(0, 220);
  }
  if (typeof error === "string") return error.slice(0, 220);
  return "unknown";
}

export async function GET() {
  const enabled = isDatabaseEnabled();
  let ok = false;
  let detail: string | null = null;
  if (enabled) {
    try {
      const url = getDatabaseUrl();
      if (url) {
        const sql = postgres(url, { max: 1, idle_timeout: 2, connect_timeout: 3, prepare: false });
        await sql`select 1 as ok`;
        await sql.end({ timeout: 1 });
        ok = true;
      }
    } catch (error) {
      ok = false;
      detail = safeDbDetail(error);
    }
  }
  return NextResponse.json({
    ok: true,
    service: "llm4writing-vercel-native",
    storage: getStorageMode(),
    db: { enabled, ok, detail },
    ts: new Date().toISOString()
  });
}
