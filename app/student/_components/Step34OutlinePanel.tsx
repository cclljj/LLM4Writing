"use client";

import { memo } from "react";
import OutlineSvg from "@/app/_components/OutlineSvg";
import OutlineEditor from "./OutlineEditor";

function Step34OutlinePanel({
  currentStep,
  loginUser,
  participants,
  teammateUsers,
  outlines,
  refUser,
  onRefUserChange,
  step3CompletedByMe,
  step4CompletedByMe,
  waitingStep3Members,
  step3CompleteHint,
  onSave,
  onCompleteStep3
}: {
  currentStep: 3 | 4;
  loginUser: string;
  participants: string[];
  teammateUsers: string[];
  outlines: Record<string, string>;
  refUser: string;
  onRefUserChange: (user: string) => void;
  step3CompletedByMe: boolean;
  step4CompletedByMe: boolean;
  waitingStep3Members: boolean;
  step3CompleteHint: string;
  onSave: (mermaid: string) => Promise<void>;
  onCompleteStep3: (mermaid: string) => Promise<void>;
}) {
  if (currentStep === 3) {
    return (
      <div className="card">
        <h2>文章結構樹</h2>
        <OutlineEditor
          serverMermaid={outlines[loginUser] ?? ""}
          locked={step3CompletedByMe}
          lockedLabel="已完成送出"
          onSave={onSave}
          onComplete={onCompleteStep3}
          completeLabel="完成結構樹"
          completeDisabled={step3CompletedByMe}
          completeHint={step3CompleteHint}
          completedMessage={
            step3CompletedByMe
              ? (waitingStep3Members ? "你已完成結構樹，已鎖定編輯，等待其他同學完成..." : "你已完成結構樹，已鎖定編輯，可等待老師切換下一步。")
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h2>同組同學結構樹</h2>
        <label style={{ marginTop: 10 }}>選擇同學</label>
        <select value={refUser} onChange={(e) => onRefUserChange(e.target.value)}>
          {(teammateUsers.length > 0 ? teammateUsers : participants).map((user) => (
            <option key={user} value={user}>{user}</option>
          ))}
        </select>
        <OutlineSvg compact mermaidText={outlines[refUser] ?? ""} />
      </div>

      <div className="card">
        <h2>我的結構樹（可編修）</h2>
        {step4CompletedByMe ? (
          <>
            <small>你已確認完成此步驟，已鎖定編修；你的變更已自動儲存。</small>
            <OutlineSvg compact mermaidText={outlines[loginUser] ?? ""} />
          </>
        ) : (
          <>
            <small style={{ display: "block", marginBottom: 8 }}>此步驟建議先與同學討論，再修改自己的結構樹。</small>
            <OutlineEditor
              serverMermaid={outlines[loginUser] ?? ""}
              locked={false}
              lockedLabel="已確認完成，編修已鎖定"
              onSave={onSave}
            />
          </>
        )}
      </div>
    </>
  );
}

export default memo(Step34OutlinePanel);
