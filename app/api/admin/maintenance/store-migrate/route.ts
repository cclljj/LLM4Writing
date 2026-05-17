import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { ensureSessionTable, getSessionStoreTableHealth } from "@/src/lib/store";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await ensureSessionTable();
    const health = await getSessionStoreTableHealth();
    return NextResponse.json({ ok: true, migratedAt: new Date().toISOString(), ...health });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "store_migration_failed"
      },
      { status: 500 }
    );
  }
}
