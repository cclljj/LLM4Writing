export type DashboardSession = {
  sessionId: string;
  groupId?: string;
  groupName?: string;
  currentStep: number;
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
};

export type TeacherDashboardData<TSession extends DashboardSession = DashboardSession> = {
  sessionCount: number;
  joinedCount: number;
  onlineCount: number;
  readyCount: number;
  stuckCount: number;
  watchCount: number;
  riskRows: Array<TeacherDashboardRow<TSession>>;
};

type TeacherDashboardProps<TSession extends DashboardSession> = {
  dashboard: TeacherDashboardData<TSession>;
  isProcessing: boolean;
  onAdvanceStep: (sessionId: string, step: number) => void;
  onInspectDialogue: (session: TSession) => void;
  onLoadProgress: (sessionId: string) => void;
};

function statusLabel(row: TeacherDashboardRow): string {
  if (row.hint.ready) return "可推進";
  if (row.risk.level === "stuck") return "高風險";
  if (row.risk.level === "watch") return "留意";
  return "正常";
}

export default function TeacherDashboard<TSession extends DashboardSession>({
  dashboard,
  isProcessing,
  onAdvanceStep,
  onInspectDialogue,
  onLoadProgress
}: TeacherDashboardProps<TSession>) {
  return (
    <div className="card">
      <h2>課堂儀表板</h2>
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
              <th>目前進度</th>
              <th>提醒</th>
              <th>一鍵管理</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.riskRows.map((row) => (
              <tr key={`dashboard-${row.session.sessionId}`}>
                <td>
                  <span className="badge">{statusLabel(row)}</span>
                </td>
                <td>{row.session.groupName ?? row.session.groupId ?? "未命名組"}</td>
                <td>Step {row.session.currentStep}</td>
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
                  <div className="row" style={{ gap: 8 }}>
                    {row.hint.ready && row.hint.nextStep ? (
                      <button type="button" style={{ width: "auto" }} disabled={isProcessing} onClick={() => onAdvanceStep(row.session.sessionId, row.hint.nextStep!)}>
                        推進 Step {row.hint.nextStep}
                      </button>
                    ) : null}
                    <button type="button" className="secondary" style={{ width: "auto" }} disabled={isProcessing} onClick={() => onInspectDialogue(row.session)}>
                      查看對話
                    </button>
                    <button type="button" className="secondary" style={{ width: "auto" }} disabled={isProcessing} onClick={() => onLoadProgress(row.session.sessionId)}>
                      個人進度
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dashboard.riskRows.length === 0 ? (
        <small style={{ display: "block", marginTop: 8 }}>目前沒有卡關或可推進提示。若剛開始上課，請等待學生加入後重新整理。</small>
      ) : null}
    </div>
  );
}
