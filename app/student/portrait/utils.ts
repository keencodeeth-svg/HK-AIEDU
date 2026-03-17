import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  AbilityStat,
  PortraitStageCopy,
  RecentStudyVariantActivity,
  WeakKnowledgePoint
} from "./types";

export const PORTRAIT_RADAR_SIZE = 260;
export const PORTRAIT_RADAR_RADIUS = 90;
export const PORTRAIT_RADAR_GRID_LEVELS = [0.25, 0.5, 0.75, 1] as const;

export function buildPolygonPoints(stats: AbilityStat[], radius: number, center: number) {
  const count = stats.length;
  if (!count) return "";
  return stats
    .map((item, index) => {
      const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
      const currentRadius = (item.score / 100) * radius;
      const x = center + currentRadius * Math.cos(angle);
      const y = center + currentRadius * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function buildGridPoints(count: number, radius: number, center: number) {
  const points: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(" ");
}

export function getMasteryTone(level: WeakKnowledgePoint["masteryLevel"]) {
  if (level === "strong") return "done";
  if (level === "developing") return "pending";
  return "overdue";
}

export function getMasteryLabel(level: WeakKnowledgePoint["masteryLevel"]) {
  if (level === "strong") return "已稳固";
  if (level === "developing") return "待巩固";
  return "薄弱";
}

export function getRecentStudyVariantSummary(activity: RecentStudyVariantActivity | null | undefined) {
  if (!activity) return null;
  return activity.latestCorrect
    ? `最近一轮 Tutor 变式巩固命中了「${activity.latestKnowledgePointTitle}」，当前掌握 ${activity.masteryScore} 分。`
    : `最近一轮 Tutor 变式巩固暴露出「${activity.latestKnowledgePointTitle}」还不稳，当前掌握 ${activity.masteryScore} 分。`;
}

export function getStudentPortraitRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看学习画像。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function buildPracticeHref(input?: { subject?: string; knowledgePointId?: string }) {
  const searchParams = new URLSearchParams();
  if (input?.subject?.trim()) {
    searchParams.set("subject", input.subject.trim());
  }
  if (input?.knowledgePointId?.trim()) {
    searchParams.set("knowledgePointId", input.knowledgePointId.trim());
  }
  const query = searchParams.toString();
  return query ? `/practice?${query}` : "/practice";
}

export function getPortraitStageCopy({
  loading,
  abilityCount,
  trackedKnowledgePoints,
  weakKnowledgePointCount,
  lowestAbilityLabel
}: {
  loading: boolean;
  abilityCount: number;
  trackedKnowledgePoints: number;
  weakKnowledgePointCount: number;
  lowestAbilityLabel?: string | null;
}): PortraitStageCopy {
  if (loading) {
    return {
      title: "正在生成你的学习画像",
      description: "系统正在汇总能力表现、掌握度和近期趋势，请稍等。"
    };
  }

  if (!abilityCount && !trackedKnowledgePoints) {
    return {
      title: "当前还没有足够的学习画像数据",
      description: "先完成练习、诊断或错题复习，系统会逐步生成更完整的能力和掌握度画像。"
    };
  }

  if (weakKnowledgePointCount > 0) {
    return {
      title: `当前有 ${weakKnowledgePointCount} 个优先补强知识点`,
      description: "建议结合下方薄弱知识点与学科掌握概览，安排下一轮练习和错题复盘。"
    };
  }

  return {
    title: "你的画像已经形成基础轮廓",
    description: lowestAbilityLabel
      ? `当前最需要关注的能力是「${lowestAbilityLabel}」，可以结合练习和错题复习继续提升。`
      : "继续保持练习，系统会随着新数据更新你的能力雷达和掌握趋势。"
  };
}
