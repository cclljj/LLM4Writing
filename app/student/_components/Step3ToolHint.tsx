export default function Step3ToolHint({ statusLabel, title = "結構樹工具提示" }: { statusLabel: string; title?: string }) {
  return (
    <div className="status-panel">
      <strong>{title}</strong>
      <p style={{ margin: "6px 0 0" }}>
        第一層與第二層是固定架構，不可改名、拖曳或刪除；第一層不顯示 ➕/➖，第二層只顯示 ➕ 可新增下一層。第三層以下可雙擊或手機長按編輯文字，按 Enter 或點空白處完成並自動儲存；無子節點時可用 ➖ 刪除。
      </p>
      <small style={{ display: "block", marginTop: 6 }}>狀態：{statusLabel}</small>
    </div>
  );
}
