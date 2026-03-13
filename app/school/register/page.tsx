"use client";

import { useState } from "react";
import Card from "@/components/Card";
import PasswordPolicyHint from "@/components/auth/PasswordPolicyHint";

export default function SchoolRegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/school-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          password,
          schoolName: schoolName || undefined,
          schoolCode: schoolCode || undefined,
          inviteCode: inviteCode || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "注册失败");
      }
      window.location.assign("/school");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid auth-page" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>学校管理员注册</h2>
          <div className="section-sub">创建或绑定学校组织，进入学校管理控制台。</div>
        </div>
        <span className="chip">学校端</span>
      </div>
      <Card title="学校管理员注册" tag="组织">
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-field">
            <div className="section-title">姓名</div>
            <input
              className="form-control"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="学校管理员"
            />
          </label>
          <label className="form-field">
            <div className="section-title">邮箱</div>
            <input
              className="form-control"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="school-admin@demo.com"
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
            <div className="section-title">学校编码（可选）</div>
            <input
              className="form-control"
              value={schoolCode}
              onChange={(event) => setSchoolCode(event.target.value)}
              placeholder="例如 HKHS01，已存在学校可直接绑定"
            />
          </label>
          <label className="form-field">
            <div className="section-title">学校名称（可选）</div>
            <input
              className="form-control"
              value={schoolName}
              onChange={(event) => setSchoolName(event.target.value)}
              placeholder="如果学校编码不存在，可填写名称自动创建"
            />
          </label>
          <label className="form-field">
            <div className="section-title">邀请码</div>
            <input
              className="form-control"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="如已配置 SCHOOL_ADMIN_INVITE_CODE(S)，请填写"
            />
          </label>
          {error ? <div className="status-note error">{error}</div> : null}
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "提交中..." : "注册并登录"}
          </button>
        </form>
        <div className="auth-footnote">
          默认必须填写邀请码。仅当服务端显式开启 `SCHOOL_ADMIN_ALLOW_INITIAL_SELF_REGISTER=true` 且系统仍没有学校管理员时，才允许首位学校管理员无邀请码注册。
        </div>
      </Card>
    </div>
  );
}
