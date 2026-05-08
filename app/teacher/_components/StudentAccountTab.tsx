"use client";

import { useEffect, useMemo, useState } from "react";
import { UserRow } from "./types";

interface StudentAccountTabProps {
  loginUser: string;
  loginRole: "teacher" | "admin";
  isAdminConsole: boolean;
  users: UserRow[];
  schoolOptions: string[];
  teacherUsers: UserRow[];
  loginTeacherProfile: UserRow | undefined;
  onRefresh: () => Promise<void>;
}

export default function StudentAccountTab({
  loginUser,
  loginRole,
  users,
  schoolOptions,
  teacherUsers,
  loginTeacherProfile,
  onRefresh,
}: StudentAccountTabProps) {
  const [userQuery, setUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "teacher" | "student" | "admin">("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("");
  const [userSortBy, setUserSortBy] = useState<"username" | "name" | "classNumber">("username");
  const [userSortDirection, setUserSortDirection] = useState<"asc" | "desc">("asc");
  const [userPage, setUserPage] = useState(1);
  const [accountError, setAccountError] = useState("");
  const [accountSuccess, setAccountSuccess] = useState("");
  const [editingUser, setEditingUser] = useState<{
    username: string;
    name: string;
    school: string;
    role: "student" | "teacher";
    ownerTeacherUsername: string;
    classNumber: string;
    password: string;
  } | null>(null);
  const [newUserForm, setNewUserForm] = useState({
    username: "",
    name: "",
    school: "",
    role: "student" as "student" | "teacher",
    ownerTeacherUsername: "",
    classNumber: "",
    password: ""
  });
  const [csvInput, setCsvInput] = useState("");
  const [csvPreviewErrors, setCsvPreviewErrors] = useState<string[]>([]);
  const [resetTargetUser, setResetTargetUser] = useState("");
  const [resetMode, setResetMode] = useState<"system" | "manual">("system");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [manualResetPassword, setManualResetPassword] = useState("");

  const classFilterOptions = useMemo(() => {
    if (schoolFilter === "all") return [];
    const uniqClassNumbers = Array.from(
      new Set(
        users
          .filter((user) => user.role === "student" && user.school === schoolFilter)
          .map((user) => user.classNumber)
          .filter((value): value is string => Boolean(value))
      )
    );
    return uniqClassNumbers.sort((a, b) => {
      const nA = Number(a);
      const nB = Number(b);
      if (Number.isFinite(nA) && Number.isFinite(nB)) return nB - nA;
      return b.localeCompare(a, "zh-Hant");
    });
  }, [users, schoolFilter]);

  const filteredUsers = useMemo(() => {
    const keyword = userQuery.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (schoolFilter !== "all" && user.school !== schoolFilter) return false;
      if (roleFilter === "student" && schoolFilter !== "all") {
        if (classFilter && (user.classNumber ?? "") !== classFilter) return false;
      }
      if (!keyword) return true;
      return (
        user.username.toLowerCase().includes(keyword) ||
        user.name.toLowerCase().includes(keyword) ||
        user.school.toLowerCase().includes(keyword)
      );
    });
  }, [users, roleFilter, schoolFilter, classFilter, userQuery]);

  const sortedUsers = useMemo(() => {
    const getSortValue = (user: UserRow): string => {
      if (userSortBy === "username") return user.username;
      if (userSortBy === "name") return user.name;
      return user.classNumber ?? "";
    };
    const sorted = [...filteredUsers].sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      if (userSortBy === "classNumber") {
        const aNum = Number(aValue);
        const bNum = Number(bValue);
        if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
          return userSortDirection === "asc" ? aNum - bNum : bNum - aNum;
        }
      }
      const base = aValue.localeCompare(bValue, "zh-Hant");
      return userSortDirection === "asc" ? base : -base;
    });
    return sorted;
  }, [filteredUsers, userSortBy, userSortDirection]);

  const totalUserPages = useMemo(() => Math.max(1, Math.ceil(sortedUsers.length / 20)), [sortedUsers.length]);

  const pagedUsers = useMemo(() => {
    const start = (userPage - 1) * 20;
    return sortedUsers.slice(start, start + 20);
  }, [sortedUsers, userPage]);

  const userPageStartIndex = useMemo(() => (userPage - 1) * 20, [userPage]);

  useEffect(() => {
    setClassFilter("");
    setUserPage(1);
  }, [roleFilter, schoolFilter]);

  useEffect(() => {
    setUserPage(1);
  }, [classFilter, userSortBy, userSortDirection, userQuery]);

  useEffect(() => {
    if (userPage > totalUserPages) {
      setUserPage(totalUserPages);
    }
  }, [userPage, totalUserPages]);

  useEffect(() => {
    if (newUserForm.role !== "student") return;
    if (loginRole === "teacher") {
      const school = loginTeacherProfile?.school ?? "";
      if (newUserForm.ownerTeacherUsername !== loginUser || newUserForm.school !== school) {
        setNewUserForm((prev) => ({
          ...prev,
          ownerTeacherUsername: loginUser,
          school
        }));
      }
    }
  }, [newUserForm.role, loginRole, loginUser, loginTeacherProfile?.school, newUserForm.ownerTeacherUsername, newUserForm.school]);

  function toggleUserSort(field: "username" | "name" | "classNumber") {
    if (userSortBy === field) {
      setUserSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setUserSortBy(field);
    setUserSortDirection("asc");
  }

  function getSortIndicator(field: "username" | "name" | "classNumber") {
    if (userSortBy !== field) return "↕";
    return userSortDirection === "asc" ? "↑" : "↓";
  }

  function handleNewUserRoleChange(role: "student" | "teacher") {
    if (role === "student") {
      if (loginRole === "admin") {
        setNewUserForm((prev) => ({ ...prev, role, ownerTeacherUsername: "", school: "", classNumber: "" }));
      } else {
        setNewUserForm((prev) => ({
          ...prev,
          role,
          ownerTeacherUsername: loginUser,
          school: loginTeacherProfile?.school ?? "",
          classNumber: prev.classNumber
        }));
      }
      return;
    }
    setNewUserForm((prev) => ({ ...prev, role, ownerTeacherUsername: "", classNumber: "" }));
  }

  function handleNewStudentTeacherChange(teacherUsername: string) {
    const teacher = teacherUsers.find((item) => item.username === teacherUsername);
    setNewUserForm((prev) => ({
      ...prev,
      ownerTeacherUsername: teacherUsername,
      school: teacher?.school ?? ""
    }));
  }

  function createRandomPassword(length = 12): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let result = "";
    for (let i = 0; i < length; i += 1) {
      result += chars[Math.floor(Math.random() * chars.length)]!;
    }
    return result;
  }

  function splitCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]!;
      if (char === "\"") {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  }

  function validateCsvRows(
    lines: string[],
    options?: { skipPasswordLength?: boolean; isAdmin?: boolean; skipUsernameFormat?: boolean }
  ): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();
    const teacherUsernames = users.filter((item) => item.role === "teacher").map((item) => item.username);

    lines.forEach((line, idx) => {
      const cols = splitCsvLine(line);
      if (cols.length !== 6 && cols.length !== 7) {
        errors.push(`第 ${idx + 1} 列欄位數錯誤（需 6 或 7 欄）`);
        return;
      }
      const [classNumberRaw = "", username, name, school, role, password, ownerTeacherUsernameRaw = ""] = cols.map((v) => v.trim());
      const classNumber = classNumberRaw.trim();
      const ownerTeacherUsername = ownerTeacherUsernameRaw.trim();
      if (!username || !name || !school || !role || !password) {
        errors.push(`第 ${idx + 1} 列有必填欄位為空`);
        return;
      }
      if (!options?.skipUsernameFormat && !/^[A-Za-z0-9._-]{2,32}$/.test(username)) {
        errors.push(`第 ${idx + 1} 列 username 格式錯誤`);
      }
      if (!["student", "teacher"].includes(role)) {
        errors.push(`第 ${idx + 1} 列 role 必須是 student 或 teacher（不可為 admin）`);
      }
      if (options?.isAdmin === false && role === "teacher") {
        errors.push(`第 ${idx + 1} 列教師帳號只能由 admin 建立`);
      }
      if (!options?.skipPasswordLength && password.length < 6) {
        errors.push(`第 ${idx + 1} 列 password 至少 6 碼`);
      }
      if (role === "student") {
        if (!classNumber) {
          errors.push(`第 ${idx + 1} 列 student 必填班級號碼`);
        }
        if (options?.isAdmin) {
          if (!ownerTeacherUsername) {
            errors.push(`第 ${idx + 1} 列 student 必填綁定教師 username`);
          } else if (!teacherUsernames.includes(ownerTeacherUsername)) {
            errors.push(`第 ${idx + 1} 列綁定教師不存在`);
          }
        }
      }
      if (seen.has(username)) {
        errors.push(`第 ${idx + 1} 列 username 重複`);
      }
      seen.add(username);
    });
    return errors;
  }

  function openResetPassword(username: string) {
    const newGenerated = createRandomPassword();
    setResetTargetUser(username);
    setResetMode("system");
    setGeneratedPassword(newGenerated);
    setManualResetPassword("");
    setAccountError("");
    setAccountSuccess("");
  }

  async function copyResetPasswordValue() {
    const value = resetMode === "system" ? generatedPassword : manualResetPassword;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setAccountSuccess("密碼已複製到剪貼簿。");
  }

  async function resetPassword() {
    if (!resetTargetUser) return;
    const nextPassword = resetMode === "system" ? generatedPassword : manualResetPassword;
    if (!nextPassword || nextPassword.length < 6) {
      setAccountError("password_too_short");
      setAccountSuccess("");
      return;
    }
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", username: resetTargetUser, newPassword: nextPassword })
    });
    if (!response.ok) {
      const data = await response.json();
      setAccountError(data.error ?? "reset_password_failed");
      setAccountSuccess("");
      return;
    }
    setAccountSuccess(`已重設 ${resetTargetUser} 密碼。`);
    setResetTargetUser("");
    setManualResetPassword("");
    setAccountError("");
  }

  async function createUser() {
    setAccountError("");
    setAccountSuccess("");
    const validationErrors = validateCsvRows(
      [
        `${newUserForm.classNumber},${newUserForm.username},${newUserForm.name},${newUserForm.school},${newUserForm.role},${newUserForm.password},${newUserForm.ownerTeacherUsername}`
      ],
      { isAdmin: loginRole === "admin" }
    );
    if (validationErrors.length > 0) {
      setAccountError(validationErrors[0]!);
      return;
    }
    if (loginRole !== "admin" && newUserForm.role !== "student") {
      setAccountError("teacher_can_only_create_students");
      return;
    }
    const userPayload = {
      ...newUserForm,
      ownerTeacherUsername:
        newUserForm.role === "student"
          ? loginRole === "admin"
            ? newUserForm.ownerTeacherUsername
            : loginUser
          : "",
      classNumber: newUserForm.role === "student" ? newUserForm.classNumber : ""
    };
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", user: userPayload })
    });
    const data = await response.json();
    if (!response.ok) {
      setAccountError(data.error ?? "create_user_failed");
      return;
    }
    setNewUserForm({
      username: "",
      name: "",
      school: "",
      role: "student",
      ownerTeacherUsername: "",
      classNumber: "",
      password: ""
    });
    setAccountSuccess("已新增帳號。");
    await onRefresh();
  }

  async function saveEditedUser() {
    if (!editingUser) return;
    setAccountError("");
    setAccountSuccess("");
    const row = `${editingUser.classNumber},${editingUser.username},${editingUser.name},${editingUser.school},${editingUser.role},${
      editingUser.password || "placeholder123"
    },${editingUser.ownerTeacherUsername}`;
    const validationErrors = validateCsvRows([row], {
      skipPasswordLength: !editingUser.password,
      isAdmin: loginRole === "admin",
      skipUsernameFormat: true
    });
    if (validationErrors.length > 0) {
      setAccountError(validationErrors[0]!);
      return;
    }
    const patch: {
      name: string;
      school: string;
      role: "student" | "teacher";
      ownerTeacherUsername?: string;
      classNumber?: string;
      password?: string;
    } = {
      name: editingUser.name,
      school: editingUser.school,
      role: editingUser.role
    };
    if (editingUser.role === "student") {
      patch.ownerTeacherUsername = loginRole === "admin" ? editingUser.ownerTeacherUsername : loginUser;
      patch.classNumber = editingUser.classNumber;
    }
    if (editingUser.password) {
      patch.password = editingUser.password;
    }
    const response = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: editingUser.username, patch })
    });
    const data = await response.json();
    if (!response.ok) {
      setAccountError(data.error ?? "update_user_failed");
      return;
    }
    setEditingUser(null);
    setAccountSuccess("已更新帳號資料。");
    await onRefresh();
  }

  async function deleteUser(username: string) {
    const confirmed = window.confirm(`確定刪除帳號 ${username} 嗎？`);
    if (!confirmed) return;
    setAccountError("");
    setAccountSuccess("");
    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    const data = await response.json();
    if (!response.ok) {
      setAccountError(data.error ?? "delete_user_failed");
      return;
    }
    setAccountSuccess(`已刪除 ${username}。`);
    await onRefresh();
  }

  async function importUsersFromCsv() {
    setAccountError("");
    setAccountSuccess("");
    const parsedLines = csvInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (parsedLines.length === 0) {
      setAccountError("csv_empty");
      return;
    }
    const headerLine = parsedLines[0]!.toLowerCase();
    const hasHeader =
      headerLine === "classnumber,username,name,school,role,password" ||
      headerLine === "classnumber,username,name,school,role,password,ownerteacherusername" ||
      parsedLines[0] === "班級號碼,帳號,姓名,學校,角色,密碼" ||
      parsedLines[0] === "班級號碼,帳號,姓名,學校,角色,密碼,綁定教師";
    const dataLines = hasHeader ? parsedLines.slice(1) : parsedLines;
    const previewErrors = validateCsvRows(dataLines, { isAdmin: loginRole === "admin" });
    setCsvPreviewErrors(previewErrors);
    if (previewErrors.length > 0) {
      setAccountError("csv_validation_failed");
      return;
    }
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk_create_from_csv", csv: csvInput })
    });
    const data = await response.json();
    if (!response.ok) {
      const detail = Array.isArray(data.details)
        ? data.details.map((d: { line: number; message: string }) => `line ${d.line}: ${d.message}`).join("; ")
        : data.error;
      setAccountError(detail ?? "bulk_create_failed");
      return;
    }
    setCsvInput("");
    setCsvPreviewErrors([]);
    setAccountSuccess(`已批次新增 ${data.createdCount ?? 0} 筆帳號。`);
    await onRefresh();
  }

  return (
    <>
      <div className="card">
        <h2>帳號管理</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <div className="col card" style={{ marginBottom: 0, padding: 12 }}>
            <small>總帳號數</small>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{users.length}</div>
          </div>
          <div className="col card" style={{ marginBottom: 0, padding: 12 }}>
            <small>教師帳號</small>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{users.filter((user) => user.role === "teacher").length}</div>
          </div>
          {loginRole === "admin" ? (
            <div className="col card" style={{ marginBottom: 0, padding: 12 }}>
              <small>管理員帳號</small>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{users.filter((user) => user.role === "admin").length}</div>
            </div>
          ) : null}
          <div className="col card" style={{ marginBottom: 0, padding: 12 }}>
            <small>學生帳號</small>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{users.filter((user) => user.role === "student").length}</div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 10 }}>
          <h3 style={{ marginBottom: 8 }}>新增單一帳號</h3>
          <div className="row">
            <div className="col">
              <label>角色</label>
              <select
                value={newUserForm.role}
                onChange={(e) => handleNewUserRoleChange(e.target.value as "student" | "teacher")}
              >
                <option value="student">學生</option>
                {loginRole === "admin" ? <option value="teacher">教師</option> : null}
              </select>
            </div>
            {loginRole === "admin" && newUserForm.role === "student" ? (
              <div className="col">
                <label>綁定教師（username）</label>
                <select
                  value={newUserForm.ownerTeacherUsername}
                  onChange={(e) => handleNewStudentTeacherChange(e.target.value)}
                >
                  <option value="">請選擇教師</option>
                  {teacherUsers.map((teacher) => (
                    <option key={teacher.username} value={teacher.username}>
                      {teacher.username} / {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {newUserForm.role === "student" ? (
              <div className="col">
                <label>學校（自動帶入）</label>
                <input value={newUserForm.school} readOnly />
              </div>
            ) : (
              <div className="col">
                <label>學校</label>
                <input
                  value={newUserForm.school}
                  onChange={(e) => setNewUserForm((prev) => ({ ...prev, school: e.target.value }))}
                />
              </div>
            )}
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <div className="col">
              <label>帳號（username）</label>
              <input
                value={newUserForm.username}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="例如 student01"
              />
            </div>
            <div className="col">
              <label>姓名</label>
              <input value={newUserForm.name} onChange={(e) => setNewUserForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            {newUserForm.role === "student" ? (
              <div className="col">
                <label>班級號碼</label>
                <input
                  value={newUserForm.classNumber}
                  onChange={(e) => setNewUserForm((prev) => ({ ...prev, classNumber: e.target.value }))}
                  placeholder="例如 701"
                />
              </div>
            ) : null}
            <div className="col">
              <label>密碼（至少 6 碼）</label>
              <input
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div className="col" style={{ alignSelf: "end" }}>
              <button type="button" onClick={createUser}>
                新增帳號
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 10 }}>
          <h3 style={{ marginBottom: 8 }}>CSV 貼上批次新增</h3>
          <div style={{ marginBottom: 8 }}>
            <small style={{ display: "block" }}>
              請使用逗號分隔，欄位順序固定為：
              <code style={{ marginLeft: 6 }}>
                classnumber,username,name,school,role,password[,ownerTeacherUsername]
              </code>
            </small>
            <small style={{ display: "block", marginTop: 4 }}>
              role 僅可填 <code>student</code> 或 <code>teacher</code>（不可填 <code>admin</code>）。
            </small>
            <small style={{ display: "block", marginTop: 4 }}>
              username 規則：2~32 字元，可用英數字與 <code>.</code>、<code>_</code>、<code>-</code>。
            </small>
            <small style={{ display: "block", marginTop: 4 }}>
              password 至少 6 碼；student 必填 classnumber。
            </small>
            <small style={{ display: "block", marginTop: 4 }}>
              teacher 的 classnumber 與 ownerTeacherUsername 可填任意字串（可留空）。
            </small>
            <small style={{ display: "block", marginTop: 4 }}>
              {loginRole === "admin"
                ? "admin 批次建立 student 時，必填 ownerTeacherUsername，且需為既有教師 username。"
                : "teacher 批次建立時僅可建立 student；ownerTeacherUsername 會自動綁定為目前登入教師。"}
            </small>
          </div>
          <textarea
            style={{ marginTop: 8 }}
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            placeholder={
              loginRole === "admin"
                ? "classnumber,username,name,school,role,password,ownerTeacherUsername\n701,student10,王小明,Demo High,student,abc12345,teacher"
                : "classnumber,username,name,school,role,password\n701,student10,王小明,Demo High,student,abc12345"
            }
          />
          <div className="row" style={{ marginTop: 10 }}>
            <div style={{ width: 220 }}>
              <button type="button" onClick={importUsersFromCsv}>
                驗證並批次新增
              </button>
            </div>
            <div style={{ width: 220 }}>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setCsvInput(
                    loginRole === "admin"
                      ? "classnumber,username,name,school,role,password,ownerTeacherUsername"
                      : "classnumber,username,name,school,role,password"
                  )
                }
              >
                載入範例表頭
              </button>
            </div>
          </div>
          {csvPreviewErrors.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              {csvPreviewErrors.map((item, idx) => (
                <small key={`${item}-${idx}`} style={{ display: "block" }}>
                  {item}
                </small>
              ))}
            </div>
          ) : null}
        </div>

        {resetTargetUser ? (
          <div className="card" style={{ marginBottom: 10, borderColor: "#bfdbfe", background: "#eff6ff" }}>
            <h3 style={{ marginBottom: 8 }}>重設密碼：{resetTargetUser}</h3>
            <div className="row">
              <div className="col">
                <label>密碼來源</label>
                <select value={resetMode} onChange={(e) => setResetMode(e.target.value as "system" | "manual")}>
                  <option value="system">系統產生密碼</option>
                  <option value="manual">手動輸入新密碼</option>
                </select>
              </div>
              {resetMode === "system" ? (
                <>
                  <div className="col">
                    <label>系統產生密碼</label>
                    <input value={generatedPassword} readOnly />
                  </div>
                  <div className="col" style={{ alignSelf: "end" }}>
                    <button type="button" className="secondary" onClick={() => setGeneratedPassword(createRandomPassword())}>
                      重新產生
                    </button>
                  </div>
                </>
              ) : (
                <div className="col">
                  <label>手動輸入新密碼（至少 6 碼）</label>
                  <input
                    type="text"
                    value={manualResetPassword}
                    onChange={(e) => setManualResetPassword(e.target.value)}
                    placeholder="輸入新密碼"
                  />
                </div>
              )}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ width: 180 }}>
                <button type="button" className="secondary" onClick={copyResetPasswordValue}>
                  複製密碼
                </button>
              </div>
              <div style={{ width: 180 }}>
                <button type="button" onClick={resetPassword}>
                  確認重設
                </button>
              </div>
              <div style={{ width: 180 }}>
                <button type="button" className="secondary" onClick={() => setResetTargetUser("")}>
                  取消
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {accountError ? <small style={{ color: "#b91c1c", display: "block", marginBottom: 8 }}>{accountError}</small> : null}
        {accountSuccess ? <small style={{ color: "#166534", display: "block", marginBottom: 8 }}>{accountSuccess}</small> : null}

        <div className="row" style={{ marginBottom: 10 }}>
          <div className="col">
            <label>搜尋（帳號 / 姓名 / 學校）</label>
            <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="輸入關鍵字" />
          </div>
          <div className="col">
            <label>角色篩選</label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as "all" | "teacher" | "student" | "admin");
              }}
            >
              <option value="all">全部</option>
              {loginRole === "admin" ? <option value="admin">管理員</option> : null}
              <option value="teacher">教師</option>
              <option value="student">學生</option>
            </select>
          </div>
          <div className="col">
            <label>學校篩選</label>
            <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
              <option value="all">全部學校</option>
              {schoolOptions.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </select>
          </div>
          {roleFilter === "student" && schoolFilter !== "all" ? (
            <div className="col">
              <label>班級篩選（由大到小）</label>
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                <option value="">全部班級</option>
                {classFilterOptions.map((classNumber) => (
                  <option key={classNumber} value={classNumber}>
                    {classNumber}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="pro-table">
            <thead>
              <tr>
                <th>#</th>
                <th>
                  帳號
                  <button type="button" className="secondary" style={{ width: "auto", marginLeft: 6, padding: "2px 6px" }} onClick={() => toggleUserSort("username")}>
                    {getSortIndicator("username")}
                  </button>
                </th>
                <th>
                  姓名
                  <button type="button" className="secondary" style={{ width: "auto", marginLeft: 6, padding: "2px 6px" }} onClick={() => toggleUserSort("name")}>
                    {getSortIndicator("name")}
                  </button>
                </th>
                <th>學校</th>
                <th>
                  班級號碼
                  <button type="button" className="secondary" style={{ width: "auto", marginLeft: 6, padding: "2px 6px" }} onClick={() => toggleUserSort("classNumber")}>
                    {getSortIndicator("classNumber")}
                  </button>
                </th>
                <th>角色</th>
                <th>綁定教師</th>
                <th style={{ width: 360 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedUsers.map((user, idx) => (
                <tr key={user.username}>
                  <td>{userPageStartIndex + idx + 1}</td>
                  <td>{user.username}</td>
                  {editingUser?.username === user.username ? (
                    <>
                      <td>
                        <input
                          value={editingUser.name}
                          onChange={(e) => setEditingUser((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                        />
                      </td>
                      <td>
                        <input
                          value={editingUser.school}
                          onChange={(e) => setEditingUser((prev) => (prev ? { ...prev, school: e.target.value } : prev))}
                        />
                      </td>
                      <td>
                        {editingUser.role === "student" ? (
                          <input
                            value={editingUser.classNumber}
                            onChange={(e) => setEditingUser((prev) => (prev ? { ...prev, classNumber: e.target.value } : prev))}
                            placeholder="班級號碼"
                          />
                        ) : (
                          <small>—</small>
                        )}
                      </td>
                      <td>
                        <select
                          value={editingUser.role}
                          onChange={(e) =>
                            setEditingUser((prev) =>
                              prev ? { ...prev, role: e.target.value as "student" | "teacher" } : prev
                            )
                          }
                        >
                          <option value="student">學生</option>
                          {loginRole === "admin" || editingUser.username === loginUser ? (
                            <option value="teacher">教師</option>
                          ) : null}
                        </select>
                      </td>
                      <td>
                        {editingUser.role === "student" ? (
                          loginRole === "admin" ? (
                            <select
                              value={editingUser.ownerTeacherUsername}
                              onChange={(e) =>
                                setEditingUser((prev) =>
                                  prev ? { ...prev, ownerTeacherUsername: e.target.value } : prev
                                )
                              }
                            >
                              <option value="">請選擇教師</option>
                              {users
                                .filter((item) => item.role === "teacher")
                                .map((teacher) => (
                                  <option key={teacher.username} value={teacher.username}>
                                    {teacher.username}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <small>{loginUser}</small>
                          )
                        ) : (
                          <small>—</small>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div>
                            <input
                              type="password"
                              placeholder="新密碼（選填）"
                              value={editingUser.password}
                              onChange={(e) =>
                                setEditingUser((prev) => (prev ? { ...prev, password: e.target.value } : prev))
                              }
                            />
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" style={{ width: "auto", minWidth: 72 }} onClick={saveEditedUser}>
                              儲存
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              style={{ width: "auto", minWidth: 72 }}
                              onClick={() => setEditingUser(null)}
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{user.name}</td>
                      <td>{user.school}</td>
                      <td>{user.role === "student" ? user.classNumber ?? "—" : "—"}</td>
                      <td>
                        <span className="badge">
                          {user.role === "teacher" ? "教師" : user.role === "admin" ? "管理員" : "學生"}
                        </span>
                      </td>
                      <td>{user.role === "student" ? user.ownerTeacherUsername ?? "—" : "—"}</td>
                      <td>
                        {user.role === "admin" ? (
                          <small>系統保留帳號</small>
                        ) : (
                          <div className="row" style={{ gap: 8 }}>
                            <button
                              type="button"
                              className="secondary"
                              style={{ width: "auto" }}
                              onClick={() =>
                                setEditingUser({
                                  username: user.username,
                                  name: user.name,
                                  school: user.school,
                                  role: user.role === "teacher" ? "teacher" : "student",
                                  ownerTeacherUsername: user.ownerTeacherUsername ?? "",
                                  classNumber: user.classNumber ?? "",
                                  password: ""
                                })
                              }
                            >
                              修改
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              style={{ width: "auto" }}
                              onClick={() => openResetPassword(user.username)}
                            >
                              重設密碼
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              style={{ width: "auto", color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}
                              onClick={() => deleteUser(user.username)}
                            >
                              刪除
                            </button>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
          <small>
            第 {userPage} / {totalUserPages} 頁，共 {sortedUsers.length} 筆（每頁 20 筆）
          </small>
          <div style={{ width: 120 }}>
            <button type="button" className="secondary" disabled={userPage <= 1} onClick={() => setUserPage((prev) => prev - 1)}>
              上一頁
            </button>
          </div>
          <div style={{ width: 120 }}>
            <button
              type="button"
              className="secondary"
              disabled={userPage >= totalUserPages}
              onClick={() => setUserPage((prev) => prev + 1)}
            >
              下一頁
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
