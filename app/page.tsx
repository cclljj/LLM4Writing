import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <div className="card">
        <h1>LLM4Writing Vercel-native</h1>
        <p>登入流程已恢復：學生與教師需先登入，並依角色導向對應系統頁面。</p>
        <p>
          請先從 <Link href="/login">登入頁</Link> 進入。
        </p>
      </div>

      <div className="row">
        <div className="col card">
          <h2>學生端</h2>
          <p>進行學習 session、送出訊息、查看 AI/系統回覆。</p>
          <Link href="/student">前往學生端</Link>
        </div>

        <div className="col card">
          <h2>教師端</h2>
          <p>切換全班步驟（1–10），觸發各步驟模式行為。</p>
          <Link href="/teacher">前往教師端</Link>
        </div>
      </div>

      <div className="card">
        <h2>API</h2>
        <ul>
          <li>
            <code>POST /api/auth/login</code>
          </li>
          <li>
            <code>POST /api/auth/logout</code>
          </li>
          <li>
            <code>GET /api/auth/me</code>
          </li>
          <li>
            <code>GET /api/health</code>
          </li>
          <li>
            <code>GET /api/spec</code>
          </li>
          <li>
            <code>POST /api/session/start</code>
          </li>
          <li>
            <code>GET /api/session/:sessionId</code>
          </li>
          <li>
            <code>POST /api/chat/send</code>
          </li>
          <li>
            <code>POST /api/teacher/step</code>
          </li>
        </ul>
      </div>
    </main>
  );
}
