"use client";

import { FormEvent, useState } from "react";
import { formatUserError } from "@/src/lib/error-messages";

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
      setError(formatUserError(data.error ?? "login_failed", "登入失敗。建議：請確認帳號密碼，或聯繫教師。"));
      return;
    }

    window.location.href = data.redirectTo;
  }

  return (
    <main id="top" className="home-main">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-chip-row">
            <span className="home-chip">10-Step Learning Flow</span>
            <span className="home-chip">Teacher Dashboard</span>
            <span className="home-chip">Evidence-Based Writing</span>
          </div>
          <p className="home-kicker">LLM4Writing</p>
          <h1>
            讓 AI 成為課堂中的
            <span className="home-title-accent">寫作引導老師</span>
          </h1>
          <p className="home-lead">
            LLM4Writing 提供完整的分步引導、討論互動與學習歷程追蹤，協助學生從審題到總結，循序完成一篇有結構、有觀點的作品。
          </p>
          <p className="home-lead" style={{ marginBottom: 0 }}>
            現在可直接在首頁登入，登入後系統會依你的身分自動導向對應頁面。
          </p>
        </div>
        <div className="home-hero-panel card home-login-card">
          <h2>立即登入</h2>
          <p className="home-login-sub">使用學校或系統管理單位提供的帳號密碼登入。</p>
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

            <button type="submit" className="full-width" style={{ marginTop: 14 }}>
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

      <section className="card home-flow">
        <h2>教學流程全景</h2>
        <div className="home-flow-grid">
          <div className="home-flow-item">
            <span className="home-flow-step">STEP 1-4</span>
            <h3>引導討論與結構建構</h3>
            <p>從審題、蒐集資料到論點生成與對比修正，建立共同寫作基礎。</p>
          </div>
          <div className="home-flow-item">
            <span className="home-flow-step">STEP 5-8</span>
            <h3>個人草稿與 AI 回饋</h3>
            <p>產出摘要、完成初稿、獲得 AI 建議，再進行修改潤飾。</p>
          </div>
          <div className="home-flow-item">
            <span className="home-flow-step">STEP 9-10</span>
            <h3>反思與總結</h3>
            <p>完成個人反思與總結報告，形成可追蹤的學習成長紀錄。</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>資料與使用提醒</h2>
        <p>
          為保障學習隱私與資料安全，請使用由學校或系統管理單位提供的正式帳號登入。若你尚未取得帳號，請聯繫授課教師或管理人員。
        </p>
      </section>

      <footer className="card home-footer">
        <p>
          <strong>計畫名稱：</strong>
          新世代兒少數位行為及價值觀研究計畫 (NSTC 113-2420-H-305 -001-MY3)
        </p>
        <p>
          <strong>執行單位：</strong>
          中央研究院、國立台灣師範大學
        </p>
        <p style={{ marginBottom: 0 }}>
          本計畫之實施過程已送交人體研究倫理審查委員會 (Institutional Review Board, IRB) 審議通過，所有參與者並已徵求本人及家長同意，若有興趣加入本計畫參與實驗，可與本計畫團隊聯繫。
        </p>
      </footer>
    </main>
  );
}
