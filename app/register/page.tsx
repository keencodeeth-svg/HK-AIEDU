"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import { GRADE_OPTIONS } from "@/lib/constants";

export default function RegisterPage() {
  const [role, setRole] = useState<"student" | "parent">("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [grade, setGrade] = useState("4");
  const [studentEmail, setStudentEmail] = useState("");
  const [observerCode, setObserverCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const payload: any = { role, name, email, password };
    if (role === "student") payload.grade = grade;
    if (role === "parent") {
      payload.observerCode = observerCode;
      payload.studentEmail = studentEmail;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "注册失败");
    } else {
      setMessage("注册成功，请登录。");
      setName("");
      setEmail("");
      setPassword("");
      setStudentEmail("");
      setObserverCode("");
    }
    setLoading(false);
  }

  return (
    <div className="grid" style={{ gap: 18, maxWidth: 560 }}>
      <div className="section-head">
        <div>
          <h2>账号注册</h2>
          <div className="section-sub">创建学生或家长账号，进入学习空间。</div>
        </div>
        <span className="chip">学生/家长</span>
      </div>
      <Card title="注册" tag="账户">
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label>
            <div className="section-title">角色</div>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as "student" | "parent")}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="student">学生</option>
              <option value="parent">家长</option>
            </select>
          </label>
          <label>
            <div className="section-title">姓名</div>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">邮箱</div>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">密码</div>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
              默认建议至少 8 位，包含大写字母、小写字母和数字（以系统配置为准）。
            </div>
          </label>
          {role === "student" ? (
            <label>
              <div className="section-title">年级</div>
              <select
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {GRADE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                <div className="section-title">绑定码（推荐）</div>
                <input
                  value={observerCode}
                  onChange={(event) => setObserverCode(event.target.value)}
                  placeholder="学生资料页获取绑定码"
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
              <label>
                <div className="section-title">绑定学生邮箱（可选）</div>
                <input
                  value={studentEmail}
                  onChange={(event) => setStudentEmail(event.target.value)}
                  placeholder="student@demo.com"
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
            </>
          )}

          {error ? <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div> : null}
          {message ? <div style={{ color: "#027a48", fontSize: 13 }}>{message}</div> : null}

          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "提交中..." : "注册"}
          </button>
        </form>
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--ink-1)" }}>
          已有账号？<Link href="/login">去登录</Link>
        </div>
        <div className="pill-list" style={{ marginTop: 10 }}>
          <span className="pill">支持 K12 学段</span>
          <span className="pill">多学科同步</span>
          <span className="pill">家校协同</span>
        </div>
      </Card>
    </div>
  );
}
