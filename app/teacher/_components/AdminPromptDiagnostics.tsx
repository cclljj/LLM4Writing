"use client";

import { useEffect, useState } from "react";

type DiagnosticsPayload = {
  llm: {
    configured: boolean;
    urlPresent: boolean;
    keyPresent: boolean;
    modelPresent: boolean;
    model: string | null;
  };
  promptConfig: {
    hasSystemPrompt: boolean;
    stepPrompts: number;
    stepPromptsOld: number;
    subStepPrompts: number;
    subStepPromptsFallbacks: number;
    baseQuestionBanks: number;
    writingTaskQuestionBanks: number;
    writingTasks: number;
    step9Questions: number;
    stepOpenings: number;
  };
  sessions: {
    total: number;
    spec10: number;
    recent: Array<{
      sessionId: string;
      activityTitle: string;
      groupName: string;
      currentStep: number;
      participantCount: number;
      messageCount: number;
      lastMessageAt: string;
    }>;
  };
  generatedAt: string;
};

export default function AdminPromptDiagnostics() {
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadDiagnostics() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/diagnostics", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "diagnostics_failed");
        setData(null);
        return;
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "diagnostics_failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDiagnostics().catch(() => undefined);
  }, []);

  return (
    <div className="card" data-testid="admin-prompt-diagnostics">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Prompt / LLM 診斷面板</h2>
          <small>僅系統管理員可見；用於確認 prompt 設定、LLM 環境與近期 session 狀態。</small>
        </div>
        <button type="button" className="secondary" style={{ width: "auto" }} onClick={() => loadDiagnostics()}>
          重新整理診斷
        </button>
      </div>

      {loading ? <small style={{ display: "block", marginTop: 10 }}>診斷資料載入中...</small> : null}
      {error ? <small style={{ display: "block", marginTop: 10, color: "#b91c1c" }}>{error}</small> : null}

      {data ? (
        <>
          <div className="metric-grid" style={{ marginTop: 12 }}>
            <div className="metric-card">
              <span className="metric-value">{data.llm.configured ? "OK" : "缺"}</span>
              <small>LLM 設定狀態</small>
            </div>
            <div className="metric-card">
              <span className="metric-value">{data.promptConfig.stepPrompts}</span>
              <small>stepPrompts</small>
            </div>
            <div className="metric-card">
              <span className="metric-value">{data.promptConfig.subStepPrompts}</span>
              <small>subStepPrompts</small>
            </div>
            <div className="metric-card">
              <span className="metric-value">{data.promptConfig.subStepPromptsFallbacks}</span>
              <small>fallback 題目</small>
            </div>
            <div className="metric-card">
              <span className="metric-value">{data.promptConfig.writingTaskQuestionBanks}</span>
              <small>任務題庫 keys</small>
            </div>
            <div className="metric-card">
              <span className="metric-value">{data.sessions.spec10}</span>
              <small>spec10 sessions</small>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div className="col card" style={{ marginBottom: 0 }}>
              <h3>LLM 環境檢查</h3>
              <small>LLM_URL：{data.llm.urlPresent ? "已設定" : "缺少"}</small><br />
              <small>LLM_KEY：{data.llm.keyPresent ? "已設定" : "缺少"}</small><br />
              <small>LLM_MODEL：{data.llm.modelPresent ? data.llm.model ?? "已設定" : "缺少"}</small>
            </div>
            <div className="col card" style={{ marginBottom: 0 }}>
              <h3>Prompt 設定檢查</h3>
              <small>systemPrompt：{data.promptConfig.hasSystemPrompt ? "存在" : "缺少"}</small><br />
              <small>stepPrompts_old：{data.promptConfig.stepPromptsOld}</small><br />
              <small>step9Questions：{data.promptConfig.step9Questions}</small><br />
              <small>stepOpenings：{data.promptConfig.stepOpenings}</small><br />
              <small>writingTasks：{data.promptConfig.writingTasks}</small>
            </div>
          </div>

          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="pro-table">
              <thead>
                <tr>
                  <th>近期 Session</th>
                  <th>組別</th>
                  <th>Step</th>
                  <th>成員</th>
                  <th>訊息</th>
                  <th>最後事件</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.recent.map((session) => (
                  <tr key={session.sessionId}>
                    <td>{session.activityTitle}</td>
                    <td>{session.groupName}</td>
                    <td>Step {session.currentStep}</td>
                    <td>{session.participantCount}</td>
                    <td>{session.messageCount}</td>
                    <td>{new Date(session.lastMessageAt).toLocaleString("zh-TW")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.sessions.recent.length === 0 ? <small style={{ display: "block", marginTop: 8 }}>目前沒有可診斷的 session。</small> : null}
          <small style={{ display: "block", marginTop: 8 }}>更新時間：{new Date(data.generatedAt).toLocaleString("zh-TW")}</small>
        </>
      ) : null}
    </div>
  );
}
