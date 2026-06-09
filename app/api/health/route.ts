import { NextResponse } from "next/server";
import { getStorageMode } from "@/src/lib/store";
import { getDatabaseUrl, isDatabaseEnabled } from "@/src/lib/db-config";
import { safeErrorDetail } from "@/src/lib/error-redaction";
import postgres from "postgres";

export async function GET() {
  const isProduction = process.env.NODE_ENV === "production";
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
      detail = isProduction ? "db_unavailable" : safeErrorDetail(error, 220);
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
