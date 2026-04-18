import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import {
  createUserAccount,
  deleteUserAccount,
  getUsers,
  resetUserPassword,
  updateUserAccount
} from "@/src/lib/mock-data";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ users: getUsers() });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    action?: "create" | "reset_password" | "bulk_create_from_csv";
    username?: string;
    newPassword?: string;
    user?: { username?: string; name?: string; school?: string; role?: string; password?: string };
    csv?: string;
  };

  if ("username" in body && "newPassword" in body && !("action" in body)) {
    if (!body.username || !body.newPassword) {
      return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
    }
    const ok = resetUserPassword(body.username, body.newPassword);
    if (!ok) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reset_password") {
    if (!body.username || !body.newPassword) {
      return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
    }
    const ok = resetUserPassword(body.username, body.newPassword);
    if (!ok) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create") {
    const userInput = body.user;
    if (!userInput) {
      return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
    }
    const checked = validateUserFields(userInput);
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }

    const result = createUserAccount(checked.user);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "bulk_create_from_csv") {
    if (!body.csv) {
      return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
    }

    const parsed = parseUserCsv(body.csv);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const existing = new Set(getUsers().map((item) => item.username));
    const seenInFile = new Set<string>();
    const errors: Array<{ line: number; message: string }> = [];
    const validRows: Array<{ username: string; name: string; school: string; role: "student" | "teacher"; password: string }> = [];

    parsed.rows.forEach((row) => {
      const checked = validateUserFields(row.values);
      if (!checked.ok) {
        errors.push({ line: row.line, message: checked.error });
        return;
      }
      if (existing.has(checked.user.username)) {
        errors.push({ line: row.line, message: `username_exists:${checked.user.username}` });
        return;
      }
      if (seenInFile.has(checked.user.username)) {
        errors.push({ line: row.line, message: `duplicated_username_in_csv:${checked.user.username}` });
        return;
      }
      seenInFile.add(checked.user.username);
      validRows.push(checked.user);
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: "csv_validation_failed", details: errors }, { status: 400 });
    }

    validRows.forEach((newUser) => {
      createUserAccount(newUser);
    });
    return NextResponse.json({ ok: true, createdCount: validRows.length });
  }

  return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    username?: string;
    patch?: { name?: string; school?: string; role?: string; password?: string };
  };
  if (!body.username || !body.patch) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const patch: { name?: string; school?: string; role?: "student" | "teacher"; password?: string } = {};
  if (body.patch.name !== undefined) patch.name = body.patch.name.trim();
  if (body.patch.school !== undefined) patch.school = body.patch.school.trim();
  if (body.patch.password !== undefined) patch.password = body.patch.password;
  if (body.patch.role !== undefined) {
    if (!isValidRole(body.patch.role)) {
      return NextResponse.json({ error: "invalid_role" }, { status: 400 });
    }
    patch.role = body.patch.role;
  }

  if (body.username === user.username && patch.role && patch.role !== "teacher") {
    return NextResponse.json({ error: "cannot_downgrade_self_role" }, { status: 400 });
  }

  const result = updateUserAccount(body.username, patch);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { username?: string };
  if (!body.username) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }
  if (body.username === user.username) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });
  }

  const result = deleteUserAccount(body.username);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

function isValidRole(role: string): role is "student" | "teacher" {
  return role === "student" || role === "teacher";
}

function validateUserFields(input: {
  username?: string;
  name?: string;
  school?: string;
  role?: string;
  password?: string;
}):
  | { ok: true; user: { username: string; name: string; school: string; role: "student" | "teacher"; password: string } }
  | { ok: false; error: string } {
  const username = (input.username ?? "").trim();
  const name = (input.name ?? "").trim();
  const school = (input.school ?? "").trim();
  const role = (input.role ?? "").trim();
  const password = input.password ?? "";

  if (!username || !name || !school || !role || !password) {
    return { ok: false, error: "missing_required_fields" };
  }
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
    return { ok: false, error: "invalid_username_format" };
  }
  if (!isValidRole(role)) {
    return { ok: false, error: "invalid_role" };
  }
  if (password.length < 6) {
    return { ok: false, error: "password_too_short" };
  }

  return {
    ok: true,
    user: { username, name, school, role, password }
  };
}

function parseUserCsv(csvText: string):
  | {
      ok: true;
      rows: Array<{
        line: number;
        values: { username?: string; name?: string; school?: string; role?: string; password?: string };
      }>;
    }
  | { ok: false; error: string } {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { ok: false, error: "csv_empty" };
  }

  let startIndex = 0;
  const header = splitCsvLine(lines[0]!);
  const normalizedHeader = header.map((h) => h.toLowerCase());
  const headerMatches =
    normalizedHeader.join(",") === "username,name,school,role,password" ||
    header.join(",") === "帳號,姓名,學校,角色,密碼";
  if (headerMatches) {
    startIndex = 1;
  }

  const rows: Array<{
    line: number;
    values: { username?: string; name?: string; school?: string; role?: string; password?: string };
  }> = [];

  for (let idx = startIndex; idx < lines.length; idx += 1) {
    const cells = splitCsvLine(lines[idx]!);
    if (cells.length !== 5) {
      return { ok: false, error: `csv_invalid_column_count_line_${idx + 1}` };
    }
    rows.push({
      line: idx + 1,
      values: {
        username: cells[0],
        name: cells[1],
        school: cells[2],
        role: cells[3],
        password: cells[4]
      }
    });
  }

  if (rows.length === 0) {
    return { ok: false, error: "csv_no_data_rows" };
  }
  return { ok: true, rows };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}
