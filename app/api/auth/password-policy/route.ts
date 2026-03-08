import { createAuthRoute } from "@/lib/api/domains";
import { getPasswordPolicyConfig } from "@/lib/password";

function buildPasswordPolicyHint(policy: ReturnType<typeof getPasswordPolicyConfig>) {
  const rules = [`至少 ${policy.minLength} 位`];
  if (policy.requireUppercase) {
    rules.push("包含大写字母");
  }
  if (policy.requireLowercase) {
    rules.push("包含小写字母");
  }
  if (policy.requireDigit) {
    rules.push("包含数字");
  }
  return `当前密码规则：${rules.join("、")}。`;
}

export const GET = createAuthRoute({
  cache: "public-short",
  handler: async () => {
    const policy = getPasswordPolicyConfig();
    return {
      policy,
      hint: buildPasswordPolicyHint(policy),
      checklist: [
        `至少 ${policy.minLength} 位`,
        ...(policy.requireUppercase ? ["至少 1 个大写字母"] : []),
        ...(policy.requireLowercase ? ["至少 1 个小写字母"] : []),
        ...(policy.requireDigit ? ["至少 1 个数字"] : [])
      ]
    };
  }
});
