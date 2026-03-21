"use client";

import Link from "next/link";
import Card from "@/components/Card";
import PasswordPolicyHint from "@/components/auth/PasswordPolicyHint";
import { GRADE_OPTIONS } from "@/lib/constants";
import type { RegisterRole } from "./types";
import { useRegisterPage } from "./useRegisterPage";

export default function RegisterPage() {
  const registerPage = useRegisterPage();

  return (
    <div className="grid auth-page" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>账号注册</h2>
          <div className="section-sub">创建学生或家长账号，进入学习空间。</div>
        </div>
        <span className="chip">学生/家长</span>
      </div>
      <Card title="注册" tag="账户">
        <form onSubmit={registerPage.handleSubmit} className="auth-form">
          <label className="form-field">
            <div className="section-title">角色</div>
            <select
              className="form-control"
              value={registerPage.role}
              onChange={(event) => registerPage.setField("role", event.target.value as RegisterRole)}
            >
              <option value="student">学生</option>
              <option value="parent">家长</option>
            </select>
            <div className="form-note">会根据角色展示对应的首日填写项，减少第一次注册时的判断成本。</div>
          </label>
          <label className="form-field">
            <div className="section-title">姓名</div>
            <input
              className="form-control"
              value={registerPage.name}
              onChange={(event) => registerPage.setField("name", event.target.value)}
            />
          </label>
          <label className="form-field">
            <div className="section-title">邮箱</div>
            <input
              className="form-control"
              value={registerPage.email}
              onChange={(event) => registerPage.setField("email", event.target.value)}
            />
          </label>
          <label className="form-field">
            <div className="section-title">密码</div>
            <input
              className="form-control"
              type="password"
              value={registerPage.password}
              onChange={(event) => registerPage.setField("password", event.target.value)}
            />
            <PasswordPolicyHint />
          </label>
          {registerPage.role === "student" ? (
            <>
              <label className="form-field">
                <div className="section-title">年级</div>
                <select
                  className="form-control"
                  value={registerPage.grade}
                  onChange={(event) => registerPage.setField("grade", event.target.value)}
                >
                  {GRADE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <div className="section-title">学校编码（可选）</div>
                <input
                  className="form-control"
                  value={registerPage.schoolCode}
                  onChange={(event) => registerPage.setField("schoolCode", event.target.value)}
                  placeholder="例如 HKHS01，不填则归入默认学校"
                />
              </label>
            </>
          ) : (
            <>
              <label className="form-field">
                <div className="section-title">绑定码</div>
                <input
                  className="form-control"
                  value={registerPage.observerCode}
                  onChange={(event) => registerPage.setField("observerCode", event.target.value)}
                  placeholder="学生资料页获取绑定码"
                />
                <div className="form-note">家长注册必须使用学生资料页中的绑定码，避免仅凭邮箱误绑他人账号。</div>
              </label>
            </>
          )}

          {registerPage.error ? <div className="status-note error">{registerPage.error}</div> : null}
          {registerPage.message ? <div className="status-note success">{registerPage.message}</div> : null}

          <button className="button primary" type="submit" disabled={registerPage.loading}>
            {registerPage.loading ? "提交中..." : "注册"}
          </button>
        </form>
        <div className="section-sub" style={{ marginTop: 12 }}>
          已有账号？<Link href={`/login?role=${registerPage.role}&entry=register`}>去登录</Link>
        </div>
      </Card>
    </div>
  );
}
