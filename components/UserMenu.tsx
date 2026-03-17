"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pushAppToast } from "@/components/AppToastHub";
import {
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";

type UserMenuProps = {
  user?: { name: string; role: string } | null;
};

export default function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await requestJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      if (isAuthError(error)) {
        router.push("/login");
        router.refresh();
        return;
      }
      pushAppToast(getRequestErrorMessage(error, "退出失败，请稍后重试"), "error");
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <a className="button secondary" href="/login">
        登录
      </a>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 13, color: "var(--ink-1)" }}>{user.name}</div>
      <button className="button secondary" onClick={handleLogout} disabled={loading}>
        {loading ? "退出中" : "退出"}
      </button>
    </div>
  );
}
