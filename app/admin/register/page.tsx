"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";

export default function AdminRegisterPage() {
  const router = useRouter();
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
      const res = await fetch("/api/auth/admin-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, inviteCode })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "注册失败");
      }
      router.push("/admin");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 18, maxWidth: 560 }}>
      <div className="section-head">
        <div>
          <h2>管理员注册</h2>
          <div className="section-sub">配置题库、知识点树与平台权限。</div>
        </div>
        <span className="chip">管理端</span>
      </div>
      <Card title="管理员注册" tag="权限">
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label>
            <div className="section-title">姓名</div>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="管理员"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">邮箱</div>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@demo.com"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">密码</div>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="默认建议至少 8 位，含大小写和数字"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
              实际规则由后端密码策略配置控制。
            </div>
          </label>
          <label>
            <div className="section-title">邀请码（可选）</div>
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="如果设置了 ADMIN_INVITE_CODE，请填写"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          {error ? <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div> : null}
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "提交中..." : "注册并登录"}
          </button>
        </form>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink-1)" }}>
          若已配置 ADMIN_INVITE_CODE，需要输入邀请码；否则仅当系统还没有管理员时允许注册。
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
