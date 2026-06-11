"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { formatTaipeiDate, formatTaipeiTime } from "@/src/lib/time-format";

type AuditLogEntry = {
  id: string;
  createdAt: string;
  actorUsername: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  details: Record<string, unknown>;
};

const DAY_OPTIONS = [1, 3, 7, 14, 30];

function mapActionLabel(action: string): string {
  if (action === "openclass_create") return "新增任務";
  if (action === "activity_delete") return "刪除課程";
  if (action === "teacher_step_switch") return "切換步驟";
  if (action === "user_reset_password") return "重設密碼";
  return action;
}

export default function AdminAuditLogPanel() {
  const [days, setDays] = useState(7);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAuditLogs = useCallback(async (nextDays = days) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/audit-logs?days=${nextDays}&limit=400`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "audit_log_load_failed");
        setLogs([]);
        return;
      }
      setLogs(payload.logs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "audit_log_load_failed");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    deferStateUpdate(() => {
      loadAuditLogs(days).catch(() => undefined);
    });
  }, [days, loadAuditLogs]);

  const grouped = useMemo(() => {
    const groups = new Map<string, AuditLogEntry[]>();
    for (const log of logs) {
      const day = formatTaipeiDate(log.createdAt);
      const bucket = groups.get(day) ?? [];
      bucket.push(log);
      groups.set(day, bucket);
    }
    return Array.from(groups.entries());
  }, [logs]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ marginBottom: 0 }}>操作歷史 Log</h2>
        <div className="row" style={{ gap: 8, alignItems: "center", width: "auto" }}>
          <small style={{ color: "#64748b" }}>時間範圍</small>
          {DAY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={days === option ? "" : "secondary"}
              style={{ width: "auto", minWidth: 56 }}
              onClick={() => setDays(option)}
            >
              {option} 天
            </button>
          ))}
          <button type="button" className="secondary" style={{ width: "auto" }} onClick={() => loadAuditLogs(days)}>
            重新整理
          </button>
        </div>
      </div>

      {loading ? <small style={{ display: "block", marginTop: 10 }}>載入紀錄中...</small> : null}
      {error ? <small style={{ display: "block", marginTop: 10, color: "#b91c1c" }}>{error}</small> : null}

      {!loading && !error && grouped.length === 0 ? (
        <small style={{ display: "block", marginTop: 10 }}>目前沒有可顯示的操作紀錄。</small>
      ) : null}

      {grouped.map(([day, entries]) => (
        <div key={day} className="card" style={{ marginTop: 12, marginBottom: 0 }}>
          <h3 style={{ marginBottom: 8 }}>{day}</h3>
          <div className="table-scroll">
            <table className="pro-table">
              <thead>
                <tr>
                  <th>時間</th>
                  <th>操作者</th>
                  <th>動作</th>
                  <th>目標</th>
                  <th>細節</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatTaipeiTime(entry.createdAt, { hour12: false })}</td>
                    <td>{entry.actorUsername} ({entry.actorRole})</td>
                    <td>{mapActionLabel(entry.action)}</td>
                    <td>{entry.targetType}:{entry.targetLabel || entry.targetId || "—"}</td>
                    <td>
                      <small>{JSON.stringify(entry.details ?? {})}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
