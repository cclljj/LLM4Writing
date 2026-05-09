"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ActivityGroup, ActivityRow, EssayRow, OpenClassRow, UserRow, genreOptions } from "./types";

interface CourseManagementTabProps {
  loginRole: "teacher" | "admin";
  loginUser: string;
  isAdminConsole: boolean;
  activities: ActivityRow[];
  setActivities: (updater: ActivityRow[] | ((prev: ActivityRow[]) => ActivityRow[])) => void;
  essays: EssayRow[];
  setEssays: (updater: EssayRow[] | ((prev: EssayRow[]) => EssayRow[])) => void;
  openClasses: OpenClassRow[];
  users: UserRow[];
  schoolOptions: string[];
  teacherUsers: UserRow[];
  error: string;
  setError: (e: string) => void;
  onRefresh: () => Promise<void>;
}

const TASK_LIST_PAGE_SIZE = 10;

export default function CourseManagementTab({
  loginRole,
  loginUser,
  activities,
  setActivities,
  essays,
  setEssays,
  openClasses,
  users,
  error,
  setError,
  onRefresh,
}: CourseManagementTabProps) {
  // ── 子分頁（#253） ────────────────────────────
  // admin 預設「寫作主題設定」；教師沒有主題設定權限，預設且唯一選項為「寫作任務設定」
  type SubTab = "essay" | "task";
  const [subTab, setSubTab] = useState<SubTab>(loginRole === "admin" ? "essay" : "task");

  // 若 loginRole 變動（例如資料重新載入後角色更新），確保非 admin 不會卡在 essay 分頁
  useEffect(() => {
    if (loginRole !== "admin" && subTab === "essay") {
      setSubTab("task");
    }
  }, [loginRole, subTab]);

  // ── 寫作主題管理（admin only，保留原邏輯） ────────────────────────────
  const [essayForm, setEssayForm] = useState({
    id: "",
    title: "",
    genre: "議論文",
    description: "",
    enabled: true
  });

  // ── 增修寫作任務（合併 openClass + 分組） ───────────────────────────
  const [taskForm, setTaskForm] = useState({
    id: "",
    school: "", // admin 才會用到；teacher 會自動填入自己的學校
    classNumber: "",
    essayId: "",
    durationMinutes: 40,
    supplemental: ""
  });
  const [editableGroups, setEditableGroups] = useState<ActivityGroup[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<string[]>([]);
  const [groupCount, setGroupCount] = useState(2);

  // ── 寫作任務管理（list 篩選 + 分頁） ────────────────────────────────
  const [listSchoolFilter, setListSchoolFilter] = useState<string>("all");
  const [listClassFilter, setListClassFilter] = useState<string>("all");
  const [listPage, setListPage] = useState(1);

  // 儲存任務 UX 狀態（#255）
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [savingMessage, setSavingMessage] = useState<string>("");
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string>("");
  // 刪除任務 UX 狀態（#257）：追蹤目前正在刪除的 activityId，提供按鈕 disabled 與提示
  const [deletingTaskId, setDeletingTaskId] = useState<string>("");

  const taskFormRef = useRef<HTMLDivElement | null>(null);

  // 教師自己的學校（從 users 中查）
  const teacherSchool = useMemo(() => {
    if (loginRole !== "teacher") return "";
    return users.find((u) => u.username === loginUser)?.school ?? "";
  }, [loginRole, loginUser, users]);

  // form 取得當前用於分組的學校（admin = taskForm.school；teacher = teacherSchool）
  const currentFormSchool = loginRole === "admin" ? taskForm.school : teacherSchool;

  // 學校選單（admin form 用）：所有有學生的學校
  const allSchools = useMemo(() => {
    return Array.from(
      new Set(users.filter((u) => u.role === "student" && u.school).map((u) => u.school))
    ).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }, [users]);

  // 班級選單（依 currentFormSchool 過濾）
  const classOptionsForForm = useMemo(() => {
    if (!currentFormSchool) return [];
    return Array.from(
      new Set(
        users
          .filter((u) => u.role === "student" && u.school === currentFormSchool && u.classNumber)
          .map((u) => u.classNumber!)
      )
    ).sort();
  }, [users, currentFormSchool]);

  // Derive bound teacher (姓名 + 帳號) for the currently selected school+class (#254).
  // Counts ownerTeacherUsername among that class's students; picks the most common.
  const formOwnerTeacher = useMemo<{ username: string; name: string } | null>(() => {
    if (!currentFormSchool || !taskForm.classNumber) return null;
    const classStudents = users.filter(
      (u) => u.role === "student" && u.school === currentFormSchool && u.classNumber === taskForm.classNumber
    );
    const counts = new Map<string, number>();
    for (const s of classStudents) {
      const t = s.ownerTeacherUsername;
      if (!t) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    let best: string | undefined;
    let bestCount = 0;
    for (const [t, c] of counts) {
      if (c > bestCount) {
        best = t;
        bestCount = c;
      }
    }
    if (!best) return null;
    const teacherUser = users.find((u) => u.username === best);
    return { username: best, name: teacherUser?.name ?? best };
  }, [users, currentFormSchool, taskForm.classNumber]);

  // 列表篩選用：admin 學校選單 = 已有任務的學校
  const listSchoolOptions = useMemo(() => {
    return Array.from(new Set(openClasses.map((o) => o.school))).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }, [openClasses]);

  // 列表篩選用：admin 班級選單 = 該校已有任務的班級
  const listClassOptions = useMemo(() => {
    if (listSchoolFilter === "all") return [];
    return Array.from(
      new Set(openClasses.filter((o) => o.school === listSchoolFilter).map((o) => o.classNumber))
    ).sort();
  }, [openClasses, listSchoolFilter]);

  // 過濾後的任務列表
  const filteredOpenClasses = useMemo(() => {
    let list = openClasses;
    if (loginRole === "teacher") {
      // 教師：僅看自己學校的任務
      list = list.filter((o) => o.school === teacherSchool);
    } else {
      if (listSchoolFilter !== "all") list = list.filter((o) => o.school === listSchoolFilter);
      if (listClassFilter !== "all") list = list.filter((o) => o.classNumber === listClassFilter);
    }
    // 由新到舊：id 為 oc-XXX 序號格式，desc 即新到舊
    return list.slice().sort((a, b) => b.id.localeCompare(a.id));
  }, [openClasses, loginRole, teacherSchool, listSchoolFilter, listClassFilter]);

  const totalListPages = Math.max(1, Math.ceil(filteredOpenClasses.length / TASK_LIST_PAGE_SIZE));
  const pagedOpenClasses = useMemo(() => {
    const start = (listPage - 1) * TASK_LIST_PAGE_SIZE;
    return filteredOpenClasses.slice(start, start + TASK_LIST_PAGE_SIZE);
  }, [filteredOpenClasses, listPage]);

  useEffect(() => {
    setListPage(1);
  }, [listSchoolFilter, listClassFilter]);

  useEffect(() => {
    if (listPage > totalListPages) setListPage(totalListPages);
  }, [listPage, totalListPages]);

  // 切換 admin 學校篩選時重置班級
  useEffect(() => {
    setListClassFilter("all");
  }, [listSchoolFilter]);

  // 當 admin 切換 form 學校時，重置班級
  useEffect(() => {
    if (loginRole !== "admin") return;
    if (!taskForm.id) {
      // 只有在新建模式下重置（編輯時學校固定）
      setTaskForm((prev) => ({ ...prev, classNumber: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskForm.school, loginRole]);

  // 班級號碼變更時（且非編輯模式）：載入該班學生並初始化分組
  useEffect(() => {
    if (taskForm.id) return; // 編輯模式由 startEditTask 處理
    if (!taskForm.classNumber) {
      setUnassignedStudents([]);
      setEditableGroups([]);
      return;
    }
    const studentsForClass = users
      .filter((u) => u.role === "student" && u.school === currentFormSchool && u.classNumber === taskForm.classNumber)
      .map((u) => u.username);
    setUnassignedStudents(studentsForClass);
    setEditableGroups(buildEmptyGroups(groupCount));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskForm.classNumber, currentFormSchool]);

  // 動態調整小組數量（#252）：useEffect 讓 editableGroups 隨 groupCount 增減
  // 增加時 → 補空組
  // 減少時 → 把超出範圍的小組移除，其成員回到「未分配學生」
  useEffect(() => {
    if (!taskForm.classNumber) return; // 尚未選班級時不動
    const safeCount = Math.max(1, groupCount);
    setEditableGroups((prev) => {
      if (prev.length === safeCount) return prev;
      if (prev.length < safeCount) {
        const additions: ActivityGroup[] = [];
        for (let i = prev.length; i < safeCount; i += 1) {
          additions.push({ groupId: `g${i + 1}`, groupName: String(i + 1), members: [] });
        }
        return [...prev, ...additions];
      }
      // 縮減：把被移除小組的成員放回未分配
      const kept = prev.slice(0, safeCount);
      const removed = prev.slice(safeCount);
      const displaced = removed.flatMap((g) => g.members);
      if (displaced.length > 0) {
        setUnassignedStudents((u) => Array.from(new Set([...u, ...displaced])));
      }
      return kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupCount, taskForm.classNumber]);

  function buildEmptyGroups(count: number): ActivityGroup[] {
    const safeCount = Math.max(1, count);
    return Array.from({ length: safeCount }, (_, idx) => ({
      groupId: `g${idx + 1}`,
      groupName: String(idx + 1),
      members: []
    }));
  }

  function resetTaskForm() {
    setTaskForm({
      id: "",
      school: "",
      classNumber: "",
      essayId: "",
      durationMinutes: 40,
      supplemental: ""
    });
    setEditableGroups([]);
    setUnassignedStudents([]);
    setGroupCount(2);
  }

  function getStudentsForClass(school: string, classNumber: string): string[] {
    return users
      .filter((u) => u.role === "student" && u.school === school && u.classNumber === classNumber)
      .map((u) => u.username);
  }

  // Delete task entirely (#254). Only callable when no student activity exists yet.
  // Reuses the existing /api/admin/activities DELETE endpoint, which removes
  // the openClass, its groups, and any related sessions.
  async function deleteTask(openClass: OpenClassRow) {
    setError("");
    setSavedSuccessMessage("");
    const confirmed = window.confirm(
      `確定刪除寫作任務「${openClass.essayTitle} / ${openClass.school} ${openClass.classNumber}」嗎？\n此操作無法復原。`
    );
    if (!confirmed) return;
    setDeletingTaskId(openClass.id);
    setSavingMessage(`正在刪除任務 ${openClass.id}，請稍候...`);
    setIsSavingTask(true); // 重用既有 banner 樣式 (#255)
    try {
      const response = await fetch("/api/admin/activities", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: openClass.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = data?.error;
        const friendly =
          code === "not_owner"
            ? "你不是這份任務的綁定教師，無法刪除。"
            : code === "task_has_student_activity"
              ? "此任務已有學生操作紀錄，無法刪除。"
              : code === "activity_not_found"
                ? "找不到此任務（可能已被其他人刪除）。"
                : (code ?? "delete_task_failed");
        setError(friendly);
        return;
      }
      // Reset form if we were editing this task
      if (taskForm.id === openClass.id) {
        resetTaskForm();
      }
      setSavingMessage("正在重新整理列表，請稍候...");
      await onRefresh();
      setSavedSuccessMessage(`已成功刪除任務 ${openClass.id}。`);
      window.setTimeout(() => setSavedSuccessMessage(""), 5000);
    } finally {
      setDeletingTaskId("");
      setIsSavingTask(false);
      setSavingMessage("");
    }
  }

  function startEditTask(openClass: OpenClassRow) {
    setError("");
    const activity = activities.find((a) => a.id === openClass.id);
    setTaskForm({
      id: openClass.id,
      school: openClass.school,
      classNumber: openClass.classNumber,
      essayId: openClass.essayId,
      durationMinutes: openClass.durationMinutes,
      supplemental: openClass.supplemental
    });
    if (activity) {
      const groups = activity.groups.map((g) => ({ ...g, members: [...g.members] }));
      setEditableGroups(groups);
      setGroupCount(Math.max(1, groups.length || 2));
      const candidates = activity.studentCandidates ?? getStudentsForClass(openClass.school, openClass.classNumber);
      const assigned = new Set(groups.flatMap((g) => g.members));
      setUnassignedStudents(candidates.filter((u) => !assigned.has(u)));
    } else {
      const candidates = getStudentsForClass(openClass.school, openClass.classNumber);
      setEditableGroups(buildEmptyGroups(2));
      setGroupCount(2);
      setUnassignedStudents(candidates);
    }
    window.setTimeout(() => {
      taskFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function cancelEditTask() {
    resetTaskForm();
    setError("");
  }

  function randomAssignGroups() {
    const candidates = [
      ...unassignedStudents,
      ...editableGroups.flatMap((g) => g.members)
    ];
    if (candidates.length === 0) {
      setError("此班級沒有可分配的學生。");
      return;
    }
    const safeCount = Math.max(1, groupCount);
    const pool = [...candidates].sort(() => Math.random() - 0.5);
    const nextGroups = buildEmptyGroups(safeCount);
    pool.forEach((username, idx) => {
      nextGroups[idx % safeCount]?.members.push(username);
    });
    setEditableGroups(nextGroups);
    setUnassignedStudents([]);
    setError("");
  }

  function initEmptyGroups() {
    const candidates = [
      ...unassignedStudents,
      ...editableGroups.flatMap((g) => g.members)
    ];
    setEditableGroups(buildEmptyGroups(groupCount));
    setUnassignedStudents(candidates);
    setError("");
  }

  function removeGroup(groupId: string) {
    const removed = editableGroups.find((g) => g.groupId === groupId);
    if (removed && removed.members.length > 0) {
      setUnassignedStudents((prev) => Array.from(new Set([...prev, ...removed.members])));
    }
    setEditableGroups((prev) => prev.filter((g) => g.groupId !== groupId));
  }

  function onDragStart(username: string, sourceGroupId: string) {
    return (event: DragEvent) => {
      event.dataTransfer.setData("application/json", JSON.stringify({ username, sourceGroupId }));
      event.dataTransfer.effectAllowed = "move";
    };
  }

  function removeFromSource(username: string, sourceGroupId: string) {
    if (sourceGroupId === "unassigned") {
      setUnassignedStudents((prev) => prev.filter((item) => item !== username));
      return;
    }
    setEditableGroups((prev) =>
      prev.map((g) =>
        g.groupId === sourceGroupId ? { ...g, members: g.members.filter((m) => m !== username) } : g
      )
    );
  }

  function dropToGroup(targetGroupId: string) {
    return (event: DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/json");
      if (!raw) return;
      const { username, sourceGroupId } = JSON.parse(raw) as { username: string; sourceGroupId: string };
      removeFromSource(username, sourceGroupId);
      setEditableGroups((prev) =>
        prev.map((g) => {
          if (g.groupId !== targetGroupId) return g;
          if (g.members.includes(username)) return g;
          return { ...g, members: [...g.members, username] };
        })
      );
    };
  }

  function dropToUnassigned(event: DragEvent) {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return;
    const { username, sourceGroupId } = JSON.parse(raw) as { username: string; sourceGroupId: string };
    removeFromSource(username, sourceGroupId);
    setUnassignedStudents((prev) => (prev.includes(username) ? prev : [...prev, username]));
  }

  // 儲存：先存 openClass、再存 groups、最後 refresh
  async function saveTaskWithGroups(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSavedSuccessMessage("");

    if (loginRole === "admin" && !taskForm.school) {
      setError("請選擇學校。");
      return;
    }
    if (!taskForm.classNumber) {
      setError("請選擇班級號碼。");
      return;
    }
    if (!taskForm.essayId) {
      setError("請選擇主題。");
      return;
    }
    if (!taskForm.durationMinutes || taskForm.durationMinutes <= 0) {
      setError("請輸入有效的時長（分鐘）。");
      return;
    }
    if (editableGroups.length === 0) {
      setError("請設定至少一組分組。");
      return;
    }
    if (unassignedStudents.length > 0) {
      setError(`尚有 ${unassignedStudents.length} 位學生未分配，無法儲存。請完成分配後再送出。`);
      return;
    }

    const isEditing = Boolean(taskForm.id);
    setIsSavingTask(true);
    setSavingMessage(isEditing ? "正在儲存任務變更，請稍候..." : "正在新增寫作任務並寫入資料庫，請稍候...");
    try {
      const ocPayload: Record<string, unknown> = {
        id: taskForm.id || undefined,
        classNumber: taskForm.classNumber,
        essayId: taskForm.essayId,
        durationMinutes: taskForm.durationMinutes,
        supplemental: taskForm.supplemental ?? ""
      };
      if (loginRole === "admin") {
        ocPayload.school = taskForm.school;
        if (formOwnerTeacher?.username) {
          ocPayload.ownerTeacherUsername = formOwnerTeacher.username;
        }
      }
      const ocResponse = await fetch("/api/admin/openclasses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ocPayload)
      });
      const ocData = await ocResponse.json();
      if (!ocResponse.ok) {
        if (ocData.error === "essay_disabled") {
          setError("此主題已停用，無法建立新的寫作任務。");
        } else if (ocData.error === "duplicate_class_essay_assignment") {
          setError("此班級已被指派相同的寫作主題，無法重複指派。");
        } else {
          setError(ocData.error ?? "save_openclass_failed");
        }
        return;
      }
      const savedActivityId = (ocData?.saved as { id?: string })?.id;
      if (!savedActivityId) {
        setError("save_openclass_failed");
        return;
      }
      // 存分組
      setSavingMessage("正在儲存小組分配，請稍候...");
      const grpResponse = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: savedActivityId, groups: editableGroups })
      });
      const grpData = await grpResponse.json();
      if (!grpResponse.ok) {
        setError(grpData.error ?? "save_groups_failed");
        return;
      }
      const updatedActivity = grpData.updated as ActivityRow;
      setActivities((prev) => {
        const idx = prev.findIndex((a) => a.id === updatedActivity.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...updatedActivity, studentCandidates: prev[idx]!.studentCandidates ?? updatedActivity.studentCandidates };
          return next;
        }
        return [...prev, updatedActivity];
      });
      setSavingMessage("正在重新整理列表，請稍候...");
      resetTaskForm();
      await onRefresh();
      setSavedSuccessMessage(
        isEditing
          ? `已成功更新任務 ${savedActivityId}。`
          : `已成功新增任務 ${savedActivityId}，下方列表已更新。`
      );
      // 5 秒後自動清除成功提示
      window.setTimeout(() => setSavedSuccessMessage(""), 5000);
    } catch {
      setError("save_failed");
    } finally {
      setIsSavingTask(false);
      setSavingMessage("");
    }
  }

  // ── 寫作主題管理 handlers（admin only） ───────────────────────────
  async function saveEssay(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!essayForm.title.trim() || !essayForm.genre.trim() || !essayForm.description.trim()) {
      setError("寫作主題基本欄位未填完整");
      return;
    }
    try {
      const essayResponse = await fetch("/api/admin/essays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: essayForm.id || undefined,
          title: essayForm.title,
          genre: essayForm.genre,
          description: essayForm.description,
          enabled: essayForm.enabled
        })
      });
      const essayData = await essayResponse.json();
      if (!essayResponse.ok) {
        setError(essayData.error ?? "save_essay_failed");
        return;
      }
      const savedEssay = essayData?.saved as EssayRow | undefined;
      if (!savedEssay?.id) {
        setError("save_essay_failed");
        return;
      }
      setEssays((prev) => {
        const idx = prev.findIndex((item) => item.id === savedEssay.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = savedEssay;
          return next;
        }
        return [...prev, savedEssay];
      });
      setEssayForm({ id: "", title: "", genre: "議論文", description: "", enabled: true });
      onRefresh().catch(() => undefined);
    } catch {
      setError("save_essay_failed");
    }
  }

  function startEditEssay(essay: EssayRow) {
    setError("");
    setEssayForm({
      id: essay.id,
      title: essay.title,
      genre: essay.genre,
      description: essay.description,
      enabled: essay.enabled
    });
  }

  async function toggleEssayEnabled(essay: EssayRow, enabled: boolean) {
    setError("");
    const response = await fetch("/api/admin/essays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: essay.id,
        title: essay.title,
        genre: essay.genre,
        description: essay.description,
        enabled
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "toggle_essay_enabled_failed");
      return;
    }
    await onRefresh();
  }

  // class option label format: "xx國中 801"
  function formatClassOption(school: string, classNumber: string): string {
    return `${school} ${classNumber}`;
  }

  return (
    <>
      {/* 子分頁切換（#253） */}
      <div className="card row">
        {loginRole === "admin" ? (
          <div style={{ width: 200 }}>
            <button type="button" className={subTab === "essay" ? "" : "secondary"} onClick={() => setSubTab("essay")}>
              寫作主題設定
            </button>
          </div>
        ) : null}
        <div style={{ width: 200 }}>
          <button type="button" className={subTab === "task" ? "" : "secondary"} onClick={() => setSubTab("task")}>
            寫作任務設定
          </button>
        </div>
      </div>

      {/* 寫作主題管理（admin only） */}
      {subTab === "essay" && loginRole === "admin" ? (
        <div className="card">
          <h2>寫作主題管理</h2>
          <small>Prompt 與問題庫改由系統參數 JSON 管理；此處僅維護主題資料。</small>
          <form onSubmit={saveEssay} className="row">
            <div className="col">
              <label>標題</label>
              <input value={essayForm.title} onChange={(e) => setEssayForm({ ...essayForm, title: e.target.value })} />
            </div>
            <div className="col">
              <label>文體</label>
              <select value={essayForm.genre} onChange={(e) => setEssayForm({ ...essayForm, genre: e.target.value })}>
                {genreOptions.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col">
              <label>引導說明</label>
              <textarea
                rows={6}
                value={essayForm.description}
                onChange={(e) => setEssayForm({ ...essayForm, description: e.target.value })}
              />
            </div>
            <div className="col" style={{ alignSelf: "end" }}>
              <button type="submit">{essayForm.id ? "儲存主題" : "新增主題"}</button>
            </div>
            {essayForm.id ? (
              <div className="col" style={{ alignSelf: "end" }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEssayForm({ id: "", title: "", genre: "議論文", description: "", enabled: true })}
                >
                  取消編輯
                </button>
              </div>
            ) : null}
          </form>
          {essayForm.id ? <small>目前正在編輯：{essayForm.id}</small> : null}
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="pro-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>主題</th>
                  <th>文體</th>
                  <th>引導說明</th>
                  <th style={{ width: 140 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {essays.map((essay) => (
                  <tr key={essay.id}>
                    <td>{essay.id}</td>
                    <td>{essay.title}</td>
                    <td>{essay.genre}</td>
                    <td>{essay.description || "—"}</td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <button type="button" className="secondary" style={{ width: "auto" }} onClick={() => startEditEssay(essay)}>
                          編輯
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          style={{
                            width: "auto",
                            background: essay.enabled ? "#f3f4f6" : undefined,
                            color: essay.enabled ? "#9ca3af" : undefined,
                            borderColor: essay.enabled ? "#e5e7eb" : undefined,
                            cursor: essay.enabled ? "not-allowed" : undefined
                          }}
                          disabled={essay.enabled}
                          onClick={() => toggleEssayEnabled(essay, true)}
                        >
                          啟用
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          style={{
                            width: "auto",
                            background: !essay.enabled ? "#f3f4f6" : undefined,
                            color: !essay.enabled ? "#9ca3af" : undefined,
                            borderColor: !essay.enabled ? "#e5e7eb" : undefined,
                            cursor: !essay.enabled ? "not-allowed" : undefined
                          }}
                          disabled={!essay.enabled}
                          onClick={() => toggleEssayEnabled(essay, false)}
                        >
                          停用
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* 寫作任務設定（增修寫作任務 + 寫作任務管理） */}
      {subTab === "task" ? (
        <>
      {/* 增修寫作任務 */}
      <div className="card" ref={taskFormRef}>
        <h2>{taskForm.id ? "增修寫作任務（編輯中）" : "增修寫作任務"}</h2>
        <h3 style={{ margin: "0 0 6px" }}>文章設定</h3>
        <form onSubmit={saveTaskWithGroups} className="row">
          {loginRole === "admin" ? (
            <div className="col">
              <label>學校</label>
              <select
                value={taskForm.school}
                onChange={(e) => setTaskForm({ ...taskForm, school: e.target.value })}
                disabled={Boolean(taskForm.id)}
              >
                <option value="">請選擇學校</option>
                {allSchools.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="col">
            <label>班級號碼（{loginRole === "admin" ? "依選定學校過濾" : "由教師所屬學校帶入"}）</label>
            <select
              value={taskForm.classNumber}
              onChange={(e) => setTaskForm({ ...taskForm, classNumber: e.target.value })}
              disabled={Boolean(taskForm.id) || (loginRole === "admin" && !taskForm.school)}
            >
              <option value="">請選擇</option>
              {classOptionsForForm.map((cn) => (
                <option key={cn} value={cn}>
                  {formatClassOption(currentFormSchool, cn)}
                </option>
              ))}
            </select>
            {/* Bound teacher display (#254) — shown for admin once class is selected. */}
            {loginRole === "admin" && taskForm.classNumber ? (
              <small style={{ display: "block", marginTop: 4, color: formOwnerTeacher ? "#475569" : "#b91c1c" }}>
                {formOwnerTeacher
                  ? `綁定教師：${formOwnerTeacher.name} (${formOwnerTeacher.username})`
                  : "綁定教師：找不到此班學生的綁定教師，請先在帳號管理為學生指派教師。"}
              </small>
            ) : null}
          </div>
          <div className="col">
            <label>主題（含 ID）</label>
            <select
              value={taskForm.essayId}
              onChange={(e) => setTaskForm({ ...taskForm, essayId: e.target.value })}
            >
              <option value="">請選擇</option>
              {essays
                .filter((essay) => essay.enabled || essay.id === taskForm.essayId)
                .map((essay) => (
                  <option key={essay.id} value={essay.id}>
                    {essay.id} / {essay.title}
                  </option>
                ))}
            </select>
          </div>
          <div className="col">
            <label>時長 (分鐘)</label>
            <input
              type="number"
              min={1}
              value={taskForm.durationMinutes}
              onChange={(e) => setTaskForm({ ...taskForm, durationMinutes: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="col">
            <label>補充資料</label>
            <textarea
              rows={4}
              value={taskForm.supplemental}
              onChange={(e) => setTaskForm({ ...taskForm, supplemental: e.target.value })}
            />
          </div>
        </form>

        {/* 分組區（選定班級後出現） */}
        {taskForm.classNumber ? (
          <>
            <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "12px 0" }} />
            <h3 style={{ margin: "0 0 6px" }}>小組分配</h3>
            <div className="row">
              <div className="col">
                <label>小組數量</label>
                <input
                  type="number"
                  min={1}
                  value={groupCount}
                  onChange={(e) => setGroupCount(Number(e.target.value) || 1)}
                />
              </div>
              <div className="col" style={{ alignSelf: "end" }}>
                <div className="row">
                  <div style={{ width: 140 }}>
                    <button type="button" className="secondary" onClick={randomAssignGroups}>
                      隨機平均分組
                    </button>
                  </div>
                  <div style={{ width: 140 }}>
                    <button type="button" className="secondary" onClick={initEmptyGroups}>
                      先建空組
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <small>
              目前未分配學生：{unassignedStudents.length} 人（為 0 時才可儲存任務）
            </small>
            <div className="row" style={{ marginTop: 12 }}>
              <div
                className="col"
                style={{ minHeight: 120, border: "1px dashed #94a3b8", borderRadius: 8, padding: 10 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={dropToUnassigned}
              >
                <strong>未分配學生</strong>
                {unassignedStudents.map((username) => (
                  <div
                    key={username}
                    draggable
                    onDragStart={onDragStart(username, "unassigned")}
                    style={{ padding: "6px 8px", marginTop: 6, border: "1px solid #cbd5e1", borderRadius: 6 }}
                  >
                    {username}
                  </div>
                ))}
              </div>
              {editableGroups.map((group) => (
                <div
                  key={group.groupId}
                  className="col"
                  style={{ minHeight: 120, border: "1px dashed #94a3b8", borderRadius: 8, padding: 10 }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={dropToGroup(group.groupId)}
                >
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <strong>組別 {group.groupName}</strong>
                    {group.members.length === 0 ? (
                      <button
                        type="button"
                        className="secondary"
                        style={{ width: "auto", minWidth: 36, padding: "4px 8px" }}
                        onClick={() => removeGroup(group.groupId)}
                      >
                        x
                      </button>
                    ) : null}
                  </div>
                  {group.members.map((username) => (
                    <div
                      key={username}
                      draggable
                      onDragStart={onDragStart(username, group.groupId)}
                      style={{ padding: "6px 8px", marginTop: 6, border: "1px solid #cbd5e1", borderRadius: 6 }}
                    >
                      {username}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div className="row" style={{ marginTop: 12, gap: 10 }}>
          <div style={{ width: 200 }}>
            <button
              type="button"
              onClick={saveTaskWithGroups}
              disabled={isSavingTask}
              style={
                isSavingTask
                  ? { background: "#f3f4f6", color: "#9ca3af", borderColor: "#e5e7eb", cursor: "wait" }
                  : undefined
              }
            >
              {isSavingTask ? "處理中..." : taskForm.id ? "儲存班級任務" : "新增班級任務"}
            </button>
          </div>
          {taskForm.id ? (
            <div style={{ width: 140 }}>
              <button type="button" className="secondary" onClick={cancelEditTask} disabled={isSavingTask}>
                取消編輯
              </button>
            </div>
          ) : null}
          {/* 儲存中提示 (#255) — 顯眼藍色提示，告知使用者系統處理中 */}
          {isSavingTask ? (
            <div className="col" style={{ width: "100%" }}>
              <div
                style={{
                  marginTop: 6,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#1e40af",
                  fontWeight: 600
                }}
              >
                {savingMessage || "系統處理中，請稍候..."}
              </div>
            </div>
          ) : null}
          {/* 儲存成功提示 (#255) — 5 秒後自動消失 */}
          {!isSavingTask && savedSuccessMessage ? (
            <div className="col" style={{ width: "100%" }}>
              <div
                style={{
                  marginTop: 6,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #bbf7d0",
                  background: "#f0fdf4",
                  color: "#166534",
                  fontWeight: 600
                }}
              >
                {savedSuccessMessage}
              </div>
            </div>
          ) : null}
          {error ? (
            <div className="col" style={{ width: "100%" }}>
              <small style={{ color: "#b91c1c" }}>{error}</small>
            </div>
          ) : null}
        </div>
      </div>

      {/* 寫作任務管理（list） */}
      <div className="card">
        <h2>寫作任務管理</h2>
        {loginRole === "admin" ? (
          <div className="row" style={{ marginBottom: 8 }}>
            <div className="col">
              <label>學校</label>
              <select value={listSchoolFilter} onChange={(e) => setListSchoolFilter(e.target.value)}>
                <option value="all">全部</option>
                {listSchoolOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="col">
              <label>班級</label>
              <select
                value={listClassFilter}
                onChange={(e) => setListClassFilter(e.target.value)}
                disabled={listSchoolFilter === "all"}
              >
                <option value="all">全部</option>
                {listClassOptions.map((cn) => (
                  <option key={cn} value={cn}>
                    {cn}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
        <div style={{ overflowX: "auto" }}>
          <table className="pro-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>學校</th>
                <th>班級</th>
                <th>主題</th>
                <th>時長 (分鐘)</th>
                <th>補充資料</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedOpenClasses.map((openClass) => (
                <tr key={openClass.id}>
                  <td>{openClass.id}</td>
                  <td>{openClass.school}</td>
                  <td>{openClass.classNumber}</td>
                  <td>{openClass.essayTitle}</td>
                  <td>{openClass.durationMinutes}</td>
                  <td>{openClass.supplemental || "—"}</td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <button type="button" className="secondary" style={{ width: "auto" }} onClick={() => startEditTask(openClass)}>
                        編輯
                      </button>
                      {/* 刪除按鈕（#254）：僅在尚無學生操作紀錄時顯示。
                           顏色與「帳號管理」的「刪除」按鈕一致。
                           處理中時 disabled 並顯示「處理中...」(#257) */}
                      {!openClass.hasStudentActivity ? (
                        <button
                          type="button"
                          className="secondary"
                          style={{
                            width: "auto",
                            color: "#b91c1c",
                            borderColor: "#fecaca",
                            background: "#fef2f2",
                            opacity: deletingTaskId === openClass.id ? 0.6 : 1,
                            cursor: deletingTaskId === openClass.id ? "wait" : undefined
                          }}
                          onClick={() => deleteTask(openClass)}
                          disabled={Boolean(deletingTaskId) || isSavingTask}
                        >
                          {deletingTaskId === openClass.id ? "處理中..." : "刪除"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredOpenClasses.length === 0 ? (
          <small style={{ display: "block", marginTop: 8 }}>目前沒有符合條件的寫作任務。</small>
        ) : null}
        {/* 分頁控制 */}
        {filteredOpenClasses.length > 0 ? (
          <div className="row" style={{ marginTop: 10, alignItems: "center", gap: 8 }}>
            <div style={{ width: 100 }}>
              <button
                type="button"
                className="secondary"
                disabled={listPage <= 1}
                onClick={() => setListPage((p) => Math.max(1, p - 1))}
              >
                上一頁
              </button>
            </div>
            <small>
              第 {listPage} / {totalListPages} 頁（共 {filteredOpenClasses.length} 筆）
            </small>
            <div style={{ width: 100 }}>
              <button
                type="button"
                className="secondary"
                disabled={listPage >= totalListPages}
                onClick={() => setListPage((p) => Math.min(totalListPages, p + 1))}
              >
                下一頁
              </button>
            </div>
          </div>
        ) : null}
      </div>
        </>
      ) : null}
    </>
  );
}
