"use client";

import { memo } from "react";
import OutlineEditor from "./OutlineEditor";

function MakeupOutlineCard({
  serverMermaid,
  completeHint,
  onSave,
  onComplete
}: {
  serverMermaid: string;
  completeHint: string;
  onSave: (mermaid: string) => Promise<void>;
  onComplete: (mermaid: string) => Promise<void>;
}) {
  return (
    <div className="card">
      <h2>需補個人結構圖</h2>
      <small style={{ display: "block", marginBottom: 8 }}>
        你目前仍可查看歷史內容；請先完成自己的結構圖，再進入正式寫作。
      </small>
      <OutlineEditor
        serverMermaid={serverMermaid}
        locked={false}
        lockedLabel="已完成個人結構圖補做"
        onSave={onSave}
        onComplete={onComplete}
        completeLabel="完成個人結構圖"
        completeHint={completeHint}
      />
    </div>
  );
}

export default memo(MakeupOutlineCard);
