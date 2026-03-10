"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Card from "@/components/Card";
import PasswordPolicyHint from "@/components/auth/PasswordPolicyHint";
import { GRADE_OPTIONS } from "@/lib/constants";
import type { RegisterPayload, RegisterResponse, RegisterRole } from "./types";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const [role, setRole] = useState<RegisterRole>("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [grade, setGrade] = useState("4");
  const [schoolCode, setSchoolCode] = useState("");
  const [observerCode, setObserverCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const nextRole = searchParams.get("role");
    if (nextRole === "student" || nextRole === "parent") {
      setRole(nextRole);
    }
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const payload: RegisterPayload =
      role === "student"
        ? {
            role,
            name,
            email,
            password,
            grade,
            schoolCode: schoolCode || undefined
          }
        : {
            role,
            name,
            email,
            password,
            observerCode
          };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = (await res.json()) as RegisterResponse;
    if (!res.ok) {
      setError(data.error ?? "注册失败");
    } else {
      setMessage("注册成功，请登录。");
      setName("");
      setEmail("");
      setPassword("");
      setSchoolCode("");
      setObserverCode("");
    }
    setLoading(false);
  }

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
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-field">
            <div className="section-title">角色</div>
            <select className="form-control" value={role} onChange={(event) => setRole(event.target.value as RegisterRole)}>
              <option value="student">学生</option>
              <option value="parent">家长</option>
            </select>
            <div className="form-note">会根据角色展示对应的首日填写项，减少第一次注册时的判断成本。</div>
          </label>
          <label className="form-field">
            <div className="section-title">姓名</div>
            <input className="form-control" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="form-field">
            <div className="section-title">邮箱</div>
            <input className="form-control" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="form-field">
            <div className="section-title">密码</div>
            <input className="form-control" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <PasswordPolicyHint />
          </label>
          {role === "student" ? (
            <>
              <label className="form-field">
                <div className="section-title">年级</div>
                <select className="form-control" value={grade} onChange={(event) => setGrade(event.target.value)}>
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
                  value={schoolCode}
                  onChange={(event) => setSchoolCode(event.target.value)}
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
                  value={observerCode}
                  onChange={(event) => setObserverCode(event.target.value)}
                  placeholder="学生资料页获取绑定码"
                />
                <div className="form-note">家长注册必须使用学生资料页中的绑定码，避免仅凭邮箱误绑他人账号。</div>
              </label>
            </>
          )}

          {error ? <div className="status-note error">{error}</div> : null}
          {message ? <div className="status-note success">{message}</div> : null}

          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "提交中..." : "注册"}
          </button>
        </form>
        <div className="section-sub" style={{ marginTop: 12 }}>
          已有账号？<Link href={`/login?role=${role}&entry=register`}>去登录</Link>
        </div>
      </Card>
    </div>
  );
}
