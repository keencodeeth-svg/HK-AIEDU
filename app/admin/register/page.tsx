"use client";

import { useState } from "react";
import Card from "@/components/Card";
import PasswordPolicyHint from "@/components/auth/PasswordPolicyHint";
import { resolveRegisterFormError } from "@/lib/auth-form-errors";
import { requestJson } from "@/lib/client-request";

export default function AdminRegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const normalizedEmail = email.trim();
      const normalizedName = name.trim();
      const payload = {
        email: normalizedEmail,
        name: normalizedName,
        password,
        inviteCode: inviteCode.trim() || undefined
      };
      await requestJson("/api/auth/admin-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      window.location.assign("/admin");
    } catch (err) {
      setError(
        resolveRegisterFormError(err, {
          fallback: "注册失败",
          emailExistsMessage: "该管理员邮箱已注册，可直接登录。",
          invalidInviteMessage: "邀请码无效，或当前不允许管理员自助注册。"
        })
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid auth-page" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>管理员注册</h2>
          <div className="section-sub">配置题库、知识点树与平台权限。</div>
        </div>
        <span className="chip">管理端</span>
      </div>
      <Card title="管理员注册" tag="权限">
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-field">
            <div className="section-title">姓名</div>
            <input
              className="form-control"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="管理员"
            />
          </label>
          <label className="form-field">
            <div className="section-title">邮箱</div>
            <input
              className="form-control"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@demo.com"
            />
          </label>
          <label className="form-field">
            <div className="section-title">密码</div>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="默认建议至少 8 位，含大小写和数字"
            />
            <PasswordPolicyHint />
          </label>
          <label className="form-field">
            <div className="section-title">邀请码</div>
            <input
              className="form-control"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="如已配置 ADMIN_INVITE_CODE，请填写"
            />
          </label>
          {error ? <div className="status-note error">{error}</div> : null}
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "提交中..." : "注册并登录"}
          </button>
        </form>
        <div className="auth-footnote">
          默认必须填写邀请码。仅当服务端显式开启 `ADMIN_ALLOW_INITIAL_SELF_REGISTER=true` 且系统仍没有管理员时，才允许首个管理员无邀请码注册。
        </div>
        <div className="pill-list" style={{ marginTop: 10 }}>
          <span className="pill">题库治理</span>
          <span className="pill">知识点树</span>
          <span className="pill">运营报表</span>
        </div>
      </Card>
    </div>
  );
}
