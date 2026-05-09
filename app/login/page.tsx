"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
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
    <main>
      <div className="card" style={{ maxWidth: 480, margin: "40px auto" }}>
        <h1>登入</h1>
        <p>請使用學生、教師或管理員帳號登入。</p>

        <form onSubmit={handleLogin}>
          <label>帳號</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin / teacher / student" />

          <label style={{ marginTop: 10 }}>密碼</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="請輸入密碼"
          />

          <button type="submit" style={{ marginTop: 14 }}>
            Login
          </button>

          {error ? (
            <p>
              <small>{error}</small>
            </p>
          ) : null}
        </form>

        <div style={{ marginTop: 14 }}>
          <small>請使用學校或系統管理單位提供的正式帳號密碼登入。</small>
        </div>
      </div>
    </main>
  );
}
