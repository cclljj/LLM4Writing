export default function Step3ToolHint({ statusLabel }: { statusLabel: string }) {
  return (
    <div className="status-panel">
      <strong>Step3 工具提示</strong>
      <p style={{ margin: "6px 0 0" }}>
        ➕ 新增下一層、➖ 刪除無子節點的第二層以下節點；雙擊或手機長按可編輯文字，按 Enter 或點空白處完成並儲存；拖曳節點可調整位置與層次。
      </p>
      <small style={{ display: "block", marginTop: 6 }}>狀態：{statusLabel}</small>
    </div>
  );
}
