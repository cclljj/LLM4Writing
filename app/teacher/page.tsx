"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminPromptDiagnostics from "./_components/AdminPromptDiagnostics";
import StudentAccountTab from "./_components/StudentAccountTab";
import LearningMonitorTab from "./_components/LearningMonitorTab";
import CourseManagementTab from "./_components/CourseManagementTab";
import AdminAuditLogPanel from "./_components/AdminAuditLogPanel";
import { formatUserError } from "@/src/lib/error-messages";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { ActivityRow, EssayRow, OpenClassRow, UserRow } from "./_components/types";

const TEACHER_TAB_STORAGE_KEY = "teacher:activeTab";
const ADMIN_TAB_STORAGE_KEY = "admin:activeTab";
const TEACHER_ALLOWED_TABS = ["system", "learning", "course"] as const;
const ADMIN_ALLOWED_TABS = ["system", "learning", "course", "diagnostics", "audit"] as const;
type TeacherTab = "system" | "learning" | "course" | "diagnostics" | "audit";

function isAllowedTab(tab: string, isAdminConsole: boolean): tab is TeacherTab {
  const allowed = isAdminConsole ? ADMIN_ALLOWED_TABS : TEACHER_ALLOWED_TABS;
  return (allowed as readonly string[]).includes(tab);
}

