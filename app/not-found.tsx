import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main>
      <div className="card status-panel warning" role="alert">
        <h1>找不到這個頁面</h1>
        <p>這個連結可能已失效，或你目前沒有權限查看。</p>
        <Link className="button-link secondary" href="/">
          回首頁
        </Link>
      </div>
    </main>
  );
}
