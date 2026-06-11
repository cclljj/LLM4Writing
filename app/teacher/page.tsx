"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminPromptDiagnostics from "./_components/AdminPromptDiagnostics";
import StudentAccountTab from "./_components/StudentAccountTab";
import LearningMonitorTab from "./_components/LearningMonitorTab";
import CourseManagementTab from "./_components/CourseManagementTab";
import AdminAuditLogPanel from "./_components/AdminAuditLogPanel";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { ClientFetchError, fetchJsonWithRetry } from "@/src/lib/client-retry-fetch";
import { ActivityRow, EssayRow, OpenClassRow, UserRow } from "./_components/types";

const TEACHER_TAB_STORAGE_KEY = "teacher:activeTab";
const ADMIN_TAB_STORAGE_KEY = "admin:activeTab";
const TEACHER_ALLOWED_TABS = ["system", "learning", "course"] as const;
const ADMIN_ALLOWED_TABS = ["system", "learning", "course", "diagnostics", "audit"] as const;
type TeacherTab = "system" | "learning" | "course" | "diagnostics" | "audit";
type AuthMeResponse = {
  authenticated?: boolean;
  user?: {
    username: string;
    name?: string;
    school?: string;
    role: "teacher" | "admin" | "student";
  };
};
type ManagementDataKey = "users" | "essays" | "openClasses" | "activities";

function isAllowedTab(tab: string, isAdminConsole: boolean): tab is TeacherTab {
  const allowed = isAdminConsole ? ADMIN_ALLOWED_TABS : TEACHER_ALLOWED_TABS;
  return (allowed as readonly string[]).includes(tab);
}

function getManagementRetryableMessage(target: "auth" | "data"): string {
  if (target === "auth") {
    return "目前無法確認登入狀態，可能是網路或伺服器暫時忙碌。請稍候再試；如果上課中全班都遇到這個畫面，請通知管理者。";
  }
  return "目前無法完整載入管理資料，可能是網路或伺服器暫時忙碌。請按重新整理再試；既有畫面資料會先保留。";
}

export default function TeacherPage() {
  const router = useRouter();
  const pathname = usePathname();
  const isAdminConsole = pathname === "/admin";
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authRetryNonce, setAuthRetryNonce] = useState(0);
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
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const refreshAll = useCallback(async () => {
    const token = Date.now();
    refreshTokenRef.current = token;
    setIsRefreshing(true);
    const fetchOpts: RequestInit = { cache: "no-store" };

    try {
      const results = await Promise.allSettled([
        fetchJsonWithRetry<{ users?: UserRow[] }>("/api/admin/users", fetchOpts),
        fetchJsonWithRetry<{ essays?: EssayRow[] }>("/api/admin/essays", fetchOpts),
        fetchJsonWithRetry<{ openClasses?: OpenClassRow[] }>("/api/admin/openclasses", fetchOpts),
        fetchJsonWithRetry<{ activities?: ActivityRow[] }>("/api/admin/activities", fetchOpts)
      ]);

      if (refreshTokenRef.current !== token) return;

      const failedKeys: ManagementDataKey[] = [];
      const [usersResult, essaysResult, openClassesResult, activitiesResult] = results;

      if (usersResult.status === "fulfilled") {
        setUsers(usersResult.value.data.users ?? []);
      } else {
        failedKeys.push("users");
      }

      if (essaysResult.status === "fulfilled") {
        setEssays(essaysResult.value.data.essays ?? []);
      } else {
        failedKeys.push("essays");
      }

      if (openClassesResult.status === "fulfilled") {
        setOpenClasses(openClassesResult.value.data.openClasses ?? []);
      } else {
        failedKeys.push("openClasses");
      }

      if (activitiesResult.status === "fulfilled") {
        setActivities(activitiesResult.value.data.activities ?? []);
      } else {
        failedKeys.push("activities");
      }

      const authFailure = results.find(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof ClientFetchError &&
          (result.reason.status === 401 || result.reason.status === 403)
      );
      if (authFailure) {
        router.replace("/login");
        return;
      }

      if (failedKeys.length > 0) {
        setError(getManagementRetryableMessage("data"));
      } else {
        setError("");
      }
    } finally {
      if (refreshTokenRef.current === token) {
        setIsRefreshing(false);
      }
    }
  }, [router]);

  useEffect(() => {
    let canceled = false;
    fetchJsonWithRetry<AuthMeResponse>("/api/auth/me", { cache: "no-store" })
      .then(async ({ data }) => {
        if (canceled) return;
        if (data?.authenticated) {
          const user = data.user;
          if (!user || (user.role !== "teacher" && user.role !== "admin")) {
            router.replace("/login");
            return;
          }
          setLoginUser(user.username);
          setLoginName(user.name ?? "");
          setLoginSchool(user.school ?? "");
          setAuthError("");
          if (user.role === "admin") {
            setLoginRole("admin");
            if (!isAdminConsole) {
              router.replace("/admin");
              setAuthReady(true);
              return;
            }
          } else {
            setLoginRole("teacher");
            if (isAdminConsole) {
              router.replace("/teacher");
              setAuthReady(true);
              return;
            }
          }
          setAuthReady(true);
          await refreshAll();
        } else {
          router.replace("/login");
        }
      })
      .catch((error) => {
        if (canceled) return;
        setLoginUser("");
        if (error instanceof ClientFetchError && error.status === 401) {
          router.replace("/login");
          return;
        }
        setAuthError(getManagementRetryableMessage("auth"));
        setAuthReady(true);
      });
    return () => {
      canceled = true;
    };
  }, [authRetryNonce, isAdminConsole, refreshAll, router]);

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

  if (!authReady) {
    return (
      <main>
        <div className="card card-info" role="status" aria-live="polite">
          <h2>正在確認登入狀態</h2>
          <small>系統正在連線，請稍候...</small>
        </div>
      </main>
    );
  }

  if (authError && !loginUser) {
    return (
      <main>
        <div className="card card-danger" role="alert" aria-live="assertive">
          <h2>暫時無法進入{isAdminConsole ? "管理端" : "教師端"}</h2>
          <small>{authError}</small>
          <div className="row" style={{ marginTop: 12 }}>
            <div style={{ width: 180 }}>
              <button
                type="button"
                onClick={() => {
                  setAuthReady(false);
                  setAuthError("");
                  setAuthRetryNonce((value) => value + 1);
                }}
              >
                重新確認登入
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

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

      {isRefreshing ? (
        <div className="card card-info" role="status" aria-live="polite">
          <small>正在載入管理資料，請稍候...</small>
        </div>
      ) : null}

      {error ? (
        <div className="card card-danger" role="alert" aria-live="assertive">
          <small>{error}</small>
          <div className="row" style={{ marginTop: 12 }}>
            <div style={{ width: 180 }}>
              <button type="button" className="secondary" onClick={() => refreshAll()}>
                重新整理
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
