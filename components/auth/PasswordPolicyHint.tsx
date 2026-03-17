"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";

const FALLBACK_HINT = "默认建议至少 8 位，包含大写字母、小写字母和数字（以系统配置为准）。";

type PasswordPolicyResponse = {
  hint?: string;
  data?: {
    hint?: string;
  };
};

export default function PasswordPolicyHint() {
  const [hint, setHint] = useState(FALLBACK_HINT);

  useEffect(() => {
    let cancelled = false;

    async function loadPasswordPolicyHint() {
      try {
        const payload = await requestJson<PasswordPolicyResponse>(
          "/api/auth/password-policy",
          { cache: "no-store" }
        );
        const nextHint = payload.data?.hint ?? payload.hint;
        if (!nextHint || cancelled) {
          return;
        }
        setHint(nextHint);
      } catch {
        // Keep the fallback copy when the policy request is unavailable.
      }
    }

    void loadPasswordPolicyHint();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div className="form-note">{hint}</div>;
}
