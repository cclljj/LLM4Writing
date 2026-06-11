"use client";

import { useId, useState } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  requiredText?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "確認",
  cancelLabel = "取消",
  requiredText,
  busy = false,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  const [typedText, setTypedText] = useState("");
  const inputId = useId();

  if (!open) return null;

  const canConfirm = !requiredText || typedText === requiredText;
  const cancel = () => {
    setTypedText("");
    onCancel();
  };
  const confirm = () => {
    setTypedText("");
    onConfirm();
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={`${inputId}-title`}>
        <h2 id={`${inputId}-title`}>{title}</h2>
        <p>{body}</p>
        {requiredText ? (
          <div style={{ marginTop: 12 }}>
            <label htmlFor={inputId}>請輸入「{requiredText}」以確認</label>
            <input
              id={inputId}
              value={typedText}
              onChange={(event) => setTypedText(event.target.value)}
              autoFocus
              disabled={busy}
            />
          </div>
        ) : null}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="secondary" style={{ width: "auto" }} onClick={cancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className="danger" style={{ width: "auto" }} onClick={confirm} disabled={busy || !canConfirm}>
            {busy ? "處理中..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
