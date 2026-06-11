"use client";

import { memo } from "react";
import { renderMessageHtml } from "./renderMessageHtml";

type DebugMessage = {
  id: string;
  role: string;
  userId?: string;
  text: string;
  at: string;
  step: number;
};

function DebugLogCard({ messages }: { messages: DebugMessage[] }) {
  return (
    <>
      <hr />
      <div className="card">
        <h2>完整對話紀錄（除錯）</h2>
        {messages.map((message) => (
          <div key={message.id} style={{ borderTop: "1px solid var(--line-soft)", padding: "8px 0" }}>
            <strong>[S{message.step}] {message.role}{message.userId ? `(${message.userId})` : ""}</strong>
            <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }} />
            <small>{message.at}</small>
          </div>
        ))}
      </div>
    </>
  );
}

export default memo(DebugLogCard);
