"use client";

import { memo } from "react";
import { formatTaipeiDateTime } from "@/src/lib/time-format";

type ClassJoinSortColumn = "username" | "groupName" | "step" | "messageCount";
type SortDirection = "asc" | "desc";

export type ClassJoinRow = {
  username: string;
  displayName: string;
  joined: boolean;
  groupName?: string | null;
  stepLabel?: string | number | null;
  messageCount: number;
  lastMessageAt?: string | null;
  sessionId?: string | null;
  waitingExcluded: boolean;
  makeupPending: boolean;
  makeupCompleted: boolean;
  hasActivityWhileExcluded: boolean;
};

function SortButtons({
  column,
  sort,
  onSortBy,
  labelPrefix
}: {
  column: ClassJoinSortColumn;
  sort: { column: ClassJoinSortColumn; direction: SortDirection };
  onSortBy: (column: ClassJoinSortColumn, direction: SortDirection) => void;
  labelPrefix: string;
}) {
  const activeColor = "var(--text-strong)";
  const idleColor = "var(--muted-soft)";
  return (
    <>
      <button
        type="button"
        className="secondary"
        style={{ marginLeft: 6, width: "auto", padding: "0 4px", minWidth: 0, color: sort.column === column && sort.direction === "asc" ? activeColor : idleColor }}
        onClick={() => onSortBy(column, "asc")}
        aria-label={`${labelPrefix}升冪排序`}
      >
        ↑
      </button>
      <button
        type="button"
        className="secondary"
        style={{ marginLeft: 2, width: "auto", padding: "0 4px", minWidth: 0, color: sort.column === column && sort.direction === "desc" ? activeColor : idleColor }}
        onClick={() => onSortBy(column, "desc")}
        aria-label={`${labelPrefix}降冪排序`}
      >
        ↓
      </button>
    </>
  );
}

function ClassJoinStatusTable({
  rows,
  contextLabel,
  sort,
  onSortBy,
  learningActionKey,
  selectedProgressUser,
  onViewProgress,
  onToggleWaitingExclusion
}: {
  rows: ClassJoinRow[];
  contextLabel: string;
  sort: { column: ClassJoinSortColumn; direction: SortDirection };
  onSortBy: (column: ClassJoinSortColumn, direction: SortDirection) => void;
  learningActionKey: string;
  selectedProgressUser: string;
  onViewProgress: (sessionId: string, username: string) => void;
  onToggleWaitingExclusion: (sessionId: string, username: string, excluded: boolean) => void;
}) {
  return (
    <div className="card">
      <h2>
        全班加入狀態
        {contextLabel ? <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400, marginLeft: 8 }}>— {contextLabel}</span> : null}
      </h2>
      <div className="table-scroll">
        <table className="pro-table">
          <thead>
            <tr>
              <th>序號</th>
              <th>
                姓名 (帳號)
                <SortButtons column="username" sort={sort} onSortBy={onSortBy} labelPrefix="姓名帳號" />
              </th>
              <th>加入狀態</th>
              <th>
                所在組別
                <SortButtons column="groupName" sort={sort} onSortBy={onSortBy} labelPrefix="所在組別" />
              </th>
              <th>
                目前進度
                <SortButtons column="step" sort={sort} onSortBy={onSortBy} labelPrefix="目前進度" />
              </th>
              <th>
                發言數
                <SortButtons column="messageCount" sort={sort} onSortBy={onSortBy} labelPrefix="發言數" />
              </th>
              <th>最後發言時間</th>
              <th>動作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const progressKey = row.sessionId ? `progress:${row.sessionId}:${row.username}` : "";
              const isProgressLoading = learningActionKey === progressKey;
              const attendanceKey = row.sessionId ? `attendance:${row.sessionId}:${row.username}` : "";
              const isAttendanceLoading = learningActionKey === attendanceKey;
              return (
                <tr key={row.username}>
                  <td>{idx + 1}</td>
                  <td>
                    {row.displayName} ({row.username})
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {row.waitingExcluded ? (
                        <span className="badge" style={{ background: "var(--warning-bg)", color: "var(--warning-text)" }}>
                          本次不列入等待
                        </span>
                      ) : null}
                      {row.makeupPending ? (
                        <span className="badge" style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}>
                          需補個人結構圖
                        </span>
                      ) : null}
                      {row.makeupCompleted ? (
                        <span className="badge" style={{ background: "var(--success-bg)", color: "var(--success-text)" }}>
                          已補個人結構圖
                        </span>
                      ) : null}
                      {row.hasActivityWhileExcluded ? (
                        <span className="badge" style={{ background: "var(--info-bg)", color: "var(--info-text)" }}>
                          已請假但有活動
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>{row.joined ? "已加入" : "未加入"}</td>
                  <td>{row.groupName ?? "—"}</td>
                  <td>{row.stepLabel ? `Step ${row.stepLabel}` : "—"}</td>
                  <td>{row.messageCount}</td>
                  <td>{row.lastMessageAt ? formatTaipeiDateTime(row.lastMessageAt) : "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      style={{ width: "auto" }}
                      disabled={isProgressLoading || !row.sessionId}
                      onClick={() => {
                        if (!row.sessionId) return;
                        onViewProgress(row.sessionId, row.username);
                      }}
                    >
                      {isProgressLoading ? "載入中..." : "查看"}
                    </button>
                    {row.sessionId ? (
                      <button
                        type="button"
                        className="secondary"
                        style={{ width: "auto", marginLeft: 6 }}
                        disabled={isAttendanceLoading}
                        title={
                          row.waitingExcluded
                            ? "取消後，學生會重新納入目前小組等待判定；補做需求不會自動取消。"
                            : "只影響本 session 的小組等待判定，不代表正式出缺席。若在 Step3/4 標記，學生可能需要補個人結構圖。"
                        }
                        onClick={() => onToggleWaitingExclusion(row.sessionId!, row.username, !row.waitingExcluded)}
                      >
                        {isAttendanceLoading
                          ? "處理中..."
                          : row.waitingExcluded
                            ? "取消不列入等待"
                            : "本次不列入等待"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <small>此課程目前沒有可見學生名單。</small> : null}
      {selectedProgressUser ? <small style={{ display: "block", marginTop: 8 }}>目前檢視個人對話：{selectedProgressUser}</small> : null}
    </div>
  );
}

export default memo(ClassJoinStatusTable);
