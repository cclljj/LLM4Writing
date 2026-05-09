import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-main">
      <section className="home-hero">
        <div>
          <p className="home-kicker">LLM4Writing</p>
          <h1>用 AI 引導每一位學生，完成更有品質的寫作學習</h1>
          <p className="home-lead">
            LLM4Writing 提供完整的分步引導、討論互動與學習歷程追蹤，協助學生從審題到總結，循序完成一篇有結構、有觀點的作品。
          </p>
          <div className="home-cta-row">
            <Link href="/login" className="home-btn-primary">
              立即登入
            </Link>
            <Link href="/student" className="home-btn-secondary">
              學生入口
            </Link>
            <Link href="/teacher" className="home-btn-secondary">
              教師入口
            </Link>
          </div>
        </div>
        <div className="home-hero-panel card">
          <h2>你可以在這裡完成什麼？</h2>
          <ul>
            <li>以 10 步驟引導學生完成寫作任務</li>
            <li>在小組討論與個人修訂中持續優化內容</li>
            <li>即時掌握每位學生的進度與學習風險</li>
            <li>回看完整歷程，支持教學回饋與反思</li>
          </ul>
        </div>
      </section>

      <section className="home-grid-3">
        <article className="card">
          <h2>學生學習流程</h2>
          <p>從審視題目、蒐集資料、生成論點，到修改潤飾與反思，逐步完成寫作任務。</p>
        </article>
        <article className="card">
          <h2>教師教學掌握</h2>
          <p>透過學習管理面板掌握班級進度、查看小組互動，並依需要調整課程節奏。</p>
        </article>
        <article className="card">
          <h2>歷程可追蹤</h2>
          <p>保留步驟化對話與作品版本，讓學習成長可被清楚檢視與回顧。</p>
        </article>
      </section>

      <section className="card">
        <h2>三種角色入口</h2>
        <div className="row">
          <div className="col card">
            <h3>學生</h3>
            <p>加入課程、參與互動、完成寫作並查看歷史紀錄。</p>
            <Link href="/student">前往學生端</Link>
          </div>
          <div className="col card">
            <h3>教師</h3>
            <p>管理課程進行、查看小組與個人互動，支持教學決策。</p>
            <Link href="/teacher">前往教師端</Link>
          </div>
          <div className="col card">
            <h3>系統管理員</h3>
            <p>維護帳號與課程資料，確保教學系統穩定運作。</p>
            <Link href="/admin">前往管理端</Link>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>資料與使用提醒</h2>
        <p>
          為保障學習隱私與資料安全，請使用由學校或系統管理單位提供的正式帳號登入。若你尚未取得帳號，請聯繫授課教師或管理人員。
        </p>
      </section>
    </main>
  );
}
