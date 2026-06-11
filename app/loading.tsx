export default function LoadingPage() {
  return (
    <main>
      <div className="card status-panel" role="status" aria-live="polite">
        <h1>正在載入</h1>
        <p>系統正在準備頁面內容，請稍候。</p>
      </div>
    </main>
  );
}
