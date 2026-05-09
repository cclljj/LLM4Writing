"use client";

import { FormEvent, useState } from "react";

export default function HomePage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "login_failed");
      return;
    }

    window.location.href = data.redirectTo;
  }

  return (
    <main id="top" className="home-main">
      <section className="home-hero">
        <div>
          <p className="home-kicker">LLM4Writing</p>
          <h1>用 AI 引導每一位學生，完成更有品質的寫作學習</h1>
          <p className="home-lead">
            LLM4Writing 提供完整的分步引導、討論互動與學習歷程追蹤，協助學生從審題到總結，循序完成一篇有結構、有觀點的作品。
          </p>
          <p className="home-lead" style={{ marginBottom: 0 }}>
            現在可直接在首頁登入，登入後系統會依你的身分自動導向對應頁面。
          </p>
        </div>
        <div className="home-hero-panel card">
          <h2>立即登入</h2>
          <form onSubmit={handleLogin}>
            <label>帳號</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="請輸入帳號" />

            <label style={{ marginTop: 10 }}>密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
            />

            <button type="submit" style={{ marginTop: 14 }}>
              登入系統
            </button>

            {error ? (
              <p style={{ marginBottom: 0 }}>
                <small>{error}</small>
              </p>
            ) : null}
          </form>
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
        <h2>系統入口</h2>
        <div className="row">
          <div className="col card">
            <h3>單一登入入口</h3>
            <p>學生、教師與管理員使用同一個登入入口，登入後將自動導向你的工作頁面。</p>
            <a href="#top">請使用上方登入表單進入</a>
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
