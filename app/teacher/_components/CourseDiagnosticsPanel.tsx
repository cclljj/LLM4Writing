"use client";

import { memo } from "react";
import { formatTaipeiDateTime } from "@/src/lib/time-format";
import type { CourseDiagnosticsPayload } from "./types";

type CourseDiagnosticsPanelProps = {
  diagnostics: CourseDiagnosticsPayload | null;
  loading: boolean;
  error: string;
  contextLabel: string;
  page: number;
  totalPages: number;
  pagedRows: CourseDiagnosticsPayload["sessions"];
  onRefresh: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 1000) / 10}%`;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes > 0 ? `${hours}小時${restMinutes}分` : `${hours}小時`;
  }
  return minutes > 0 ? `${minutes}分${seconds.toString().padStart(2, "0")}秒` : `${seconds}秒`;
}

function formatStepDurationList(items: Array<{ step: number; averageMs: number; sampleCount: number }>): string {
  if (items.length === 0) return "—";
  return items
    .map((item) => `S${item.step}: ${formatDuration(item.averageMs)} (${item.sampleCount})`)
    .join(" / ");
}

function CourseDiagnosticsPanel({
  diagnostics,
  loading,
  error,
  contextLabel,
  page,
  totalPages,
  pagedRows,
  onRefresh,
  onPreviousPage,
  onNextPage
}: CourseDiagnosticsPanelProps) {
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ marginBottom: 0 }}>
          課程診斷摘要
          {contextLabel ? <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400, marginLeft: 8 }}>— {contextLabel}</span> : null}
        </h2>
        <button
          type="button"
          className="secondary"
          style={{ width: "auto" }}
          disabled={loading}
          onClick={onRefresh}
        >
          {loading ? "載入中..." : "重新整理診斷"}
        </button>
      </div>
      {loading ? <small style={{ display: "block", marginTop: 10 }}>課程診斷資料載入中...</small> : null}
      {error ? <small style={{ display: "block", marginTop: 10, color: "var(--danger-text)" }}>{error}</small> : null}
      {diagnostics ? (
        <>
          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            <div style={{ flex: 1, padding: 12, border: "1px solid var(--line-soft)", borderRadius: 8, background: "var(--surface-alt)" }}>
              <small>上課場次</small>
              <h3 style={{ margin: "4px 0 0" }}>{diagnostics.summary.totalSessions}</h3>
            </div>
            <div style={{ flex: 1, padding: 12, border: "1px solid var(--line-soft)", borderRadius: 8, background: "var(--surface-alt)" }}>
              <small>Fallback</small>
              <h3 style={{ margin: "4px 0 0" }}>{diagnostics.summary.totalFallbacks}（{formatPercent(diagnostics.summary.fallbackRate)}）</h3>
            </div>
            <div style={{ flex: 1, padding: 12, border: "1px solid var(--line-soft)", borderRadius: 8, background: "var(--surface-alt)" }}>
              <small>拒答</small>
              <h3 style={{ margin: "4px 0 0" }}>{diagnostics.summary.totalRejections}（{formatPercent(diagnostics.summary.rejectionRate)}）</h3>
            </div>
            <div style={{ flex: 1, padding: 12, border: "1px solid var(--line-soft)", borderRadius: 8, background: "var(--surface-alt)" }}>
              <small>最久停留步驟</small>
              <h3 style={{ margin: "4px 0 0" }}>{diagnostics.summary.slowestStep ? `Step ${diagnostics.summary.slowestStep}` : "—"}</h3>
            </div>
          </div>
          <small style={{ display: "block", marginTop: 10 }}>
            指標來源：{diagnostics.source === "persisted_learning_events" ? "事件表（較精準）" : "session 訊息估算"}
          </small>
          <div className="table-scroll" style={{ marginTop: 12 }}>
            <table className="pro-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>組別</th>
                  <th>開始時間</th>
                  <th>Session 數</th>
                  <th>學生數</th>
                  <th>最新步驟</th>
                  <th>Fallback</th>
                  <th>拒答</th>
                  <th>平均停留</th>
                  <th>風險步驟</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((session) => (
                  <tr key={session.runId}>
                    <td>{session.date || "—"}</td>
                    <td>{session.groupName || session.runId}</td>
                    <td>{formatTaipeiDateTime(session.startedAt)}</td>
                    <td>{session.sessionIds.length}</td>
                    <td>{session.participantCount}</td>
                    <td>Step {session.latestStep}</td>
                    <td>{session.fallbackCount} / {session.totalAi}（{formatPercent(session.fallbackRate)}）</td>
                    <td>{session.rejectionCount} / {session.acceptedAnswers + session.rejectionCount}（{formatPercent(session.rejectionRate)}）</td>
                    <td>{formatDuration(session.averageStepDurationMs)}</td>
                    <td>{session.riskiestSteps.length > 0 ? session.riskiestSteps.map((step) => `S${step}`).join("、") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {diagnostics.sessions.length > 0 ? (
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <small>
                第 {page} / {totalPages} 頁，共 {diagnostics.sessions.length} 列（每頁 10 列）
              </small>
              <div className="row" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="secondary"
                  style={{ width: "auto" }}
                  disabled={page <= 1}
                  onClick={onPreviousPage}
                >
                  上一頁
                </button>
                <button
                  type="button"
                  className="secondary"
                  style={{ width: "auto" }}
                  disabled={page >= totalPages}
                  onClick={onNextPage}
                >
                  下一頁
                </button>
              </div>
            </div>
          ) : null}
          {diagnostics.sessions.length === 0 ? <small style={{ display: "block", marginTop: 8 }}>此課程目前沒有可統計的上課場次。</small> : null}
          <h3 style={{ marginTop: 14 }}>每步平均停留時間</h3>
          <small>{formatStepDurationList(diagnostics.summary.averageStepDurations)}</small>
          <ul style={{ marginTop: 10 }}>
            {diagnostics.estimationNotes.map((note) => (
              <li key={note}><small>{note}</small></li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export default memo(CourseDiagnosticsPanel);
