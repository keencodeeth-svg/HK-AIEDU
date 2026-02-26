export type AiQualityRiskLevel = "low" | "medium" | "high";

export type AiQualityResult = {
  confidenceScore: number;
  riskLevel: AiQualityRiskLevel;
  needsHumanReview: boolean;
  fallbackAction: string;
  reasons: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function assessAiQuality(input: {
  kind: "assist" | "coach" | "explanation" | "writing" | "assignment_review";
  provider?: string | null;
  textBlocks: string[];
  listCountHint?: number;
}) {
  let score = 88;
  const reasons: string[] = [];
  const provider = (input.provider ?? "").toLowerCase();
  const merged = input.textBlocks.join(" ").trim();
  const charCount = merged.length;

  if (!charCount) {
    score -= 60;
    reasons.push("AI 输出为空。");
  } else if (charCount < 40) {
    score -= 25;
    reasons.push("AI 输出过短，解释充分性不足。");
  } else if (charCount < 80) {
    score -= 12;
    reasons.push("AI 输出偏短，建议人工抽检。");
  }

  if (provider === "mock" || provider === "rule" || !provider) {
    score -= 30;
    reasons.push("当前为规则/兜底输出。");
  }

  if (typeof input.listCountHint === "number" && input.listCountHint <= 0) {
    score -= 18;
    reasons.push("结构化要点数量不足。");
  }

  const weakSignals = ["可能", "大概", "不确定", "仅供参考"];
  if (weakSignals.some((signal) => merged.includes(signal))) {
    score -= 10;
    reasons.push("表达存在不确定性词汇。");
  }

  if (input.kind === "writing" && charCount < 120) {
    score -= 8;
    reasons.push("写作反馈偏简略。");
  }
  if (input.kind === "assignment_review" && charCount < 100) {
    score -= 8;
    reasons.push("作业批改意见偏简略。");
  }

  const confidenceScore = clamp(score, 0, 100);
  const riskLevel: AiQualityRiskLevel =
    confidenceScore < 55 ? "high" : confidenceScore < 75 ? "medium" : "low";
  const needsHumanReview = riskLevel !== "low";
  const fallbackAction =
    riskLevel === "high"
      ? "建议教师人工复核并补充讲解。"
      : riskLevel === "medium"
        ? "建议抽检关键结论后再下发。"
        : "可直接使用。";

  return {
    confidenceScore,
    riskLevel,
    needsHumanReview,
    fallbackAction,
    reasons
  } satisfies AiQualityResult;
}
