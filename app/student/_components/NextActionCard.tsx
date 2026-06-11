import { StudentNextAction } from "@/src/lib/student-next-action";

export default function NextActionCard({ action }: { action: StudentNextAction }) {
  const toneStyle = {
    success: { borderColor: "var(--success-border)", background: "linear-gradient(135deg, var(--success-bg) 0%, var(--info-bg) 100%)", color: "var(--success-text)" },
    waiting: { borderColor: "var(--warning-border)", background: "linear-gradient(135deg, var(--warning-bg) 0%, var(--warning-bg) 100%)", color: "var(--warning-text)" },
    focus: { borderColor: "var(--info-border)", background: "linear-gradient(135deg, var(--info-bg) 0%, var(--info-bg) 100%)", color: "var(--info-text)" }
  }[action.tone];

  return (
    <div className="card next-action-card" style={toneStyle} data-testid="student-next-action-card">
      <div className="next-action-header">
        <div className="next-action-kicker">下一步任務</div>
        <span className="next-action-pill">{action.statusLabel}</span>
      </div>
      <h2 style={{ marginBottom: 8 }}>{action.primaryAction}</h2>
      <p style={{ margin: 0, color: "var(--muted-strong)" }}>{action.body}</p>
    </div>
  );
}
