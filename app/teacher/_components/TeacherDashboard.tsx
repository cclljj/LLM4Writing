import type { CSSProperties } from "react";

export type DashboardSession = {
  sessionId: string;
  groupId?: string;
  groupName?: string;
  currentStep: number;
  currentStepLabel?: string;
};

export type DashboardRisk = {
  level: "ok" | "watch" | "stuck";
  text: string;
  pendingMembers: string[];
  affectedUsers?: string[];
  reasons?: string[];
  suggestions?: string[];
};

export type DashboardHint = {
  ready: boolean;
  text: string;
  nextStep?: number;
};

export type TeacherDashboardRow<TSession extends DashboardSession = DashboardSession> = {
  session: TSession;
  risk: DashboardRisk;
  hint: DashboardHint;
  /**
   * Slowest member's personal step within this group (#244). Falls back to
   * `session.currentStep` when personal steps are unavailable. This replaces
   * `session.currentStep` for group progress display, since the latter caps
   * at the last teacher-set step (often 5) once personal pacing kicks in.
   */
  groupCurrentStep: number;
  /** "S5:1 / S6:2 / ..." distribution text; empty/undefined when not yet personal-paced. */
  step5To10Text?: string;
  /** Joined participant usernames for at-a-glance display. */
  membersText: string;
  /** Activity label (title or id) for multi-activity admin views. */
  activityLabel?: string;
};

export type TeacherDashboardData<TSession extends DashboardSession = DashboardSession> = {
  sessionCount: number;
  joinedCount: number;
  onlineCount: number;
  readyCount: number;
  stuckCount: number;
  watchCount: number;
  /** All session rows, sorted by risk priority: stuck → watch → ready → ok (#244). */
  riskRows: Array<TeacherDashboardRow<TSession>>;
};

type TeacherDashboardProps<TSession extends DashboardSession> = {
  dashboard: TeacherDashboardData<TSession>;
  processingActionKey?: string;
  inspectingSessionId?: string;
  onAdvanceStep: (sessionId: string, step: number) => void;
  onInspectDialogue: (session: TSession) => void;
  /** Optional context appended to the card header, e.g. "school / class / essay" (#258). */
  headerSuffix?: string;
};

function statusLabel(row: TeacherDashboardRow): string {
  if (row.hint.ready) return "可推進";
  if (row.risk.level === "stuck") return "高風險";
  if (row.risk.level === "watch") return "留意";
  return "正常";
}

function statusBadgeStyle(row: TeacherDashboardRow): CSSProperties {
  if (row.hint.ready) return { background: "#dcfce7", color: "#166534", borderColor: "#86efac" };
  if (row.risk.level === "stuck") return { background: "#fee2e2", color: "#991b1b", borderColor: "#fca5a5" };
  if (row.risk.level === "watch") return { background: "#fef3c7", color: "#92400e", borderColor: "#fcd34d" };
  return { background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" };
}

export default function TeacherDashboard<TSession extends DashboardSession>({
  dashboard,
  processingActionKey,
  inspectingSessionId,
  onAdvanceStep,
  onInspectDialogue,
  headerSuffix
}: TeacherDashboardProps<TSession>) {
  return (
    <div className="card">
      <h2>
        課堂儀表板
        {headerSuffix ? <span style={{ fontSize: 14, color: "#64748b", fontWeight: 400, marginLeft: 8 }}>— {headerSuffix}</span> : null}
      </h2>
      <div className="metric-grid">
        <div className="metric-card">
          <span className="metric-value">{dashboard.sessionCount}</span>
          <small>小組 sessions</small>
        </div>
        <div className="metric-card">
          <span className="metric-value">{dashboard.joinedCount}</span>
          <small>已加入學生</small>
        </div>
        <div className="metric-card">
          <span className="metric-value">{dashboard.onlineCount}</span>
          <small>目前在線學生</small>
        </div>
        <div className="metric-card">
          <span className="metric-value">{dashboard.readyCount}</span>
          <small>可切下一步小組</small>
        </div>
        <div className="metric-card">
          <span className="metric-value">{dashboard.stuckCount}</span>
          <small>高風險卡關</small>
        </div>
        <div className="metric-card">
          <span className="metric-value">{dashboard.watchCount}</span>
          <small>需留意小組</small>
        </div>
      </div>
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table className="pro-table">
          <thead>
            <tr>
              <th>狀態</th>
              <th>小組</th>
              <th>成員</th>
              <th>目前進度</th>
              <th>Step 5–10 分布</th>
              <th>提醒 / 步驟切換</th>
              <th>動作</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.riskRows.map((row) => {
              const advanceKey = row.hint.nextStep ? `step:${row.session.sessionId}:${row.hint.nextStep}` : "";
              const isAdvancing = processingActionKey === advanceKey;
              const isInspecting = inspectingSessionId === row.session.sessionId;
              return (
              <tr key={`dashboard-${row.session.sessionId}`}>
                <td>
                  <span
                    className="badge"
                    style={{
                      ...statusBadgeStyle(row),
                      border: "1px solid",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600
                    }}
                  >
                    {statusLabel(row)}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{row.session.groupName ?? row.session.groupId ?? "未命名組"}</div>
                  {row.activityLabel ? (
                    <small style={{ color: "#64748b", display: "block" }}>{row.activityLabel}</small>
                  ) : null}
                </td>
                <td>
                  <small title={row.membersText} style={{ display: "inline-block", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                    {row.membersText || "—"}
                  </small>
                </td>
                <td>{row.session.currentStepLabel ? `Step ${row.session.currentStepLabel}` : `Step ${row.groupCurrentStep}`}</td>
                <td>
                  <small>{row.step5To10Text || "—"}</small>
                </td>
                <td>
                  <small>{row.hint.ready ? row.hint.text : row.risk.text}</small>
                  {!row.hint.ready && row.risk.reasons && row.risk.reasons.length > 1 ? (
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      {row.risk.reasons.slice(1).map((reason) => (
                        <li key={`${row.session.sessionId}-${reason}`}>
                          <small>{reason}</small>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {row.risk.pendingMembers.length > 0 ? (
                    <small style={{ display: "block", marginTop: 4 }}>未完成：{row.risk.pendingMembers.join("、")}</small>
                  ) : null}
                  {!row.hint.ready && row.risk.affectedUsers && row.risk.affectedUsers.length > 0 ? (
                    <small style={{ display: "block", marginTop: 4 }}>需關注：{row.risk.affectedUsers.join("、")}</small>
                  ) : null}
                  {!row.hint.ready && row.risk.suggestions && row.risk.suggestions.length > 0 ? (
                    <small style={{ display: "block", marginTop: 6, color: "#0f766e" }}>
                      建議：{row.risk.suggestions[0]}
                    </small>
                  ) : null}
                </td>
                <td>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    {row.hint.ready && row.hint.nextStep ? (
                      <button
                        type="button"
                        style={{ width: "auto" }}
                        disabled={isAdvancing}
                        onClick={() => onAdvanceStep(row.session.sessionId, row.hint.nextStep!)}
                      >
                        {isAdvancing ? "推進中..." : `推進 Step ${row.hint.nextStep}`}
                      </button>
                    ) : null}
                    <button type="button" className="secondary" style={{ width: "auto" }} disabled={isInspecting} onClick={() => onInspectDialogue(row.session)}>
                      {isInspecting ? "載入中..." : "查看對話"}
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dashboard.riskRows.length === 0 ? (
        <small style={{ display: "block", marginTop: 8 }}>此課程目前沒有 session。開始上課後，學生加入討論即會出現在此。</small>
      ) : null}
    </div>
  );
}
