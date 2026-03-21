"use client";

import Card from "@/components/Card";
import PasswordPolicyHint from "@/components/auth/PasswordPolicyHint";
import { useManagedRedirectRegisterForm } from "@/components/auth/useManagedRedirectRegisterForm";
import { resolveRegisterFormError } from "@/lib/auth-form-errors";

export default function AdminRegisterPage() {
  const registerForm = useManagedRedirectRegisterForm({
    initialValues: {
      email: "",
      name: "",
      password: "",
      inviteCode: ""
    },
    endpoint: "/api/auth/admin-register",
    redirectTo: "/admin",
    buildPayload: (values) => ({
      email: values.email.trim(),
      name: values.name.trim(),
      password: values.password,
      inviteCode: values.inviteCode.trim() || undefined
    }),
    resolveError: (error) =>
      resolveRegisterFormError(error, {
        fallback: "注册失败",
        emailExistsMessage: "该管理员邮箱已注册，可直接登录。",
        invalidInviteMessage: "邀请码无效，或当前不允许管理员自助注册。"
      })
  });

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
        <form onSubmit={registerForm.handleSubmit} className="auth-form">
          <label className="form-field">
            <div className="section-title">姓名</div>
            <input
              className="form-control"
              value={registerForm.values.name}
              onChange={(event) => registerForm.setValue("name", event.target.value)}
              placeholder="管理员"
            />
          </label>
          <label className="form-field">
            <div className="section-title">邮箱</div>
            <input
              className="form-control"
              value={registerForm.values.email}
              onChange={(event) => registerForm.setValue("email", event.target.value)}
              placeholder="admin@demo.com"
            />
          </label>
          <label className="form-field">
            <div className="section-title">密码</div>
            <input
              className="form-control"
              type="password"
              value={registerForm.values.password}
              onChange={(event) => registerForm.setValue("password", event.target.value)}
              placeholder="默认建议至少 8 位，含大小写和数字"
            />
            <PasswordPolicyHint />
          </label>
          <label className="form-field">
            <div className="section-title">邀请码</div>
            <input
              className="form-control"
              value={registerForm.values.inviteCode}
              onChange={(event) => registerForm.setValue("inviteCode", event.target.value)}
              placeholder="如已配置 ADMIN_INVITE_CODE，请填写"
            />
          </label>
          {registerForm.error ? <div className="status-note error">{registerForm.error}</div> : null}
          <button className="button primary" type="submit" disabled={registerForm.loading}>
            {registerForm.loading ? "提交中..." : "注册并登录"}
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
