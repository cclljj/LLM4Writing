type GroupWaitingStatusProps = {
  currentStep: number;
  activeGateKey: string | null;
  title: string;
  tone: "" | "warning" | "success";
  submittedCount: number;
  totalCount: number;
  pendingMembers: string[];
};

export default function GroupWaitingStatus({
  currentStep,
  activeGateKey,
  title,
  tone,
  submittedCount,
  totalCount,
  pendingMembers
}: GroupWaitingStatusProps) {
  return (
    <div className={`card status-panel ${tone}`}>
      <h2 style={{ marginBottom: 6 }}>小組等待狀態</h2>
      <p style={{ margin: 0, fontWeight: 700 }}>{title}</p>
      <p style={{ margin: "6px 0 0" }}>
        {currentStep === 4 ? "完成確認" : activeGateKey ? `目前題目：${activeGateKey}` : "目前題目：—"} / 已完成 {submittedCount} / {totalCount}
      </p>
      {pendingMembers.length > 0 ? (
        <small style={{ display: "block", marginTop: 6 }}>尚未完成：{pendingMembers.join("、")}</small>
      ) : (
        <small style={{ display: "block", marginTop: 6 }}>全組已完成，請等待系統或老師推進。</small>
      )}
    </div>
  );
}
