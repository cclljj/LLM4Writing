"use client";

import { useEffect, useState } from "react";

type ResponseTimeBucket = {
  median: number;
  avg: number;
  samples: number;
};

type FallbackBucket = {
  totalAi: number;
  fallbacks: number;
  rate: number;
};

type ArtifactBucket = {
  has: number;
  empty: number;
  short?: number;
  avgChars: number;
  completionRate: number;
  shortRate?: number;
};

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
  llmResponseTime: Record<string, ResponseTimeBucket>;
  fallbackRate: {
    byStep: Record<string, FallbackBucket>;
    overall: FallbackBucket;
  };
  artifactHealth: {
    totalStudents: number;
    outline: ArtifactBucket;
    draft6: ArtifactBucket;
    draft8: ArtifactBucket;
    step10: { has: number; empty: number; completionRate: number };
  };
  generatedAt: string;
};

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtMs(value: number): string {
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function fallbackToneColor(rate: number): string {
  if (rate >= 0.05) return "#b91c1c"; // red
  if (rate >= 0.01) return "#ca8a04"; // amber
  return "#166534"; // green
}

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

          {/* LLM response time per step (#250 part B) */}
          <div className="card" style={{ marginTop: 12 }}>
            <h3 style={{ marginBottom: 6 }}>LLM 回應時間（依步驟）</h3>
            <small style={{ display: "block", marginBottom: 8, color: "#64748b" }}>
              從訊息 timestamp 估算（student → 接續 ai 同步驟）；異常值（&gt; 5 分鐘）已濾除。
            </small>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>步驟</th>
                    <th>中位數</th>
                    <th>平均</th>
                    <th>樣本數</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.llmResponseTime)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([step, bucket]) => (
                      <tr key={step}>
                        <td>Step {step}</td>
                        <td>{fmtMs(bucket.median)}</td>
                        <td>{fmtMs(bucket.avg)}</td>
                        <td>{bucket.samples}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {Object.keys(data.llmResponseTime).length === 0 ? (
              <small>尚無可用樣本。</small>
            ) : null}
          </div>

          {/* Fallback rate (#250 part C) */}
          <div className="card" style={{ marginTop: 12 }}>
            <h3 style={{ marginBottom: 6 }}>LLM Fallback 觸發率</h3>
            <small style={{ display: "block", marginBottom: 8, color: "#64748b" }}>
              ai 訊息含 fallback 標誌字串的比例。&gt; 5% 紅燈、1-5% 黃燈、&lt; 1% 綠燈。
            </small>
            <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <small style={{ color: "#475569" }}>整體</small>
                <div style={{ fontSize: 18, fontWeight: 600, color: fallbackToneColor(data.fallbackRate.overall.rate) }}>
                  {fmtPct(data.fallbackRate.overall.rate)}
                </div>
                <small>{data.fallbackRate.overall.fallbacks} / {data.fallbackRate.overall.totalAi}</small>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>步驟</th>
                    <th>AI 訊息總數</th>
                    <th>Fallback 數</th>
                    <th>觸發率</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.fallbackRate.byStep)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([step, bucket]) => (
                      <tr key={step}>
                        <td>Step {step}</td>
                        <td>{bucket.totalAi}</td>
                        <td>{bucket.fallbacks}</td>
                        <td style={{ color: fallbackToneColor(bucket.rate) }}>{fmtPct(bucket.rate)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {Object.keys(data.fallbackRate.byStep).length === 0 ? (
              <small>尚無 ai 訊息可供分析。</small>
            ) : null}
          </div>

          {/* Artifact health (#250 part D) */}
          <div className="card" style={{ marginTop: 12 }}>
            <h3 style={{ marginBottom: 6 }}>作品 Artifact 健康度</h3>
            <small style={{ display: "block", marginBottom: 8, color: "#64748b" }}>
              所有 spec10 sessions 學生（總計 {data.artifactHealth.totalStudents} 人）的 artifact 完成率。
            </small>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>類型</th>
                    <th>已提交</th>
                    <th>未提交</th>
                    <th>過短</th>
                    <th>完成率</th>
                    <th>平均字元</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Step 3 結構樹</td>
                    <td>{data.artifactHealth.outline.has}</td>
                    <td>{data.artifactHealth.outline.empty}</td>
                    <td>{data.artifactHealth.outline.short ?? 0}（&lt; 20 字）</td>
                    <td>{fmtPct(data.artifactHealth.outline.completionRate)}</td>
                    <td>{data.artifactHealth.outline.avgChars}</td>
                  </tr>
                  <tr>
                    <td>Step 6 初稿</td>
                    <td>{data.artifactHealth.draft6.has}</td>
                    <td>{data.artifactHealth.draft6.empty}</td>
                    <td>{data.artifactHealth.draft6.short ?? 0}（&lt; 100 字）</td>
                    <td>{fmtPct(data.artifactHealth.draft6.completionRate)}</td>
                    <td>{data.artifactHealth.draft6.avgChars}</td>
                  </tr>
                  <tr>
                    <td>Step 8 潤飾稿</td>
                    <td>{data.artifactHealth.draft8.has}</td>
                    <td>{data.artifactHealth.draft8.empty}</td>
                    <td>—</td>
                    <td>{fmtPct(data.artifactHealth.draft8.completionRate)}</td>
                    <td>{data.artifactHealth.draft8.avgChars}</td>
                  </tr>
                  <tr>
                    <td>Step 10 總結報告</td>
                    <td>{data.artifactHealth.step10.has}</td>
                    <td>{data.artifactHealth.step10.empty}</td>
                    <td>—</td>
                    <td>{fmtPct(data.artifactHealth.step10.completionRate)}</td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
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
