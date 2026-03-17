"use client";

import { useState } from "react";
import Card from "@/components/Card";
import PasswordPolicyHint from "@/components/auth/PasswordPolicyHint";
import { resolveRegisterFormError } from "@/lib/auth-form-errors";
import { requestJson } from "@/lib/client-request";

export default function TeacherRegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
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
        schoolCode: schoolCode.trim() || undefined,
        inviteCode: inviteCode.trim() || undefined
      };
      await requestJson("/api/auth/teacher-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      window.location.assign("/teacher");
    } catch (err) {
      setError(
        resolveRegisterFormError(err, {
          fallback: "注册失败",
          emailExistsMessage: "该教师邮箱已注册，可直接登录。",
          invalidInviteMessage: "邀请码无效，或当前不允许教师自助注册。",
          invalidSchoolCodeMessage: "学校编码无效，请核对后重试；不填则会归入默认学校。"
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
          <h2>教师注册</h2>
          <div className="section-sub">开启AI教研与班级管理功能。</div>
        </div>
        <span className="chip">教师端</span>
      </div>
      <Card title="教师注册" tag="入驻">
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-field">
            <div className="section-title">姓名</div>
            <input
              className="form-control"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="教师"
            />
          </label>
          <label className="form-field">
            <div className="section-title">邮箱</div>
            <input
              className="form-control"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teacher@demo.com"
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
              placeholder="例如 HKHS01，不填则归入默认学校"
            />
          </label>
          <label className="form-field">
            <div className="section-title">邀请码</div>
            <input
              className="form-control"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="例如 HK-TEACH-2026（不区分大小写）"
            />
            <div className="form-note">
              默认需要邀请码；如后台配置了 TEACHER_INVITE_CODE(S)，支持多个邀请码。
            </div>
          </label>
          {error ? <div className="status-note error">{error}</div> : null}
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "提交中..." : "注册并登录"}
          </button>
        </form>
        <div className="auth-footnote">
          默认必须填写邀请码。仅当服务端显式开启 `TEACHER_ALLOW_INITIAL_SELF_REGISTER=true` 且系统仍没有教师时，才允许首位教师无邀请码注册。
        </div>
        <div className="pill-list" style={{ marginTop: 10 }}>
          <span className="pill">AI 组卷</span>
          <span className="pill">班级学情</span>
          <span className="pill">作业批改</span>
        </div>
      </Card>
    </div>
  );
}
