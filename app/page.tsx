import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <div className="card">
        <h1>LLM4Writing Vercel-native</h1>
        <p>
          這個版本已改為 Vercel 原生架構：Next.js App Router + Serverless API。
        </p>
        <p>
          目前先完成「可部署、可操作、可擴充」骨架，並將 SPEC 中最核心的步驟模式規則落實到 API。
        </p>
      </div>

      <div className="row">
        <div className="col card">
          <h2>學生端</h2>
          <p>建立/加入學習 session、送出訊息、查看 AI/系統回覆。</p>
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
