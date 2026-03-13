"use client";

import { useEffect, useRef, useState } from "react";

type AdminStepUpDialogProps = {
  open: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
};

export default function AdminStepUpDialog({
  open,
  pending,
  error,
  onClose,
  onSubmit
}: AdminStepUpDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setPassword("");
      return;
    }
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-hidden={false}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        background: "rgba(15, 23, 42, 0.38)",
        padding: 16
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-step-up-title"
        style={{
          width: "min(420px, 100%)",
          borderRadius: 18,
          background: "var(--card)",
          border: "1px solid var(--stroke)",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.24)",
          padding: 20,
          display: "grid",
          gap: 14
        }}
      >
        <div>
          <div id="admin-step-up-title" className="section-title" style={{ fontSize: 18 }}>
            管理员二次验证
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--ink-1)" }}>
            这是高风险管理操作。请输入当前登录密码完成一次短时确认。
          </div>
        </div>

        <form
          className="grid"
          style={{ gap: 12 }}
          onSubmit={(event) => {
            event.preventDefault();
            if (!password.trim() || pending) {
              return;
            }
            void onSubmit(password);
          }}
        >
          <label className="form-field" style={{ marginBottom: 0 }}>
            <div className="section-title">当前密码</div>
            <input
              ref={inputRef}
              className="form-control"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入当前登录密码"
              disabled={pending}
            />
          </label>

          {error ? <div className="status-note error">{error}</div> : null}

          <div className="cta-row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="button ghost" type="button" onClick={onClose} disabled={pending}>
              取消
            </button>
            <button className="button primary" type="submit" disabled={pending || !password.trim()}>
              {pending ? "验证中..." : "确认并继续"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
