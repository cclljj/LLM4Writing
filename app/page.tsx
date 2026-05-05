import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <div className="card">
        <h1>LLM4Writing Vercel-native</h1>
        <p>系統已依 `SPEC_generated_by_AI.md` 持續對齊，包含學生端 10 步驟學習流程與教師端三大管理模組。</p>
        <p>
          請先從 <Link href="/login">登入頁</Link> 進入。
        </p>
      </div>

      <div className="row">
        <div className="col card">
          <h2>學生端</h2>
          <p>任務列表、加入討論、10 步驟學習、歷史紀錄。</p>
          <Link href="/student">前往學生端</Link>
        </div>

        <div className="col card">
          <h2>教師端</h2>
          <p>系統管理 / 學習管理 / 課程管理，含觀課與步驟切換。</p>
          <Link href="/teacher">前往教師端</Link>
        </div>

        <div className="col card">
          <h2>系統管理員端</h2>
          <p>完整帳號、課程與主題管理權限。</p>
          <Link href="/admin">前往系統管理員端</Link>
        </div>
      </div>
    </main>
  );
}
