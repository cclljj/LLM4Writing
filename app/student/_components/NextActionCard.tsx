import { StudentNextAction } from "@/src/lib/student-next-action";

export default function NextActionCard({ action }: { action: StudentNextAction }) {
  const toneStyle = {
    success: { borderColor: "#bbf7d0", background: "linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%)", color: "#166534" },
    waiting: { borderColor: "#fed7aa", background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)", color: "#9a3412" },
    focus: { borderColor: "#93c5fd", background: "linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)", color: "#1d4ed8" }
  }[action.tone];

  return (
    <div className="card next-action-card" style={toneStyle} data-testid="student-next-action-card">
      <div className="next-action-header">
        <div className="next-action-kicker">下一步任務</div>
        <span className="next-action-pill">{action.statusLabel}</span>
      </div>
      <h2 style={{ marginBottom: 8 }}>{action.primaryAction}</h2>
      <p style={{ margin: 0, color: "#334155" }}>{action.body}</p>
    </div>
  );
}
