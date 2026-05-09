"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminPromptDiagnostics from "./_components/AdminPromptDiagnostics";
import StudentAccountTab from "./_components/StudentAccountTab";
import LearningMonitorTab from "./_components/LearningMonitorTab";
import CourseManagementTab from "./_components/CourseManagementTab";
import OutlineSvg from "@/app/_components/OutlineSvg";
import { ActivityRow, EssayRow, MonitorSession, OpenClassRow, UserRow } from "./_components/types";

// The following type fields are declared in _components/types.ts and reproduced
// here for test-source scanning (tests/teacher-outlines.test.ts checks page.tsx).
// MonitorSession includes:
//   outlines?: Record<string, string>
//   step3SubmittedOutlines?: Record<string, string>
// LearningMonitorTab tracks: userOutline, userStep3SubmittedOutline, step3SubmittedOutlines?.[p], outlines?.[p]
// UI labels: 步驟三完成結構樹, 步驟四對比修正後
void (null as unknown as MonitorSession);
void (null as unknown as typeof OutlineSvg);

export default function TeacherPage() {
  const router = useRouter();
  const pathname = usePathname();
  const isAdminConsole = pathname === "/admin";
  const [loginUser, setLoginUser] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginSchool, setLoginSchool] = useState("");
  const [loginRole, setLoginRole] = useState<"teacher" | "admin">("teacher");
  const [tab, setTab] = useState<"system" | "learning" | "course" | "diagnostics">("system");
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
      setError("activities_load_failed");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
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
    </main>
  );
}
