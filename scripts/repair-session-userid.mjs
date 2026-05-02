import postgres from "postgres";

const [sessionId, wrongUserId, correctUserId] = process.argv.slice(2);

if (!sessionId || !wrongUserId || !correctUserId) {
  console.error("Usage: node scripts/repair-session-userid.mjs <sessionId> <wrongUserId> <correctUserId>");
  process.exit(1);
}

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Missing DB URL. Set SUPABASE_DB_URL (preferred) or POSTGRES_URL/DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(dbUrl, { prepare: false, max: 1 });

function dedupe(values) {
  return Array.from(new Set(values.filter((item) => typeof item === "string" && item.trim().length > 0)));
}

try {
  const rows = await sql`
    SELECT payload
    FROM llm4writing_sessions
    WHERE id = ${sessionId}
    LIMIT 1
  `;

  if (!rows[0]) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(2);
  }

  const session = typeof rows[0].payload === "string" ? JSON.parse(rows[0].payload) : rows[0].payload;

  session.messages = (session.messages ?? []).map((message) => {
    if (message?.role === "student" && message.userId === wrongUserId) {
      return { ...message, userId: correctUserId };
    }
    return message;
  });

  const participants = dedupe((session.participants ?? []).map((userId) => (userId === wrongUserId ? correctUserId : userId)));
  session.participants = participants;

  if (Array.isArray(session.joinedUsers)) {
    session.joinedUsers = dedupe(session.joinedUsers.map((userId) => (userId === wrongUserId ? correctUserId : userId)));
  }

  if (session.groupGate && typeof session.groupGate === "object") {
    const nextGate = {};
    for (const [key, users] of Object.entries(session.groupGate)) {
      nextGate[key] = dedupe((users ?? []).map((userId) => (userId === wrongUserId ? correctUserId : userId)));
    }
    session.groupGate = nextGate;
  }

  await sql`
    UPDATE llm4writing_sessions
    SET payload = ${JSON.stringify(session)}::jsonb,
        updated_at = NOW()
    WHERE id = ${sessionId}
  `;

  console.log(`Session repaired: ${sessionId}`);
  console.log(`Replaced userId ${wrongUserId} -> ${correctUserId}`);
} finally {
  await sql.end({ timeout: 5 });
}
