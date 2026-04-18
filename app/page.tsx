import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <div className="card">
        <h1>LLM4Writing Vercel-native（現況版流程）</h1>
        <p>已依 `SPEC_generated_by_AI.md` 回補：學生活動列表 + Phase1~5 聊天流程 + 教師三大管理模組入口。</p>
        <p>
          請先從 <Link href="/login">登入頁</Link> 進入。
        </p>
      </div>

      <div className="row">
        <div className="col card">
          <h2>學生端</h2>
          <p>Activity 列表、加入討論、歷史紀錄、Phase1~5 對話。</p>
          <Link href="/student">前往學生端</Link>
        </div>

        <div className="col card">
          <h2>教師端</h2>
          <p>系統管理 / 學習管理 / 課程管理，含觀課與步驟切換。</p>
          <Link href="/teacher">前往教師端</Link>
        </div>
      </div>
    </main>
  );
}
