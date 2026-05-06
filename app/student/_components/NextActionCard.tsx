import { StudentNextAction } from "@/src/lib/student-next-action";

export default function NextActionCard({ action }: { action: StudentNextAction }) {
  const toneStyle =
    action.tone === "success"
      ? { borderColor: "#bbf7d0", background: "#f0fdf4" }
      : action.tone === "waiting"
        ? { borderColor: "#fed7aa", background: "#fff7ed" }
        : { borderColor: "#93c5fd", background: "#eff6ff" };

  return (
    <div className="card next-action-card" style={toneStyle} data-testid="student-next-action-card">
      <div className="next-action-kicker">下一步該做什麼</div>
      <h2 style={{ marginBottom: 6 }}>{action.title}</h2>
      <p style={{ margin: 0 }}>{action.body}</p>
    </div>
  );
}
