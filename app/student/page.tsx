"use client";

import { FormEvent, useMemo, useState } from "react";

interface SessionState {
  id: string;
  currentStep: number;
  participants: string[];
  messages: Array<{
    id: string;
    role: string;
    userId?: string;
    text: string;
    at: string;
    step: number;
  }>;
}

export default function StudentPage() {
  const [participantsInput, setParticipantsInput] = useState("s1,s2,s3");
  const [sessionId, setSessionId] = useState("");
  const [userId, setUserId] = useState("s1");
  const [text, setText] = useState("");
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState("");

  const sortedMessages = useMemo(
    () => [...(session?.messages ?? [])].sort((a, b) => a.at.localeCompare(b.at)),
    [session]
  );

  async function startSession(e: FormEvent) {
    e.preventDefault();
    setError("");
    const participants = participantsInput
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const response = await fetch("/api/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participants })
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "start_failed");
      return;
    }

    setSession(data);
    setSessionId(data.id);
    if (participants[0]) {
      setUserId(participants[0]);
    }
  }

  async function refreshSession() {
    if (!sessionId) return;
    setError("");

    const response = await fetch(`/api/session/${sessionId}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "fetch_failed");
      return;
    }

    setSession(data);
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!sessionId || !text.trim()) return;
    setError("");

    const response = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, userId, text })
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "send_failed");
      return;
    }

    setSession(data);
    setText("");
  }

  return (
    <main>
      <h1>學生端（Vercel-native）</h1>

      <div className="card">
        <h2>1) 建立 Session</h2>
        <form onSubmit={startSession} className="row">
          <div className="col">
            <label>Participants (comma-separated)</label>
            <input
              value={participantsInput}
              onChange={(e) => setParticipantsInput(e.target.value)}
              placeholder="s1,s2,s3"
            />
          </div>
          <div className="col" style={{ alignSelf: "end" }}>
            <button type="submit">Start Session</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>2) 互動</h2>
        <div className="row">
          <div className="col">
            <label>Session ID</label>
            <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
          </div>
          <div className="col">
            <label>User ID</label>
            <input value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>
          <div className="col" style={{ alignSelf: "end" }}>
            <button type="button" className="secondary" onClick={refreshSession}>
              Refresh
            </button>
          </div>
        </div>

        <form onSubmit={sendMessage}>
          <label style={{ marginTop: 12 }}>Message</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" style={{ marginTop: 10 }}>
            Send
          </button>
        </form>

        {error ? <p><small>{error}</small></p> : null}
      </div>

      <div className="card">
        <h2>Session Snapshot</h2>
        <pre>{JSON.stringify({ ...session, messages: undefined }, null, 2)}</pre>
      </div>

      <div className="card">
        <h2>Messages</h2>
        {sortedMessages.length === 0 ? <small>No messages yet.</small> : null}
        {sortedMessages.map((message) => (
          <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
            <strong>
              [{message.step}] {message.role}
              {message.userId ? `(${message.userId})` : ""}
            </strong>
            <div>{message.text}</div>
            <small>{message.at}</small>
          </div>
        ))}
      </div>
    </main>
  );
}
