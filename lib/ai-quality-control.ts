import { getAiTaskPolicy, type AiTaskType } from "./ai-task-policies";
import { applyAiQualityCalibration } from "./ai-quality-calibration";

export type AiQualityRiskLevel = "low" | "medium" | "high";

export type AiQualityResult = {
  confidenceScore: number;
  riskLevel: AiQualityRiskLevel;
  needsHumanReview: boolean;
  fallbackAction: string;
  reasons: string[];
  calibration?: {
    globalBias: number;
    providerAdjustment: number;
    kindAdjustment: number;
  };
  taskType?: AiTaskType;
  minQualityScore?: number;
  policyViolated?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function assessAiQuality(input: {
  kind: "assist" | "coach" | "explanation" | "writing" | "assignment_review";
  provider?: string | null;
  textBlocks: string[];
  listCountHint?: number;
  taskType?: AiTaskType;
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

  const baseScore = clamp(score, 0, 100);
  const calibrated = applyAiQualityCalibration({
    score: baseScore,
    provider: input.provider,
    kind: input.kind,
    scopeKey: `${input.kind}|${provider}|${merged.slice(0, 120)}`
  });
  const confidenceScore = calibrated.score;
  if (calibrated.applied) {
    reasons.push("质量分已应用离线校准参数。");
  }
  const rawRiskLevel: AiQualityRiskLevel =
    confidenceScore < 55 ? "high" : confidenceScore < 75 ? "medium" : "low";
  const resolvedTaskType =
    input.taskType ??
    (input.kind === "explanation"
      ? "explanation"
      : input.kind === "writing"
        ? "writing_feedback"
        : input.kind === "assignment_review"
          ? "homework_review"
          : "assist");
  const minQualityScore = getAiTaskPolicy(resolvedTaskType).minQualityScore;
  const policyViolated = confidenceScore < minQualityScore;
  const riskLevel: AiQualityRiskLevel =
    policyViolated && rawRiskLevel === "low" ? "medium" : rawRiskLevel;

  if (policyViolated) {
    reasons.push(`质量分低于任务策略阈值（${minQualityScore}）。`);
  }

  const needsHumanReview = riskLevel !== "low";
  const fallbackAction = policyViolated
    ? `质量分低于策略阈值（${minQualityScore}），建议人工复核或切换模型后重试。`
    : riskLevel === "high"
      ? "建议教师人工复核并补充讲解。"
      : riskLevel === "medium"
        ? "建议抽检关键结论后再下发。"
        : "可直接使用。";

  return {
    confidenceScore,
    riskLevel,
    needsHumanReview,
    fallbackAction,
    reasons,
    calibration: calibrated.adjustments,
    taskType: resolvedTaskType,
    minQualityScore,
    policyViolated
  } satisfies AiQualityResult;
}
