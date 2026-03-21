"use client";

import Card from "@/components/Card";
import PasswordPolicyHint from "@/components/auth/PasswordPolicyHint";
import { useManagedRedirectRegisterForm } from "@/components/auth/useManagedRedirectRegisterForm";
import { resolveRegisterFormError } from "@/lib/auth-form-errors";

export default function SchoolRegisterPage() {
  const registerForm = useManagedRedirectRegisterForm({
    initialValues: {
      email: "",
      name: "",
      password: "",
      schoolName: "",
      schoolCode: "",
      inviteCode: ""
    },
    endpoint: "/api/auth/school-register",
    redirectTo: "/school",
    buildPayload: (values) => ({
      email: values.email.trim(),
      name: values.name.trim(),
      password: values.password,
      schoolName: values.schoolName.trim() || undefined,
      schoolCode: values.schoolCode.trim() || undefined,
      inviteCode: values.inviteCode.trim() || undefined
    }),
    resolveError: (error) =>
      resolveRegisterFormError(error, {
        fallback: "注册失败",
        emailExistsMessage: "该学校管理员邮箱已注册，可直接登录。",
        invalidInviteMessage: "邀请码无效，或当前不允许学校管理员自助注册。",
        invalidSchoolCodeMessage: "学校编码无效；若要新建学校，请同时填写学校名称。",
        schoolRequiredMessage: "请填写学校名称，或输入一个有效的学校编码。"
      })
  });

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
        <form onSubmit={registerForm.handleSubmit} className="auth-form">
          <label className="form-field">
            <div className="section-title">姓名</div>
            <input
              className="form-control"
              value={registerForm.values.name}
              onChange={(event) => registerForm.setValue("name", event.target.value)}
              placeholder="学校管理员"
            />
          </label>
          <label className="form-field">
            <div className="section-title">邮箱</div>
            <input
              className="form-control"
              value={registerForm.values.email}
              onChange={(event) => registerForm.setValue("email", event.target.value)}
              placeholder="school-admin@demo.com"
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
            <div className="section-title">学校编码（可选）</div>
            <input
              className="form-control"
              value={registerForm.values.schoolCode}
              onChange={(event) => registerForm.setValue("schoolCode", event.target.value)}
              placeholder="例如 HKHS01，已存在学校可直接绑定"
            />
          </label>
          <label className="form-field">
            <div className="section-title">学校名称（可选）</div>
            <input
              className="form-control"
              value={registerForm.values.schoolName}
              onChange={(event) => registerForm.setValue("schoolName", event.target.value)}
              placeholder="如果学校编码不存在，可填写名称自动创建"
            />
          </label>
          <label className="form-field">
            <div className="section-title">邀请码</div>
            <input
              className="form-control"
              value={registerForm.values.inviteCode}
              onChange={(event) => registerForm.setValue("inviteCode", event.target.value)}
              placeholder="如已配置 SCHOOL_ADMIN_INVITE_CODE(S)，请填写"
            />
          </label>
          {registerForm.error ? <div className="status-note error">{registerForm.error}</div> : null}
          <button className="button primary" type="submit" disabled={registerForm.loading}>
            {registerForm.loading ? "提交中..." : "注册并登录"}
          </button>
        </form>
        <div className="auth-footnote">
          默认必须填写邀请码。仅当服务端显式开启 `SCHOOL_ADMIN_ALLOW_INITIAL_SELF_REGISTER=true` 且系统仍没有学校管理员时，才允许首位学校管理员无邀请码注册。
        </div>
      </Card>
    </div>
  );
}
