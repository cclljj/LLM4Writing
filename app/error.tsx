"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <div className="card status-panel warning" role="alert" aria-live="assertive">
        <h1>頁面暫時無法顯示</h1>
        <p>系統剛才遇到問題，請先不要關閉瀏覽器。你可以重新整理這個頁面，或回到首頁再進入課程。</p>
        {error.digest ? <small>錯誤代碼：{error.digest}</small> : null}
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" onClick={reset}>
            重新嘗試
          </button>
          <Link className="button-link secondary" href="/">
            回首頁
          </Link>
        </div>
      </div>
    </main>
  );
}
