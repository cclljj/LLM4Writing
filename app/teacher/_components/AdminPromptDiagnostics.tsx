"use client";

import { useEffect, useState } from "react";
type DiagnosticsWindow = "24h" | "7d" | "14d" | "30d";
const WINDOW_OPTIONS: DiagnosticsWindow[] = ["24h", "7d", "14d", "30d"];

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
    spec10InWindow: number;
    recent: Array<{
      sessionId: string;
      activityTitle: string;
      school: string;
      classNumber: string;
      groupName: string;
      currentStep: number;
      participantCount: number;
      messageCount: number;
      lastMessageAt: string;
      estimatedCompletionTokens: number;
      activityStatus: "active" | "idle" | "stuck";
      currentStepDwellMinutes: number;
      groupStepDistribution: string;
      rejectedAnswerCount: number;
    }>;
  };
  timeWindow: DiagnosticsWindow;
  llmResponseTime: Record<string, ResponseTimeBucket>;
  fallbackRate: {
    byStep: Record<string, FallbackBucket>;
    overall: FallbackBucket;
  };
  stepKpis: Record<
    string,
    {
      successRate: number;
      fallbackRate: number;
      refusalRate: number;
      avgWaitMs: number;
      totalAi: number;
      successes: number;
      fallbacks: number;
      acceptedAnswers: number;
      rejectedAnswers: number;
      waitSamples: number;
    }
  >;
  trends: {
    byCourse: Array<{
      key: string;
      school: string;
      classNumber: string;
      activityTitle: string;
      points: Array<{
        date: string;
        totalAi: number;
        successes: number;
        fallbacks: number;
        acceptedAnswers: number;
        rejectedAnswers: number;
        waitSamples: number;
        avgWaitMs: number;
        successRate: number;
        fallbackRate: number;
        refusalRate: number;
      }>;
    }>;
    byClass: Array<{
      key: string;
      school: string;
      classNumber: string;
      activityTitle: string;
      points: Array<{
        date: string;
        totalAi: number;
        successes: number;
        fallbacks: number;
        acceptedAnswers: number;
        rejectedAnswers: number;
        waitSamples: number;
        avgWaitMs: number;
        successRate: number;
        fallbackRate: number;
        refusalRate: number;
      }>;
    }>;
  };
  llmErrorTaxonomy: {
    totalCalls: number;
    totalClassified: number;
    timeout: { count: number; rate: number };
    truncation: { count: number; rate: number };
    parseFail: { count: number; rate: number };
    other: { count: number; rate: number };
    byKind: Array<{
      kind: "chat" | "stream";
      total: number;
      errors: number;
      errorRate: number;
      truncations: number;
      truncationRate: number;
      avgMs: number;
      medianMs: number;
      p95Ms: number;
      sampleSize: number;
      errorCategories: { timeout: number; truncation: number; parse_fail: number; other: number };
    }>;
  };
  artifactHealth: {
    totalStudents: number;
    outline: ArtifactBucket;
    draft6: ArtifactBucket;
    draft8: ArtifactBucket;
    step10: { has: number; empty: number; completionRate: number };
  };
  tokenUsage: {
    overall: { aiMessages: number; estimatedCompletionTokens: number; avgPerMessage: number };
    byStep: Record<string, { aiMessages: number; estimatedCompletionTokens: number; avgPerMessage: number }>;
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

function fmtNum(value: number): string {
  return new Intl.NumberFormat("zh-TW").format(value);
}

function trendValuesText(values: number[]): string {
  if (values.length === 0) return "—";
  return values.map((v) => `${(v * 100).toFixed(0)}%`).join(" → ");
}

function activityStatusLabel(status: "active" | "idle" | "stuck"): string {
  if (status === "active") return "活躍";
  if (status === "stuck") return "可能卡住";
  return "閒置";
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
  const [timeWindow, setTimeWindow] = useState<DiagnosticsWindow>("7d");

  async function loadDiagnostics(window: DiagnosticsWindow = timeWindow) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/diagnostics?window=${window}`, { cache: "no-store" });
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
    loadDiagnostics(timeWindow).catch(() => undefined);
  }, [timeWindow]);

  return (
    <div data-testid="admin-prompt-diagnostics">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Prompt / LLM 診斷面板</h2>
          </div>
          <button type="button" className="secondary" style={{ width: "auto" }} onClick={() => loadDiagnostics()}>
            重新整理診斷
          </button>
        </div>
        {loading ? <small style={{ display: "block", marginTop: 10 }}>診斷資料載入中...</small> : null}
        {error ? <small style={{ display: "block", marginTop: 10, color: "#b91c1c" }}>{error}</small> : null}
      </div>

      {data ? (
        <>
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>LLM 環境設定狀況</h3>
            <div className="metric-grid" style={{ marginTop: 0 }}>
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
                <span className="metric-value">{data.sessions.spec10InWindow}</span>
                <small>{data.timeWindow} 內 spec10 sessions</small>
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
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 10 }}>LLM 使用狀況統計</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              {WINDOW_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={timeWindow === option ? "" : "secondary"}
                  style={{ width: "auto", minWidth: 64 }}
                  onClick={() => setTimeWindow(option)}
                  disabled={loading && timeWindow === option}
                >
                  {option}
                </button>
              ))}
            </div>

            <h4 style={{ marginBottom: 6 }}>LLM 回應時間（依步驟）</h4>
            <small style={{ display: "block", marginBottom: 8, color: "#64748b" }}>
              範圍：最近 {data.timeWindow}。從訊息 timestamp 估算（student → 接續 ai 同步驟）；異常值（&gt; 5 分鐘）已濾除。
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

            <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "14px 0" }} />
            <h4 style={{ marginBottom: 6 }}>LLM Fallback 觸發率</h4>
            <small style={{ display: "block", marginBottom: 8, color: "#64748b" }}>
              範圍：最近 {data.timeWindow}。ai 訊息含 fallback 標誌字串的比例。&gt; 5% 紅燈、1-5% 黃燈、&lt; 1% 綠燈。
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

            <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "14px 0" }} />
            <h4 style={{ marginBottom: 6 }}>每步驟 KPI（成功率 / fallback 率 / 拒答率 / 平均等待）</h4>
            <small style={{ display: "block", marginBottom: 8, color: "#64748b" }}>
              範圍：最近 {data.timeWindow}。成功率以 AI 回覆是否為 fallback 估算；拒答率為拒答次數 /（已送出+拒答）。
            </small>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>步驟</th>
                    <th>成功率</th>
                    <th>Fallback 率</th>
                    <th>拒答率</th>
                    <th>平均等待</th>
                    <th>等待樣本</th>
                    <th>AI 回覆</th>
                    <th>拒答次數</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.stepKpis)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([step, kpi]) => (
                      <tr key={step}>
                        <td>Step {step}</td>
                        <td>{fmtPct(kpi.successRate)}</td>
                        <td style={{ color: fallbackToneColor(kpi.fallbackRate) }}>{fmtPct(kpi.fallbackRate)}</td>
                        <td>{fmtPct(kpi.refusalRate)}</td>
                        <td>{fmtMs(kpi.avgWaitMs)}</td>
                        <td>{fmtNum(kpi.waitSamples)}</td>
                        <td>{fmtNum(kpi.totalAi)}</td>
                        <td>{fmtNum(kpi.rejectedAnswers)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {Object.keys(data.stepKpis).length === 0 ? <small>尚無步驟 KPI 樣本。</small> : null}

            <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "14px 0" }} />
            <h4 style={{ marginBottom: 6 }}>課程 / 班級趨勢</h4>
            <small style={{ display: "block", marginBottom: 8, color: "#64748b" }}>
              日粒度趨勢（最近 {data.timeWindow}）：顯示成功率、fallback 率、拒答率、平均等待時間。
            </small>
            <h5 style={{ marginBottom: 6 }}>課程維度</h5>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>學校</th>
                    <th>班級</th>
                    <th>課程</th>
                    <th>日期點</th>
                    <th>成功率趨勢</th>
                    <th>Fallback 趨勢</th>
                    <th>拒答率趨勢</th>
                    <th>最近平均等待</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trends.byCourse.map((series) => {
                    const latest = series.points.at(-1);
                    return (
                      <tr key={series.key}>
                        <td>{series.school}</td>
                        <td>{series.classNumber}</td>
                        <td>{series.activityTitle}</td>
                        <td>{series.points.length}</td>
                        <td>{trendValuesText(series.points.map((point) => point.successRate))}</td>
                        <td>{trendValuesText(series.points.map((point) => point.fallbackRate))}</td>
                        <td>{trendValuesText(series.points.map((point) => point.refusalRate))}</td>
                        <td>{latest ? fmtMs(latest.avgWaitMs) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.trends.byCourse.length === 0 ? <small>尚無課程趨勢資料。</small> : null}

            <h5 style={{ marginBottom: 6, marginTop: 12 }}>班級維度</h5>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>學校</th>
                    <th>班級</th>
                    <th>日期點</th>
                    <th>成功率趨勢</th>
                    <th>Fallback 趨勢</th>
                    <th>拒答率趨勢</th>
                    <th>最近平均等待</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trends.byClass.map((series) => {
                    const latest = series.points.at(-1);
                    return (
                      <tr key={series.key}>
                        <td>{series.school}</td>
                        <td>{series.classNumber}</td>
                        <td>{series.points.length}</td>
                        <td>{trendValuesText(series.points.map((point) => point.successRate))}</td>
                        <td>{trendValuesText(series.points.map((point) => point.fallbackRate))}</td>
                        <td>{trendValuesText(series.points.map((point) => point.refusalRate))}</td>
                        <td>{latest ? fmtMs(latest.avgWaitMs) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.trends.byClass.length === 0 ? <small>尚無班級趨勢資料。</small> : null}

            <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "14px 0" }} />
            <h4 style={{ marginBottom: 6 }}>LLM 錯誤分類（timeout / truncation / parse fail）</h4>
            <small style={{ display: "block", marginBottom: 8, color: "#64748b" }}>
              來源：持久化事件表（`llm_events` / `learning_events`）。`truncation` 包含回覆被長度截斷但後續續寫成功的事件。
            </small>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <small style={{ color: "#475569" }}>timeout</small>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtNum(data.llmErrorTaxonomy.timeout.count)}</div>
                <small>{fmtPct(data.llmErrorTaxonomy.timeout.rate)}</small>
              </div>
              <div>
                <small style={{ color: "#475569" }}>truncation</small>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtNum(data.llmErrorTaxonomy.truncation.count)}</div>
                <small>{fmtPct(data.llmErrorTaxonomy.truncation.rate)}</small>
              </div>
              <div>
                <small style={{ color: "#475569" }}>parse fail</small>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtNum(data.llmErrorTaxonomy.parseFail.count)}</div>
                <small>{fmtPct(data.llmErrorTaxonomy.parseFail.rate)}</small>
              </div>
              <div>
                <small style={{ color: "#475569" }}>other</small>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtNum(data.llmErrorTaxonomy.other.count)}</div>
                <small>{fmtPct(data.llmErrorTaxonomy.other.rate)}</small>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>呼叫類型</th>
                    <th>總呼叫</th>
                    <th>錯誤數</th>
                    <th>錯誤率</th>
                    <th>截斷事件</th>
                    <th>截斷率</th>
                    <th>平均耗時</th>
                    <th>P95</th>
                  </tr>
                </thead>
                <tbody>
                  {data.llmErrorTaxonomy.byKind.map((bucket) => (
                    <tr key={bucket.kind}>
                      <td>{bucket.kind}</td>
                      <td>{fmtNum(bucket.total)}</td>
                      <td>{fmtNum(bucket.errors)}</td>
                      <td>{fmtPct(bucket.errorRate)}</td>
                      <td>{fmtNum(bucket.truncations)}</td>
                      <td>{fmtPct(bucket.truncationRate)}</td>
                      <td>{fmtMs(bucket.avgMs)}</td>
                      <td>{fmtMs(bucket.p95Ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "14px 0" }} />
            <h4 style={{ marginBottom: 6 }}>作品 Artifact 健康度</h4>
            <small style={{ display: "block", marginBottom: 8, color: "#64748b" }}>
              範圍：最近 {data.timeWindow} 內有活動的 spec10 sessions（總計 {data.artifactHealth.totalStudents} 人）的 artifact 完成率。
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
            <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "14px 0" }} />
            <h4 style={{ marginBottom: 6 }}>Token 使用量（估算）</h4>
            <small style={{ display: "block", marginBottom: 8, color: "#64748b" }}>
              範圍：最近 {data.timeWindow}。以 AI 回覆文字進行 completion token 估算（非 provider 帳單精算值）。
            </small>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <small style={{ color: "#475569" }}>估算總 tokens</small>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtNum(data.tokenUsage.overall.estimatedCompletionTokens)}</div>
              </div>
              <div>
                <small style={{ color: "#475569" }}>AI 訊息數</small>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtNum(data.tokenUsage.overall.aiMessages)}</div>
              </div>
              <div>
                <small style={{ color: "#475569" }}>每則平均 tokens</small>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtNum(data.tokenUsage.overall.avgPerMessage)}</div>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>步驟</th>
                    <th>AI 訊息數</th>
                    <th>估算 tokens</th>
                    <th>每則平均</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.tokenUsage.byStep)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([step, bucket]) => (
                      <tr key={step}>
                        <td>Step {step}</td>
                        <td>{fmtNum(bucket.aiMessages)}</td>
                        <td>{fmtNum(bucket.estimatedCompletionTokens)}</td>
                        <td>{fmtNum(bucket.avgPerMessage)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {Object.keys(data.tokenUsage.byStep).length === 0 ? <small>尚無可用 token 估算樣本。</small> : null}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 10 }}>近期使用狀況</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>近期 Session</th>
                    <th>學校</th>
                    <th>班級</th>
                    <th>組別</th>
                    <th>Step</th>
                    <th>成員</th>
                    <th>訊息</th>
                    <th>估算 Token</th>
                    <th>活躍度</th>
                    <th>停留時長</th>
                    <th>小組進度分布</th>
                    <th>拒答次數</th>
                    <th>最後事件</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessions.recent.map((session) => (
                    <tr key={session.sessionId}>
                      <td>{session.activityTitle}</td>
                      <td>{session.school}</td>
                      <td>{session.classNumber}</td>
                      <td>{session.groupName}</td>
                      <td>Step {session.currentStep}</td>
                      <td>{session.participantCount}</td>
                      <td>{session.messageCount}</td>
                      <td>{fmtNum(session.estimatedCompletionTokens)}</td>
                      <td>{activityStatusLabel(session.activityStatus)}</td>
                      <td>{fmtNum(session.currentStepDwellMinutes)} 分</td>
                      <td>{session.groupStepDistribution || "—"}</td>
                      <td>{fmtNum(session.rejectedAnswerCount)}</td>
                      <td>{new Date(session.lastMessageAt).toLocaleString("zh-TW")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.sessions.recent.length === 0 ? <small style={{ display: "block", marginTop: 8 }}>目前沒有可診斷的 session。</small> : null}
            <small style={{ display: "block", marginTop: 8 }}>更新時間：{new Date(data.generatedAt).toLocaleString("zh-TW")}</small>
          </div>
        </>
      ) : null}
    </div>
  );
}
