"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ActivityGroup, ActivityRow, CourseTab, EssayRow, OpenClassRow, UserRow, genreOptions } from "./types";

interface CourseManagementTabProps {
  loginRole: "teacher" | "admin";
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

export default function CourseManagementTab({
  loginRole,
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
  const [courseTab, setCourseTab] = useState<CourseTab>("openclass");
  const [essayForm, setEssayForm] = useState({
    id: "",
    title: "",
    genre: "議論文",
    description: "",
    enabled: true
  });
  const [openClassForm, setOpenClassForm] = useState({
    id: "",
    classNumber: "",
    essayId: "",
    durationMinutes: 40,
    supplemental: ""
  });
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [editableGroups, setEditableGroups] = useState<ActivityGroup[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<string[]>([]);
  const [groupCount, setGroupCount] = useState(2);

  const classOptions = useMemo(
    () =>
      Array.from(
        new Set(
          users
            .filter((user) => user.role === "student")
            .map((user) => user.classNumber)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [users]
  );

  const selectedGroupActivity = useMemo(
    () => activities.find((activity) => activity.id === selectedActivityId),
    [activities, selectedActivityId]
  );

  const hasExistingGrouping = useMemo(
    () => (selectedGroupActivity?.groups.length ?? 0) > 0,
    [selectedGroupActivity]
  );

  const canSaveGroups = useMemo(
    () => Boolean(selectedActivityId) && editableGroups.length > 0 && unassignedStudents.length === 0,
    [selectedActivityId, editableGroups.length, unassignedStudents.length]
  );

  useEffect(() => {
    if (loginRole !== "admin" && courseTab === "essay") {
      setCourseTab("openclass");
    }
  }, [courseTab, loginRole]);

  useEffect(() => {
    if (!selectedActivityId || activities.length === 0) return;
    const activity = activities.find((item) => item.id === selectedActivityId);
    if (!activity) return;
    resetGroupDraft(activity);
  }, [selectedActivityId, activities]);

  function buildEmptyGroups(count: number): ActivityGroup[] {
    const safeCount = Math.max(1, count);
    return Array.from({ length: safeCount }, (_, idx) => ({
      groupId: `g${idx + 1}`,
      groupName: String(idx + 1),
      members: []
    }));
  }

  function resetGroupDraft(activity: ActivityRow) {
    const nextGroups = activity.groups.map((group) => ({ ...group, members: [...group.members] }));
    setEditableGroups(nextGroups);
    setGroupCount(activity.groups.length > 0 ? Math.max(1, activity.groups.length) : 2);
    const assigned = new Set(nextGroups.flatMap((group) => group.members));
    const candidates = activity.studentCandidates ?? [];
    setUnassignedStudents(candidates.filter((username) => !assigned.has(username)));
  }

  function resetAllStudentsToUnassigned() {
    if (!selectedGroupActivity) return [];
    const candidates = selectedGroupActivity.studentCandidates ?? [];
    setUnassignedStudents(candidates);
    return candidates;
  }

  function initializeGroupsForDrag() {
    const candidates = resetAllStudentsToUnassigned();
    if (!selectedGroupActivity) return;
    setEditableGroups(buildEmptyGroups(groupCount));
    if (candidates.length === 0) {
      setError("此任務沒有可分配的學生。");
      return;
    }
    setError("");
  }

  function randomAssignGroups() {
    const candidates = resetAllStudentsToUnassigned();
    if (!selectedGroupActivity) return;
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

  function cancelGroupEdits() {
    if (!selectedGroupActivity) return;
    resetGroupDraft(selectedGroupActivity);
    setError("");
  }

  function removeGroup(groupId: string) {
    setEditableGroups((prev) => prev.filter((group) => group.groupId !== groupId));
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
      prev.map((group) =>
        group.groupId === sourceGroupId ? { ...group, members: group.members.filter((item) => item !== username) } : group
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
        prev.map((group) => {
          if (group.groupId !== targetGroupId) return group;
          if (group.members.includes(username)) return group;
          return { ...group, members: [...group.members, username] };
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

  async function saveGroups() {
    if (!selectedActivityId) return;
    if (unassignedStudents.length > 0) {
      setError("尚有未分配學生，無法儲存分組。");
      return;
    }
    const response = await fetch("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId: selectedActivityId, groups: editableGroups })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "save_groups_failed");
      return;
    }
    const updated = data.updated as ActivityRow;
    setActivities((prev) =>
      prev.map((activity) =>
        activity.id === updated.id ? { ...updated, studentCandidates: activity.studentCandidates ?? [] } : activity
      )
    );
    setEditableGroups(updated.groups.map((group) => ({ ...group, members: [...group.members] })));
    setError("");
  }

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
      // Optimistic local update
      setEssays((prev) => {
        const idx = prev.findIndex((item) => item.id === savedEssay.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = savedEssay;
          return next;
        }
        return [...prev, savedEssay];
      });
      setEssayForm({
        id: "",
        title: "",
        genre: "議論文",
        description: "",
        enabled: true
      });
      // Background sync
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

  async function saveOpenClass(e: FormEvent) {
    e.preventDefault();
    setError("");
    const response = await fetch("/api/admin/openclasses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: openClassForm.id || undefined,
        classNumber: openClassForm.classNumber,
        essayId: openClassForm.essayId,
        durationMinutes: openClassForm.durationMinutes,
        supplemental: openClassForm.supplemental
      })
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.error === "essay_disabled") {
        setError("此主題已停用，無法建立新的寫作任務。");
      } else if (data.error === "duplicate_class_essay_assignment") {
        setError("此班級已被指派相同的寫作主題，無法重複指派。");
      } else {
        setError(data.error ?? "save_openclass_failed");
      }
      return;
    }
    setOpenClassForm({
      id: "",
      classNumber: "",
      essayId: "",
      durationMinutes: 40,
      supplemental: ""
    });
    await onRefresh();
  }

  function startEditOpenClass(openClass: OpenClassRow) {
    setOpenClassForm({
      id: openClass.id,
      classNumber: openClass.classNumber,
      essayId: openClass.essayId,
      durationMinutes: openClass.durationMinutes,
      supplemental: openClass.supplemental
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

  return (
    <>
      <div className="card">
        <h2>課程管理</h2>
        <small>以下為第二層分頁，先選擇管理模組，再編輯對應內容。</small>
        <div className="row" style={{ marginTop: 10 }}>
          {loginRole === "admin" ? (
            <div style={{ width: 210 }}>
              <button type="button" className={courseTab === "essay" ? "" : "secondary"} onClick={() => setCourseTab("essay")}>寫作主題管理</button>
            </div>
          ) : null}
          <div style={{ width: 210 }}>
            <button type="button" className={courseTab === "openclass" ? "" : "secondary"} onClick={() => setCourseTab("openclass")}>寫作任務管理</button>
          </div>
          <div style={{ width: 210 }}>
            <button type="button" className={courseTab === "group" ? "" : "secondary"} onClick={() => setCourseTab("group")}>組別管理</button>
          </div>
        </div>
      </div>

      {courseTab === "essay" && loginRole === "admin" ? (
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
                  onClick={() =>
                    setEssayForm({
                      id: "",
                      title: "",
                      genre: "議論文",
                      description: "",
                      enabled: true
                    })
                  }
                >
                  取消編輯
                </button>
              </div>
            ) : null}
            {error ? (
              <div className="col" style={{ width: "100%" }}>
                <small>{error}</small>
              </div>
            ) : null}
          </form>
          {essayForm.id ? (
            <small>
              目前正在編輯：{essayForm.id}
            </small>
          ) : null}
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

      {courseTab === "openclass" ? (
        <div className="card">
          <h2>寫作任務管理</h2>
          <form onSubmit={saveOpenClass} className="row">
            <div className="col">
              <label>班級號碼（由學生名單帶入）</label>
              <select
                value={openClassForm.classNumber}
                onChange={(e) => setOpenClassForm({ ...openClassForm, classNumber: e.target.value })}
              >
                <option value="">請選擇</option>
                {classOptions.map((classNumber) => (
                  <option key={classNumber} value={classNumber}>
                    {classNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="col">
              <label>主題（含 ID）</label>
              <select
                value={openClassForm.essayId}
                onChange={(e) => setOpenClassForm({ ...openClassForm, essayId: e.target.value })}
              >
                <option value="">請選擇</option>
                {essays
                  .filter((essay) => essay.enabled || essay.id === openClassForm.essayId)
                  .map((essay) => (
                    <option key={essay.id} value={essay.id}>
                      {essay.id} / {essay.title}
                    </option>
                  ))}
              </select>
            </div>
            <div className="col">
              <label>時長</label>
              <input
                type="number"
                value={openClassForm.durationMinutes}
                onChange={(e) => setOpenClassForm({ ...openClassForm, durationMinutes: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="col">
              <label>補充資料</label>
              <textarea
                rows={6}
                value={openClassForm.supplemental}
                onChange={(e) => setOpenClassForm({ ...openClassForm, supplemental: e.target.value })}
              />
            </div>
            <div className="col" style={{ alignSelf: "end" }}>
              <button type="submit">{openClassForm.id ? "儲存任務編輯" : "新增班級任務"}</button>
            </div>
            {error ? (
              <div className="col" style={{ width: "100%" }}>
                <small>{error}</small>
              </div>
            ) : null}
          </form>
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="pro-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>學校</th>
                  <th>班級</th>
                  <th>主題</th>
                  <th>時長</th>
                  <th>補充資料</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {openClasses.map((openClass) => (
                  <tr key={openClass.id}>
                    <td>{openClass.id}</td>
                    <td>{openClass.school}</td>
                    <td>{openClass.classNumber}</td>
                    <td>{openClass.essayTitle}</td>
                    <td>{openClass.durationMinutes} 分鐘</td>
                    <td>{openClass.supplemental || "—"}</td>
                    <td>
                      <button type="button" className="secondary" style={{ width: "auto" }} onClick={() => startEditOpenClass(openClass)}>
                        編輯
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {courseTab === "group" ? (
        <div className="card">
          <h2>組別管理</h2>
          <div className="row">
            <div className="col">
              <label>選擇任務</label>
              <select value={selectedActivityId} onChange={(e) => setSelectedActivityId(e.target.value)}>
                <option value="">請選擇</option>
                {activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.classNumber} 班 / {activity.title} ({activity.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="col">
              <label>小組數量</label>
              <input type="number" min={1} value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value) || 1)} />
            </div>
            <div className="col" style={{ alignSelf: "end" }}>
              <div className="row">
                <div style={{ width: 140 }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={randomAssignGroups}
                    disabled={!selectedActivityId}
                  >
                    隨機平均分組
                  </button>
                </div>
                <div style={{ width: 140 }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={initializeGroupsForDrag}
                    disabled={!selectedActivityId}
                  >
                    先建空組
                  </button>
                </div>
                <div style={{ width: 140 }}>
                  <button
                    type="button"
                    onClick={saveGroups}
                    disabled={!canSaveGroups}
                    style={{
                      background: !canSaveGroups ? "#f3f4f6" : undefined,
                      color: !canSaveGroups ? "#9ca3af" : undefined,
                      borderColor: !canSaveGroups ? "#e5e7eb" : undefined,
                      cursor: !canSaveGroups ? "not-allowed" : undefined
                    }}
                  >
                    儲存分組
                  </button>
                </div>
                <div style={{ width: 140 }}>
                  <button type="button" className="secondary" onClick={cancelGroupEdits} disabled={!selectedActivityId}>
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
          <small>
            {hasExistingGrouping
              ? "此任務已有既有分組，可直接拖曳調整；若按初始化按鈕會先將所有學生重設為未分配。"
              : "此任務尚未分組，請先設定組數並執行隨機分組或先建空組後拖曳。"}
          </small>
          <small>
            目前未分配學生：{unassignedStudents.length} 人（為 0 時才可儲存分組）
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
        </div>
      ) : null}
    </>
  );
}
