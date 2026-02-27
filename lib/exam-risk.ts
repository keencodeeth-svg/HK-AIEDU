import type { ExamAntiCheatLevel } from "./exams";

export type ExamRiskLevel = "low" | "medium" | "high";

export type ExamRiskResult = {
  riskScore: number;
  riskLevel: ExamRiskLevel;
  riskReasons: string[];
  recommendedAction: string;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toRiskLevel(score: number): ExamRiskLevel {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function evaluateExamRisk(input: {
  antiCheatLevel?: ExamAntiCheatLevel;
  blurCount?: number;
  visibilityHiddenCount?: number;
  startedAt?: string;
  submittedAt?: string;
  durationMinutes?: number;
  answerCount?: number;
  questionCount?: number;
  score?: number;
  total?: number;
}) {
  const antiCheatLevel = input.antiCheatLevel ?? "basic";
  const blurCount = Math.max(0, Number(input.blurCount ?? 0));
  const visibilityHiddenCount = Math.max(0, Number(input.visibilityHiddenCount ?? 0));
  const answerCount = Math.max(0, Number(input.answerCount ?? 0));
  const questionCount = Math.max(0, Number(input.questionCount ?? 0));
  const score = Number(input.score ?? 0);
  const total = Number(input.total ?? 0);

  let riskScore = 0;
  const reasons: string[] = [];

  if (blurCount >= 6) {
    riskScore += 35;
    reasons.push(`切屏次数较高（${blurCount} 次）`);
  } else if (blurCount >= 3) {
    riskScore += 18;
    reasons.push(`切屏次数偏高（${blurCount} 次）`);
  }

  if (visibilityHiddenCount >= 5) {
    riskScore += 30;
    reasons.push(`页面隐藏次数较高（${visibilityHiddenCount} 次）`);
  } else if (visibilityHiddenCount >= 2) {
    riskScore += 15;
    reasons.push(`页面隐藏次数偏高（${visibilityHiddenCount} 次）`);
  }

  const startedAtTs = input.startedAt ? new Date(input.startedAt).getTime() : NaN;
  const submittedAtTs = input.submittedAt ? new Date(input.submittedAt).getTime() : NaN;
  if (Number.isFinite(startedAtTs) && Number.isFinite(submittedAtTs) && submittedAtTs > startedAtTs) {
    const elapsedMinutes = (submittedAtTs - startedAtTs) / (60 * 1000);
    const durationMinutes = Number(input.durationMinutes ?? 0);
    if (durationMinutes > 0 && elapsedMinutes < Math.max(4, durationMinutes * 0.2)) {
      riskScore += 20;
      reasons.push(`作答时长偏短（${Math.round(elapsedMinutes)} 分钟）`);
    }
  }

  if (questionCount > 0) {
    const completionRatio = answerCount / questionCount;
    if (completionRatio < 0.4 && total > 0 && score / total >= 0.75) {
      riskScore += 15;
      reasons.push("低作答覆盖但得分偏高");
    }
  }

  if (antiCheatLevel === "off") {
    riskScore = Math.round(riskScore * 0.8);
  }

  const normalized = clamp(riskScore, 0, 100);
  const riskLevel = toRiskLevel(normalized);
  const recommendedAction =
    riskLevel === "high"
      ? "建议核验答题过程并安排补测。"
      : riskLevel === "medium"
        ? "建议抽检关键题并安排口头复核。"
        : "风险较低，可正常进入复盘。";

  return {
    riskScore: normalized,
    riskLevel,
    riskReasons: reasons.slice(0, 4),
    recommendedAction
  } satisfies ExamRiskResult;
}
