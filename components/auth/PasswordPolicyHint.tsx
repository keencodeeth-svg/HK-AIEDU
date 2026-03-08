"use client";

import { useEffect, useState } from "react";

const FALLBACK_HINT = "默认建议至少 8 位，包含大写字母、小写字母和数字（以系统配置为准）。";

type PasswordPolicyResponse = {
  hint?: string;
};

export default function PasswordPolicyHint() {
  const [hint, setHint] = useState(FALLBACK_HINT);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/password-policy", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as PasswordPolicyResponse | null;
        if (!response.ok || !payload?.hint || !active) {
          return;
        }
        setHint(payload.hint);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return <div className="form-note">{hint}</div>;
}
