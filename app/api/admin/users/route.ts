import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import {
  createUserAccount,
  deleteUserAccount,
  getTeacherUsers,
  getUser,
  getUsers,
  getUsersVisibleToTeacher,
  resetUserPassword,
  updateUserAccount
} from "@/src/lib/mock-data";
import { AuthUser } from "@/src/lib/auth";
import { UserAccount } from "@/src/lib/types";

type ManageRole = "student" | "teacher" | "admin";

type UserInput = {
  username?: string;
  name?: string;
  school?: string;
  role?: string;
  password?: string;
  ownerTeacherUsername?: string;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (user.role === "admin") {
    return NextResponse.json({ users: getUsers() });
  }

  return NextResponse.json({ users: getUsersVisibleToTeacher(user.username) });
}

export async function POST(request: NextRequest) {
  const requester = await getCurrentUser();
  if (!requester || (requester.role !== "teacher" && requester.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    action?: "create" | "reset_password" | "bulk_create_from_csv";
    username?: string;
    newPassword?: string;
    user?: UserInput;
    csv?: string;
  };

  if (body.action === "reset_password" || (!body.action && body.username && body.newPassword)) {
    if (!body.username || !body.newPassword) {
      return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
    }
    if (body.newPassword.length < 6) {
      return NextResponse.json({ error: "password_too_short" }, { status: 400 });
    }

    const target = getUser(body.username);
    if (!target) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    if (!canManageTarget(requester, target)) {
      return NextResponse.json({ error: "forbidden_target" }, { status: 403 });
    }

    const ok = resetUserPassword(body.username, body.newPassword);
    if (!ok) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create") {
    if (!body.user) {
      return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
    }

    const checked = validateUserFields(body.user);
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }

    if (requester.role === "teacher") {
      if (checked.user.role !== "student") {
        return NextResponse.json({ error: "teacher_can_only_create_students" }, { status: 403 });
      }
      checked.user.ownerTeacherUsername = requester.username;
    }

    if (requester.role === "admin") {
      if (checked.user.role === "admin") {
        return NextResponse.json({ error: "cannot_create_admin_account" }, { status: 403 });
      }
      if (checked.user.role === "student" && !checked.user.ownerTeacherUsername) {
        return NextResponse.json({ error: "missing_owner_teacher" }, { status: 400 });
      }
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
    const validRows: Array<{
      username: string;
      name: string;
      school: string;
      role: "student" | "teacher" | "admin";
      password: string;
      ownerTeacherUsername?: string;
    }> = [];

    parsed.rows.forEach((row) => {
      const checked = validateUserFields(row.values);
      if (!checked.ok) {
        errors.push({ line: row.line, message: checked.error });
        return;
      }

      if (requester.role === "teacher") {
        if (checked.user.role !== "student") {
          errors.push({ line: row.line, message: "teacher_can_only_create_students" });
          return;
        }
        checked.user.ownerTeacherUsername = requester.username;
      }

      if (requester.role === "admin") {
        if (checked.user.role === "admin") {
          errors.push({ line: row.line, message: "cannot_create_admin_account" });
          return;
        }
        if (checked.user.role === "student" && !checked.user.ownerTeacherUsername) {
          errors.push({ line: row.line, message: "missing_owner_teacher" });
          return;
        }
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
  const requester = await getCurrentUser();
  if (!requester || (requester.role !== "teacher" && requester.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    username?: string;
    patch?: { name?: string; school?: string; role?: string; password?: string; ownerTeacherUsername?: string };
  };

  if (!body.username || !body.patch) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const target = getUser(body.username);
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  if (!canManageTarget(requester, target)) {
    return NextResponse.json({ error: "forbidden_target" }, { status: 403 });
  }

  const patch: {
    name?: string;
    school?: string;
    role?: "student" | "teacher" | "admin";
    password?: string;
    ownerTeacherUsername?: string;
  } = {};

  if (body.patch.name !== undefined) patch.name = body.patch.name.trim();
  if (body.patch.school !== undefined) patch.school = body.patch.school.trim();
  if (body.patch.password !== undefined) {
    if (body.patch.password.length > 0 && body.patch.password.length < 6) {
      return NextResponse.json({ error: "password_too_short" }, { status: 400 });
    }
    if (body.patch.password.length > 0) patch.password = body.patch.password;
  }

  if (body.patch.role !== undefined) {
    if (!isValidRole(body.patch.role)) {
      return NextResponse.json({ error: "invalid_role" }, { status: 400 });
    }
    patch.role = body.patch.role;
  }

  if (body.patch.ownerTeacherUsername !== undefined) {
    patch.ownerTeacherUsername = body.patch.ownerTeacherUsername.trim();
  }

  if (requester.role === "teacher") {
    if (target.username === requester.username) {
      if (patch.role && patch.role !== "teacher") {
        return NextResponse.json({ error: "cannot_downgrade_self_role" }, { status: 400 });
      }
      delete patch.ownerTeacherUsername;
    } else {
      if (target.role !== "student" || target.ownerTeacherUsername !== requester.username) {
        return NextResponse.json({ error: "forbidden_target" }, { status: 403 });
      }
      if (patch.role && patch.role !== "student") {
        return NextResponse.json({ error: "teacher_cannot_change_student_role" }, { status: 403 });
      }
      patch.role = "student";
      patch.ownerTeacherUsername = requester.username;
    }
  }

  if (requester.role === "admin") {
    if (target.username === requester.username && patch.role && patch.role !== "admin") {
      return NextResponse.json({ error: "cannot_downgrade_self_role" }, { status: 400 });
    }

    if (patch.role === "admin" && target.role !== "admin") {
      return NextResponse.json({ error: "cannot_promote_to_admin" }, { status: 403 });
    }

    if ((patch.role === "student" || target.role === "student") && !patch.ownerTeacherUsername && target.role !== "student") {
      return NextResponse.json({ error: "missing_owner_teacher" }, { status: 400 });
    }
  }

  const result = updateUserAccount(body.username, patch);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const requester = await getCurrentUser();
  if (!requester || (requester.role !== "teacher" && requester.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { username?: string };
  if (!body.username) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const target = getUser(body.username);
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  if (body.username === requester.username) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });
  }

  if (!canManageTarget(requester, target)) {
    return NextResponse.json({ error: "forbidden_target" }, { status: 403 });
  }

  if (requester.role === "admin" && target.role === "admin") {
    return NextResponse.json({ error: "cannot_delete_admin" }, { status: 403 });
  }

  const result = deleteUserAccount(body.username);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

function canManageTarget(requester: AuthUser, target: UserAccount): boolean {
  if (requester.role === "admin") {
    return true;
  }
  if (requester.role === "teacher") {
    if (target.role === "student" && target.ownerTeacherUsername === requester.username) {
      return true;
    }
    if (target.role === "teacher" && target.username === requester.username) {
      return true;
    }
  }
  return false;
}

function isValidRole(role: string): role is ManageRole {
  return role === "student" || role === "teacher" || role === "admin";
}

function validateUserFields(input: UserInput):
  | {
      ok: true;
      user: {
        username: string;
        name: string;
        school: string;
        role: "student" | "teacher" | "admin";
        password: string;
        ownerTeacherUsername?: string;
      };
    }
  | { ok: false; error: string } {
  const username = (input.username ?? "").trim();
  const name = (input.name ?? "").trim();
  const school = (input.school ?? "").trim();
  const role = (input.role ?? "").trim();
  const password = input.password ?? "";
  const ownerTeacherUsername = (input.ownerTeacherUsername ?? "").trim();

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
  if (role === "student" && ownerTeacherUsername) {
    const teacherExists = getTeacherUsers().some((teacher) => teacher.username === ownerTeacherUsername);
    if (!teacherExists) {
      return { ok: false, error: "owner_teacher_not_found" };
    }
  }

  return {
    ok: true,
    user: {
      username,
      name,
      school,
      role,
      password,
      ownerTeacherUsername: role === "student" ? ownerTeacherUsername : undefined
    }
  };
}

function parseUserCsv(csvText: string):
  | {
      ok: true;
      rows: Array<{
        line: number;
        values: {
          username?: string;
          name?: string;
          school?: string;
          role?: string;
          password?: string;
          ownerTeacherUsername?: string;
        };
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
  const headerMatches5 = normalizedHeader.join(",") === "username,name,school,role,password";
  const headerMatches6 = normalizedHeader.join(",") === "username,name,school,role,password,ownerteacherusername";
  const headerMatchesZh5 = header.join(",") === "帳號,姓名,學校,角色,密碼";
  const headerMatchesZh6 = header.join(",") === "帳號,姓名,學校,角色,密碼,綁定教師";
  if (headerMatches5 || headerMatches6 || headerMatchesZh5 || headerMatchesZh6) {
    startIndex = 1;
  }

  const rows: Array<{
    line: number;
    values: {
      username?: string;
      name?: string;
      school?: string;
      role?: string;
      password?: string;
      ownerTeacherUsername?: string;
    };
  }> = [];

  for (let idx = startIndex; idx < lines.length; idx += 1) {
    const cells = splitCsvLine(lines[idx]!);
    if (cells.length !== 5 && cells.length !== 6) {
      return { ok: false, error: `csv_invalid_column_count_line_${idx + 1}` };
    }

    rows.push({
      line: idx + 1,
      values: {
        username: cells[0],
        name: cells[1],
        school: cells[2],
        role: cells[3],
        password: cells[4],
        ownerTeacherUsername: cells[5] ?? ""
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
    if (char === '"') {
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
