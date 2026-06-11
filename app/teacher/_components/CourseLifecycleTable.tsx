"use client";

import { memo } from "react";

type CourseStatus = "not_started" | "in_progress" | "paused" | "ended";

type LifecycleActivity = {
  id: string;
  school: string;
  classNumber: string;
  title: string;
  ownerTeacherUsername?: string;
  courseStatus?: CourseStatus;
};

function getCourseStatusLabel(status?: CourseStatus) {
  if (status === "in_progress") return "進行中";
  if (status === "paused") return "暫停中";
  if (status === "ended") return "已結束";
  return "尚未開始";
}

function CourseLifecycleTable({
  rows,
  teacherNameByUsername,
  isAdminConsole,
  learningActionKey,
  page,
  totalPages,
  totalCount,
  jumpValue,
  onJumpValueChange,
  onPageChange,
  onLifecycleAction,
  onView,
  onRefresh,
  onDelete
}: {
  rows: LifecycleActivity[];
  teacherNameByUsername: Map<string, string>;
  isAdminConsole: boolean;
  learningActionKey: string;
  page: number;
  totalPages: number;
  totalCount: number;
  jumpValue: string;
  onJumpValueChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onLifecycleAction: (activityId: string, action: "start" | "pause_resume" | "end", title: string) => void;
  onView: (activityId: string) => void;
  onRefresh: (activityId: string) => void;
  onDelete: (activityId: string, title: string) => void;
}) {
  return (
    <>
      <div className="table-scroll">
        <table className="pro-table">
          <thead>
            <tr>
              <th>學校</th>
              <th>班級</th>
              <th>課程</th>
              <th>教師</th>
              <th>目前狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((activity) => {
              const status = activity.courseStatus;
              const startDisabled = status !== "not_started";
              const pauseResumeDisabled = status === "not_started" || status === "ended";
              const endDisabled = status === "not_started" || status === "ended";
              const viewDisabled = status === "not_started";
              const startKey = `course:${activity.id}:start`;
              const pauseResumeKey = `course:${activity.id}:pause_resume`;
              const endKey = `course:${activity.id}:end`;
              const viewKey = `course:${activity.id}:view`;
              const refreshKey = `course:${activity.id}:refresh`;
              const deleteKey = `course:${activity.id}:delete`;
              const disabledButtonStyle = {
                width: "auto",
                background: "var(--surface-alt)",
                color: "var(--muted-soft)",
                borderColor: "var(--line-soft)",
                cursor: "not-allowed"
              } as const;
              const enabledButtonStyle = { width: "auto" } as const;
              return (
                <tr key={activity.id}>
                  <td>{activity.school}</td>
                  <td>{activity.classNumber}</td>
                  <td>{activity.title}</td>
                  <td>
                    {activity.ownerTeacherUsername
                      ? `${teacherNameByUsername.get(activity.ownerTeacherUsername) ?? activity.ownerTeacherUsername}(${activity.ownerTeacherUsername})`
                      : "未指派"}
                  </td>
                  <td>{getCourseStatusLabel(status)}</td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        type="button"
                        style={startDisabled ? disabledButtonStyle : enabledButtonStyle}
                        className={startDisabled ? "secondary" : ""}
                        disabled={startDisabled || learningActionKey === startKey}
                        onClick={() => onLifecycleAction(activity.id, "start", activity.title)}
                      >
                        {learningActionKey === startKey ? "開始中..." : "開始上課"}
                      </button>
                      <button
                        type="button"
                        className={pauseResumeDisabled ? "secondary" : ""}
                        style={pauseResumeDisabled ? disabledButtonStyle : enabledButtonStyle}
                        disabled={pauseResumeDisabled || learningActionKey === pauseResumeKey}
                        onClick={() => onLifecycleAction(activity.id, "pause_resume", activity.title)}
                      >
                        {learningActionKey === pauseResumeKey ? "更新中..." : status === "in_progress" ? "暫停上課" : "繼續上課"}
                      </button>
                      <button
                        type="button"
                        className={endDisabled ? "secondary" : ""}
                        style={endDisabled ? disabledButtonStyle : enabledButtonStyle}
                        disabled={endDisabled || learningActionKey === endKey}
                        onClick={() => onLifecycleAction(activity.id, "end", activity.title)}
                      >
                        {learningActionKey === endKey ? "結束中..." : "結束上課"}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        style={viewDisabled ? disabledButtonStyle : enabledButtonStyle}
                        disabled={viewDisabled || learningActionKey === viewKey}
                        onClick={() => onView(activity.id)}
                      >
                        {learningActionKey === viewKey ? "載入中..." : "查看狀態"}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        style={{ width: "auto" }}
                        disabled={learningActionKey === refreshKey}
                        onClick={() => onRefresh(activity.id)}
                      >
                        {learningActionKey === refreshKey ? "整理中..." : "重新整理"}
                      </button>
                      {isAdminConsole ? (
                        <button
                          type="button"
                          className="secondary"
                          style={{ width: "auto", background: "var(--danger-bg)", color: "var(--danger-text)", borderColor: "var(--danger-border)" }}
                          disabled={learningActionKey === deleteKey}
                          onClick={() => onDelete(activity.id, activity.title)}
                        >
                          {learningActionKey === deleteKey ? "刪除中..." : "刪除"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 10, alignItems: "center", gap: 8 }}>
        <small>
          第 {page} / {totalPages} 頁，共 {totalCount} 筆（每頁 10 筆）
        </small>
        <button
          type="button"
          className="secondary"
          style={{ width: "auto" }}
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          上一頁
        </button>
        <button
          type="button"
          className="secondary"
          style={{ width: "auto" }}
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          下一頁
        </button>
        <label style={{ marginLeft: 8 }}>跳到第</label>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jumpValue}
          onChange={(e) => onJumpValueChange(e.target.value)}
          style={{ width: 90 }}
        />
        <span>頁</span>
        <button
          type="button"
          className="secondary"
          style={{ width: "auto" }}
          onClick={() => {
            const parsed = Number(jumpValue);
            if (!Number.isFinite(parsed)) return;
            onPageChange(Math.min(totalPages, Math.max(1, Math.trunc(parsed))));
          }}
        >
          前往
        </button>
      </div>
    </>
  );
}

export default memo(CourseLifecycleTable);
