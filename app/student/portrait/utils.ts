import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import { buildTutorLaunchHref } from "@/lib/tutor-launch";
import type {
  AbilityStat,
  MasterySummary,
  PortraitActionPlan,
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

export function getStudentPortraitActionPlan(options: {
  mastery: Pick<MasterySummary, "averageMasteryScore" | "averageTrend7d"> | null;
  recentStudyVariantActivity: RecentStudyVariantActivity | null;
  weakFocus: WeakKnowledgePoint | null;
}): PortraitActionPlan {
  const { mastery, recentStudyVariantActivity, weakFocus } = options;

  if (recentStudyVariantActivity) {
    return {
      kicker: "基于最新 Tutor 结果",
      title: `先把「${recentStudyVariantActivity.latestKnowledgePointTitle}」迁到正式练习`,
      description: recentStudyVariantActivity.latestCorrect
        ? "这类题你刚在 Tutor 做对过，最适合立刻切到正式练习，把“会做”巩固成“稳定会做”。"
        : "这个知识点刚在 Tutor 暴露出薄弱处，趁记忆还热的时候立刻做正式练习，修复效率最高。",
      primaryLabel: "去做正式练习",
      primaryHref: buildPracticeHref({
        subject: recentStudyVariantActivity.latestSubject,
        knowledgePointId: recentStudyVariantActivity.latestKnowledgePointId
      }),
      secondaryLabel: "回到 Tutor",
      secondaryHref: buildTutorLaunchHref({
        intent: "image",
        source: "student-portrait-recent-tutor",
        subject: recentStudyVariantActivity.latestSubject
      }),
      meta: `最近 24 小时 Tutor 巩固 ${recentStudyVariantActivity.recentAttemptCount} 题 · 当前掌握 ${recentStudyVariantActivity.masteryScore} 分`
    };
  }

  if (weakFocus) {
    return {
      kicker: "基于薄弱知识点",
      title: `先补「${weakFocus.title}」`,
      description: `这是当前最值得优先收口的知识点${typeof weakFocus.weaknessRank === "number" ? `，当前优先级 #${weakFocus.weaknessRank}` : ""}。先做定向练习，再回来观察画像变化。`,
      primaryLabel: "去定向练习",
      primaryHref: buildPracticeHref({
        subject: weakFocus.subject,
        knowledgePointId: weakFocus.knowledgePointId
      }),
      secondaryLabel: "去 Tutor 追问",
      secondaryHref: buildTutorLaunchHref({
        intent: "image",
        source: "student-portrait-weak-focus",
        subject: weakFocus.subject
      }),
      meta: `掌握 ${weakFocus.masteryScore} 分 · 正确 ${weakFocus.correct} / ${weakFocus.total}`
    };
  }

  return {
    kicker: "基于当前画像",
    title: "先做一轮练习，再回来观察画像有没有变化",
    description: "当没有明显单点风险时，最好的动作就是保持练习节奏，然后回到画像页看掌握分、能力雷达和趋势是否继续抬升。",
    primaryLabel: "去做练习",
    primaryHref: "/practice",
    secondaryLabel: "去 Tutor",
    secondaryHref: buildTutorLaunchHref({
      intent: "image",
      source: "student-portrait-general"
    }),
    meta: `平均掌握 ${mastery?.averageMasteryScore ?? 0} 分 · 7 日趋势 ${mastery?.averageTrend7d ?? 0}`
  };
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

export function getStudentPortraitPageDerivedState(options: {
  abilities: AbilityStat[];
  mastery: MasterySummary | null;
  loading: boolean;
}) {
  const portraitAbilities = options.abilities;
  const radarSize = PORTRAIT_RADAR_SIZE;
  const radarCenter = radarSize / 2;
  const radarRadius = PORTRAIT_RADAR_RADIUS;
  const radarGridLevels = [...PORTRAIT_RADAR_GRID_LEVELS];
  const polygonPoints = buildPolygonPoints(portraitAbilities, radarRadius, radarCenter);
  const lowestAbility = portraitAbilities.length
    ? [...portraitAbilities].sort((left, right) => left.score - right.score)[0] ?? null
    : null;
  const weakFocus = options.mastery?.weakKnowledgePoints?.[0] ?? null;
  const weakKnowledgePointCount = options.mastery?.weakKnowledgePoints?.length ?? 0;
  const trackedKnowledgePoints = options.mastery?.trackedKnowledgePoints ?? 0;
  const stageCopy = getPortraitStageCopy({
    loading: options.loading,
    abilityCount: portraitAbilities.length,
    trackedKnowledgePoints,
    weakKnowledgePointCount,
    lowestAbilityLabel: lowestAbility?.label
  });
  const recentStudyVariantActivity = options.mastery?.recentStudyVariantActivity ?? null;
  const recentStudyVariantSummary = getRecentStudyVariantSummary(recentStudyVariantActivity);
  const portraitActionPlan = getStudentPortraitActionPlan({
    mastery: options.mastery,
    recentStudyVariantActivity,
    weakFocus
  });
  const recentStudyPracticeHref = recentStudyVariantActivity
    ? buildPracticeHref({
        subject: recentStudyVariantActivity.latestSubject,
        knowledgePointId: recentStudyVariantActivity.latestKnowledgePointId
      })
    : "";
  const recentStudyTutorHref = recentStudyVariantActivity
    ? buildTutorLaunchHref({
        intent: "image",
        source: "student-portrait-recent-card",
        subject: recentStudyVariantActivity.latestSubject
      })
    : "";
  const overviewPrimaryHref = buildPracticeHref({
    subject: weakFocus?.subject,
    knowledgePointId: weakFocus?.knowledgePointId
  });
  const overviewSecondaryHref = weakFocus
    ? buildTutorLaunchHref({
        intent: "image",
        source: "student-portrait-overview",
        subject: weakFocus.subject
      })
    : "/wrong-book";

  return {
    portraitAbilities,
    radarSize,
    radarCenter,
    radarRadius,
    radarGridLevels,
    polygonPoints,
    lowestAbility,
    weakFocus,
    trackedKnowledgePoints,
    weakKnowledgePointCount,
    stageCopy,
    recentStudyVariantActivity,
    recentStudyVariantSummary,
    portraitActionPlan,
    recentStudyPracticeHref,
    recentStudyTutorHref,
    overviewPrimaryHref,
    overviewSecondaryHref,
    overviewSecondaryLabel: weakFocus ? "去 Tutor 追问" : "去错题本",
    hasPortraitData: portraitAbilities.length > 0 || options.mastery !== null
  };
}
