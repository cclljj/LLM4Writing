"use client";

import { memo } from "react";
import { renderMessageHtml } from "./renderMessageHtml";

function CourseInfoBanner({
  title,
  genre,
  durationMinutes,
  classNumber,
  groupName,
  groupMemberNames,
  essayDescription,
  supplemental,
  onBackToLobby
}: {
  title: string;
  genre: string;
  durationMinutes: string | number;
  classNumber: string;
  groupName: string;
  groupMemberNames: string[];
  essayDescription: string;
  supplemental: string;
  onBackToLobby: () => void;
}) {
  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ marginBottom: 0 }}>課程內容</h2>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="secondary" style={{ width: "auto" }} onClick={onBackToLobby}>
              返回學生端課程首頁
            </button>
          </div>
        </div>
      </div>

      <div className="card card-info" style={{ padding: "10px 14px" }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 20, lineHeight: 1.4 }}>{title}</p>
        <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
          文體：{genre} / 時長：{durationMinutes} 分鐘
        </p>
        <p style={{ margin: "4px 0 0", lineHeight: 1.5 }}>
          班級：{classNumber} / 組別：{groupName}
        </p>
        <p style={{ margin: "4px 0 0", lineHeight: 1.5 }}>
          組員名單：{groupMemberNames.length > 0 ? groupMemberNames.join("、") : "—"}
        </p>
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: 0 }}><strong>引導說明</strong></p>
          <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderMessageHtml(essayDescription) }} />
        </div>
        <div style={{ marginTop: 10, borderTop: "1px solid var(--info-bg-strong)", paddingTop: 8 }}>
          <p style={{ margin: 0 }}><strong>補充資料</strong></p>
          <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderMessageHtml(supplemental) }} />
        </div>
      </div>
    </>
  );
}

export default memo(CourseInfoBanner);