export default function TeacherPage() {
  const router = useRouter();
  const pathname = usePathname();
  const isAdminConsole = pathname === "/admin";
  const [loginUser, setLoginUser] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginSchool, setLoginSchool] = useState("");
  const [loginRole, setLoginRole] = useState<"teacher" | "admin">("teacher");
  const [tab, setTab] = useState<TeacherTab>("system");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [essays, setEssays] = useState<EssayRow[]>([]);
  const [openClasses, setOpenClasses] = useState<OpenClassRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [error, setError] = useState("");
  const refreshTokenRef = useRef(0);

  const schoolOptions = useMemo(
    () => Array.from(new Set(users.map((user) => user.school).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hant")),
    [users]
  );

  const teacherUsers = useMemo(
    () => users.filter((item) => item.role === "teacher"),
    [users]
  );

  const loginTeacherProfile = useMemo(
    () => teacherUsers.find((item) => item.username === loginUser),
    [teacherUsers, loginUser]
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated) {
          setLoginUser(data.user.username);
          setLoginName(data.user.name ?? "");
          setLoginSchool(data.user.school ?? "");
          if (data.user.role === "admin") {
            setLoginRole("admin");
            if (!isAdminConsole) {
              router.replace("/admin");
            }
          } else {
            setLoginRole("teacher");
            if (isAdminConsole) {
              router.replace("/teacher");
            }
          }
        } else {
          router.replace("/login");
        }
      })
      .catch(() => {
        router.replace("/login");
      });

    refreshAll();
  }, [isAdminConsole, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = isAdminConsole ? ADMIN_TAB_STORAGE_KEY : TEACHER_TAB_STORAGE_KEY;
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("tab")?.trim() ?? "";
    const fromStorage = window.localStorage.getItem(storageKey)?.trim() ?? "";
    const candidate = fromQuery || fromStorage;
    if (!candidate) return;
    if (!isAllowedTab(candidate, isAdminConsole)) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    deferStateUpdate(() => setTab(candidate));
  }, [isAdminConsole]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAllowedTab(tab, isAdminConsole)) {
      deferStateUpdate(() => setTab("system"));
      return;
    }
    const storageKey = isAdminConsole ? ADMIN_TAB_STORAGE_KEY : TEACHER_TAB_STORAGE_KEY;
    window.localStorage.setItem(storageKey, tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [isAdminConsole, tab]);

  async function refreshAll() {
    const token = Date.now();
    refreshTokenRef.current = token;
    const fetchOpts: RequestInit = { cache: "no-store" };

    const fetchActivitiesWithRetry = async (): Promise<Response | null> => {
      try {
        const first = await fetch("/api/admin/activities", fetchOpts);
        if (first.ok) return first;
      } catch {
        // Ignore and retry once below.
      }
      try {
        return await fetch("/api/admin/activities", fetchOpts);
      } catch {
        return null;
      }
    };

    const [uRes, eRes, oRes, activitiesRes] = await Promise.all([
      fetch("/api/admin/users", fetchOpts).catch(() => null),
      fetch("/api/admin/essays", fetchOpts).catch(() => null),
      fetch("/api/admin/openclasses", fetchOpts).catch(() => null),
      fetchActivitiesWithRetry()
    ]);

    if (refreshTokenRef.current !== token) return;

    if (uRes?.ok) setUsers((await uRes.json()).users ?? []);
    if (eRes?.ok) {
      const list = (await eRes.json()).essays ?? [];
      setEssays(list);
    }
    if (oRes?.ok) {
      const list = (await oRes.json()).openClasses ?? [];
      setOpenClasses(list);
    }

    if (activitiesRes?.ok) {
      const list = (await activitiesRes.json()).activities ?? [];
      setActivities(list);
      setError("");
    } else {
      setError(formatUserError("activities_load_failed"));
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TEACHER_TAB_STORAGE_KEY);
      window.localStorage.removeItem(ADMIN_TAB_STORAGE_KEY);
    }
    window.location.href = "/login";
  }

  const displaySchool = loginTeacherProfile?.school || loginSchool;
  const displayName = loginTeacherProfile?.name || loginName;
  const identityLabel =
    loginUser && displaySchool && displayName ? `${displaySchool} – ${displayName} (${loginUser})` : loginUser || "管理端";

  return (
    <main>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ marginBottom: 0 }}>{isAdminConsole ? "系統管理員控制台" : "教師端管理台"}</h1>
          <div>
            <span className="badge" style={{ marginRight: 8 }}>
              {identityLabel}
            </span>
            <button type="button" className="secondary" style={{ width: "auto" }} onClick={logout}>
              登出
            </button>
          </div>
        </div>
      </div>

      <div className="card row">
        <div style={{ width: 180 }}>
          <button type="button" className={tab === "system" ? "" : "secondary"} onClick={() => setTab("system")}>帳號管理</button>
        </div>
        <div style={{ width: 180 }}>
          <button type="button" className={tab === "course" ? "" : "secondary"} onClick={() => setTab("course")}>課程管理</button>
        </div>
        <div style={{ width: 180 }}>
          <button type="button" className={tab === "learning" ? "" : "secondary"} onClick={() => setTab("learning")}>學習管理</button>
        </div>
        {isAdminConsole ? (
          <div style={{ width: 180 }}>
            <button type="button" className={tab === "diagnostics" ? "" : "secondary"} onClick={() => setTab("diagnostics")}>診斷面板</button>
          </div>
        ) : null}
        {isAdminConsole ? (
          <div style={{ width: 180 }}>
            <button type="button" className={tab === "audit" ? "" : "secondary"} onClick={() => setTab("audit")}>操作紀錄</button>
          </div>
        ) : null}
      </div>

      {tab === "system" ? (
        <StudentAccountTab
          loginUser={loginUser}
          loginRole={loginRole}
          isAdminConsole={isAdminConsole}
          users={users}
          schoolOptions={schoolOptions}
          teacherUsers={teacherUsers}
          loginTeacherProfile={loginTeacherProfile}
          onRefresh={refreshAll}
        />
      ) : null}

      {tab === "learning" ? (
        <LearningMonitorTab
          loginRole={loginRole}
          isAdminConsole={isAdminConsole}
          activities={activities}
          users={users}
          error={error}
          setError={setError}
          onRefreshData={refreshAll}
        />
      ) : null}

      {tab === "course" ? (
        <CourseManagementTab
          loginRole={loginRole}
          loginUser={loginUser}
          isAdminConsole={isAdminConsole}
          activities={activities}
          setActivities={setActivities}
          essays={essays}
          setEssays={setEssays}
          openClasses={openClasses}
          users={users}
          schoolOptions={schoolOptions}
          teacherUsers={teacherUsers}
          error={error}
          setError={setError}
          onRefresh={refreshAll}
        />
      ) : null}

      {tab === "diagnostics" && isAdminConsole ? (
        <AdminPromptDiagnostics />
      ) : null}

      {tab === "audit" && isAdminConsole ? (
        <AdminAuditLogPanel />
      ) : null}
    </main>
  );
}
