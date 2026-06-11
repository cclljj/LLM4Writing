"use client";

import { memo } from "react";

type GroupProgressRow = {
  sessionId: string;
  groupName: string;
  membersText: string;
  currentStepLabel: string | number;
  stepDurationsText: string;
  totalSpeechCount: number;
};

type PersonalProgressRow = {
  sessionId: string;
  username: string;
  displayName: string;
  groupName: string;
  currentStepLabel: string | number;
  stepDurationsText: string;
  totalSpeechCount: number;
};

function ProgressStatsPanel({
  contextLabel,
  groupRows,
  pagedPersonalRows,
  personalRowCount,
  page,
  totalPages,
  onPageChange
}: {
  contextLabel: string;
  groupRows: GroupProgressRow[];
  pagedPersonalRows: PersonalProgressRow[];
  personalRowCount: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="card">
      <h2>
        課堂進度統計
        {contextLabel ? <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400, marginLeft: 8 }}>— {contextLabel}</span> : null}
      </h2>

      <h3 style={{ marginTop: 8 }}>小組進度統計</h3>
      <div className="table-scroll">
        <table className="pro-table">
          <thead>
            <tr>
              <th>小組組別</th>
              <th>成員</th>
              <th>目前進度</th>
              <th>各步驟停留時間</th>
              <th>總發言數</th>
            </tr>
          </thead>
          <tbody>
            {groupRows.map((row) => (
              <tr key={`group-progress-${row.sessionId}`}>
                <td>{row.groupName}</td>
                <td>{row.membersText}</td>
                <td>Step {row.currentStepLabel}</td>
                <td>{row.stepDurationsText}</td>
                <td>{row.totalSpeechCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {groupRows.length === 0 ? <small>目前沒有可統計的小組資料。</small> : null}

      <h3 style={{ marginTop: 14 }}>個人進度統計</h3>
      <div className="table-scroll">
        <table className="pro-table">
          <thead>
            <tr>
              <th>帳號姓名</th>
              <th>所屬組別</th>
              <th>目前進度</th>
              <th>各步驟停留時間</th>
              <th>總發言數</th>
            </tr>
          </thead>
          <tbody>
            {pagedPersonalRows.map((row) => (
              <tr key={`personal-progress-${row.sessionId}-${row.username}`}>
                <td>{row.displayName} ({row.username})</td>
                <td>{row.groupName}</td>
                <td>Step {row.currentStepLabel}</td>
                <td>{row.stepDurationsText}</td>
                <td>{row.totalSpeechCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {personalRowCount === 0 ? (
        <small>目前沒有可統計的個人資料。</small>
      ) : (
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <small style={{ alignSelf: "center" }}>
            第 {page} / {totalPages} 頁，共 {personalRowCount} 位學生（每頁 10 位）
          </small>
          <button
            type="button"
            className="secondary"
            style={{ width: "auto" }}
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            上一頁
          </button>
          <button
            type="button"
            className="secondary"
            style={{ width: "auto" }}
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(ProgressStatsPanel);
