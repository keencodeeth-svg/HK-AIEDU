"use client";

import Link from "next/link";
import Card from "@/components/Card";
import { loginPlaceholderMap, loginRoleOptions, useLoginPage } from "./useLoginPage";

export default function LoginPage() {
  const loginPage = useLoginPage();

  return (
    <div className="grid auth-page" style={{ gap: 18, maxWidth: 520 }}>
      <div className="section-head">
        <div>
          <h2>登录航科AI教育</h2>
          <div className="section-sub">进入学生、教师、家长与管理端的学习空间。</div>
        </div>
        <span className="chip">账号中心</span>
      </div>
      <Card title="登录" tag="入口">
        <form onSubmit={loginPage.handleSubmit} className="auth-form">
          <div>
            <div className="section-title">选择身份</div>
            <div className="role-grid">
              {loginRoleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`role-card${loginPage.role === option.value ? " active" : ""}`}
                  onClick={() => loginPage.setField("role", option.value)}
                >
                  <div className="role-title">{option.label}</div>
                  <div className="role-desc">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <label className="form-field">
            <div className="section-title">邮箱</div>
            <input
              className="form-control"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              value={loginPage.email}
              onChange={(event) => loginPage.setField("email", event.target.value)}
              placeholder={loginPlaceholderMap[loginPage.role]}
              required
            />
          </label>
          <label className="form-field">
            <div className="section-title">密码</div>
            <input
              className="form-control"
              type="password"
              autoComplete="current-password"
              value={loginPage.password}
              onChange={(event) => loginPage.setField("password", event.target.value)}
              placeholder="Student123"
              required
            />
          </label>
          {loginPage.error ? <div className="status-note error">{loginPage.error}</div> : null}
          <button className="button primary" type="submit" disabled={loginPage.loading}>
            {loginPage.loading ? "登录中..." : "登录"}
          </button>
        </form>
        <div className="auth-footnote">
          演示账号：student@demo.com / Student123（可切换身份后登录）
        </div>
        <div className="form-note" style={{ marginTop: 10 }}>
          忘记密码、忘记账号或账号被锁定？<Link href="/recover">去发起恢复请求</Link>
        </div>
        <div className="pill-list" style={{ marginTop: 12 }}>
          <span className="pill">学生注册</span>
          <span className="pill">家长注册</span>
          <span className="pill">教师注册</span>
          <span className="pill">管理员注册</span>
          <span className="pill">学校管理员注册</span>
        </div>
        <div className="auth-links">
          <div>
            没有账号？<Link href={`/register?role=${loginPage.role}&entry=login`}>去注册</Link>
          </div>
          <div>
            教师注册：<Link href="/teacher/register">去注册</Link>
          </div>
          <div>
            管理员注册：<Link href="/admin/register">去注册</Link>
          </div>
          <div>
            学校管理员注册：<Link href="/school/register">去注册</Link>
          </div>
          <div>
            账号恢复：<Link href="/recover">去申请</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
