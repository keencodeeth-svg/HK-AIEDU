import { isStudyVariantAttemptReason, summarizeRecentStudyVariantAttempts } from "@/lib/ai-study-progress";
import { getCurrentUser } from "@/lib/auth";
import { combineDateAndTime, getDateKey, getWeekdayFromDate, listClassScheduleSessions } from "@/lib/class-schedules";
import { getClassesByStudent } from "@/lib/classes";
import { getAssignmentProgressByStudent, getAssignmentsByClassIds } from "@/lib/assignments";
import { getChallengeState } from "@/lib/challenges";
import { SUBJECT_LABELS } from "@/lib/constants";
import { getKnowledgePoints } from "@/lib/content";
import { ensureExamAssignment, getExamAssignment, getExamPapersByClassIds } from "@/lib/exams";
import { generateStudyPlans, getStudyPlans, getAttemptsByUser } from "@/lib/progress";
import { getStudentProfile } from "@/lib/profiles";
import { getUnifiedReviewQueue } from "@/lib/review-scheduler";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

type TodayTaskSource = "assignment" | "exam" | "wrong_review" | "plan" | "challenge" | "lesson";
type TodayTaskStatus = "overdue" | "due_today" | "in_progress" | "pending" | "upcoming" | "optional";
type TodayTaskGroup = "must_do" | "continue_learning" | "growth";

type TodayTask = {
  id: string;
  source: TodayTaskSource;
  sourceId: string;
  title: string;
  description: string;
  href: string;
  status: TodayTaskStatus;
  priority: number;
  impactScore: number;
  urgencyScore: number;
  effortMinutes: number;
  expectedGain: number;
  recommendedReason: string;
  dueAt: string | null;
  group: TodayTaskGroup;
  tags: string[];
};

const SOURCE_IMPACT: Record<TodayTaskSource, number> = {
  assignment: 78,
  exam: 90,
  wrong_review: 94,
  plan: 82,
  challenge: 62,
  lesson: 76
};

const SOURCE_EFFORT_MINUTES: Record<TodayTaskSource, number> = {
  assignment: 25,
  exam: 35,
  wrong_review: 12,
  plan: 18,
  challenge: 10,
  lesson: 8
};

const STATUS_URGENCY_BASE: Record<TodayTaskStatus, number> = {
  overdue: 98,
  due_today: 90,
  in_progress: 86,
  pending: 72,
  upcoming: 58,
  optional: 48
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toTimestamp(value?: string | null) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function getTodayEndTimestamp() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.getTime();
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}

function resolveDueStatus(value: string | null, nowTs: number, todayEndTs: number): TodayTaskStatus {
  const ts = toTimestamp(value);
  if (ts === null) return "pending";
  if (ts < nowTs) return "overdue";
  if (ts <= todayEndTs) return "due_today";
  return "pending";
}

function resolveLessonTaskStatus(startAt: string, endAt: string, nowTs: number, todayEndTs: number): TodayTaskStatus {
  const startTs = toTimestamp(startAt);
  const endTs = toTimestamp(endAt);
  if (startTs !== null && endTs !== null && startTs <= nowTs && nowTs < endTs) return "in_progress";
  if (startTs !== null && startTs <= todayEndTs) return "due_today";
  return "upcoming";
}

function resolveTaskGroup(source: TodayTaskSource, status: TodayTaskStatus): TodayTaskGroup {
  if (source === "challenge") return "growth";
  if (status === "overdue" || status === "due_today" || status === "in_progress") {
    return "must_do";
  }
  return "continue_learning";
}

function resolveUrgencyScore(input: {
  source: TodayTaskSource;
  status: TodayTaskStatus;
  dueAt: string | null;
  nowTs: number;
}) {
  const base = STATUS_URGENCY_BASE[input.status];
  const dueTs = toTimestamp(input.dueAt);
  if (dueTs === null) {
    return base;
  }

  const deltaHours = Math.round((dueTs - input.nowTs) / (60 * 60 * 1000));
  let bonus = 0;
  if (deltaHours < 0) {
    bonus = 6;
  } else if (deltaHours <= 2) {
    bonus = 10;
  } else if (deltaHours <= 8) {
    bonus = 7;
  } else if (deltaHours <= 24) {
    bonus = 4;
  }

  if (input.source === "exam" && input.status === "in_progress") {
    bonus += 4;
  }

  return clamp(base + bonus, 40, 100);
}

function resolveEffortMinutes(input: {
  source: TodayTaskSource;
  targetCountHint?: number;
  isInProgress?: boolean;
}) {
  const base = SOURCE_EFFORT_MINUTES[input.source];
  const countBonus = input.targetCountHint ? Math.min(20, input.targetCountHint * 2) : 0;
  const progressDiscount = input.isInProgress ? 4 : 0;
  return clamp(base + countBonus - progressDiscount, 6, 60);
}

function buildTask(
  input: Omit<TodayTask, "group" | "priority" | "impactScore" | "urgencyScore" | "effortMinutes" | "expectedGain"> & {
    nowTs: number;
    targetCountHint?: number;
    isInProgress?: boolean;
    priorityBoost?: number;
    impactBoost?: number;
  }
) {
  const group = resolveTaskGroup(input.source, input.status);
  const impactScore = clamp(SOURCE_IMPACT[input.source] + (input.impactBoost ?? 0), 0, 100);
  const urgencyScore = resolveUrgencyScore({
    source: input.source,
    status: input.status,
    dueAt: input.dueAt,
    nowTs: input.nowTs
  });
  const priorityBoost = input.priorityBoost ?? 0;
  const effortMinutes = resolveEffortMinutes({
    source: input.source,
    targetCountHint: input.targetCountHint,
    isInProgress: input.isInProgress
  });
  const expectedGain = clamp(
    Math.round(impactScore * 0.62 + urgencyScore * 0.28 + (100 - effortMinutes) * 0.1 + priorityBoost * 0.5),
    0,
    100
  );
  const priority = clamp(
    Math.round(impactScore * 0.52 + urgencyScore * 0.38 + (100 - effortMinutes) * 0.1 + priorityBoost),
    0,
    100
  );

  return {
    ...input,
    group,
    priority,
    impactScore,
    urgencyScore,
    effortMinutes,
    expectedGain
  } satisfies TodayTask;
}

function compareTasks(a: TodayTask, b: TodayTask) {
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.expectedGain !== b.expectedGain) return b.expectedGain - a.expectedGain;
  const aTs = toTimestamp(a.dueAt);
  const bTs = toTimestamp(b.dueAt);
  if (aTs === null && bTs === null) return a.title.localeCompare(b.title, "zh-CN");
  if (aTs === null) return 1;
  if (bTs === null) return -1;
  if (aTs !== bTs) return aTs - bTs;
  return a.title.localeCompare(b.title, "zh-CN");
}

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    unauthorized();
  }

  const nowTs = Date.now();
  const todayEndTs = getTodayEndTimestamp();

  const classes = await getClassesByStudent(user.id);
  const classIds = classes.map((item) => item.id);
  const classMap = new Map(classes.map((item) => [item.id, item]));
  const knowledgePoints = await getKnowledgePoints();
  const kpMap = new Map(knowledgePoints.map((item) => [item.id, item]));

  const [scheduleSessions, assignments, assignmentProgress, papers, reviewQueue, challengeState, profile] = await Promise.all([
    listClassScheduleSessions({ classIds }),
    getAssignmentsByClassIds(classIds),
    getAssignmentProgressByStudent(user.id),
    getExamPapersByClassIds(classIds),
    getUnifiedReviewQueue({ userId: user.id }),
    getChallengeState(user.id),
    getStudentProfile(user.id)
  ]);
  const attempts = await getAttemptsByUser(user.id);
  const recentStudyVariantActivity = summarizeRecentStudyVariantAttempts({ attempts });
  const recentStudyVariantByKnowledgePoint = new Map<string, { count: number; latestAttemptAt: string }>();
  attempts.forEach((attempt) => {
    if (!recentStudyVariantActivity) return;
    const latestTs = new Date(recentStudyVariantActivity.latestAttemptAt).getTime();
    const attemptTs = new Date(attempt.createdAt).getTime();
    if (!Number.isFinite(attemptTs) || attemptTs < latestTs - 24 * 60 * 60 * 1000) return;
    if (!isStudyVariantAttemptReason(attempt.reason)) return;
    const current = recentStudyVariantByKnowledgePoint.get(attempt.knowledgePointId) ?? {
      count: 0,
      latestAttemptAt: attempt.createdAt
    };
    recentStudyVariantByKnowledgePoint.set(attempt.knowledgePointId, {
      count: current.count + 1,
      latestAttemptAt: current.latestAttemptAt > attempt.createdAt ? current.latestAttemptAt : attempt.createdAt
    });
  });

  const assignmentProgressMap = new Map(assignmentProgress.map((item) => [item.assignmentId, item]));
  const pendingAssignmentMetaByClass = new Map<string, { count: number; nextTitle?: string; nextDueAt?: string }>();
  [...assignments]
    .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())
    .forEach((assignment) => {
      if (assignmentProgressMap.get(assignment.id)?.status === "completed") return;
      const current = pendingAssignmentMetaByClass.get(assignment.classId) ?? { count: 0 };
      pendingAssignmentMetaByClass.set(assignment.classId, {
        count: current.count + 1,
        nextTitle: current.nextTitle ?? assignment.title,
        nextDueAt: current.nextDueAt ?? assignment.dueDate
      });
    });

  const todayDate = new Date();
  const todayWeekday = getWeekdayFromDate(todayDate);
  const todayDateKey = getDateKey(todayDate);
  const tasks: TodayTask[] = [];

  scheduleSessions
    .filter((session) => session.weekday === todayWeekday)
    .map((session) => {
      const startAt = combineDateAndTime(todayDateKey, session.startTime).toISOString();
      const endAt = combineDateAndTime(todayDateKey, session.endTime).toISOString();
      return { session, startAt, endAt };
    })
    .filter((item) => (toTimestamp(item.endAt) ?? 0) >= nowTs)
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())
    .forEach(({ session, startAt, endAt }) => {
      const klass = classMap.get(session.classId);
      const subject = klass?.subject ?? "math";
      const status = resolveLessonTaskStatus(startAt, endAt, nowTs, todayEndTs);
      const pendingMeta = pendingAssignmentMetaByClass.get(session.classId);
      const tags = ["课程表", SUBJECT_LABELS[subject] ?? subject];
      if (session.slotLabel) {
        tags.push(session.slotLabel);
      }

      const descriptionParts = [
        `${klass?.name ?? "班级"} · ${session.startTime}-${session.endTime}`,
        session.room ? `教室 ${session.room}` : null,
        session.focusSummary ? `课堂焦点 ${session.focusSummary}` : null,
        pendingMeta?.nextTitle ? `关联作业 ${pendingMeta.nextTitle}` : null
      ].filter(Boolean);

      tasks.push(
        buildTask({
          id: `lesson-${session.id}-${todayDateKey}`,
          source: "lesson",
          sourceId: session.id,
          title: `课程提醒：${klass?.name ?? "班级课程"}`,
          description: descriptionParts.join(" · "),
          href: "/calendar",
          status,
          dueAt: startAt,
          tags,
          recommendedReason:
            status === "in_progress"
              ? "当前已进入上课时段，建议先聚焦课堂任务"
              : pendingMeta?.count
                ? "上课前先确认课堂焦点和关联作业，减少临时切换"
                : "固定课程会影响今天时间分配，建议提前预习和准备物品",
          nowTs,
          targetCountHint: pendingMeta?.count ? 1 : undefined,
          isInProgress: status === "in_progress"
        })
      );
    });

  assignments.forEach((assignment) => {
    const progress = assignmentProgressMap.get(assignment.id);
    if (progress?.status === "completed") return;

    const klass = classMap.get(assignment.classId);
    const subject = klass?.subject ?? "math";
    const status = resolveDueStatus(assignment.dueDate, nowTs, todayEndTs);
    tasks.push(
      buildTask({
        id: `assignment-${assignment.id}`,
        source: "assignment",
        sourceId: assignment.id,
        title: `作业：${assignment.title}`,
        description: `${klass?.name ?? "班级"} · 截止 ${formatDateTime(assignment.dueDate)}`,
        href: `/student/assignments/${assignment.id}`,
        status,
        dueAt: assignment.dueDate,
        tags: ["作业", SUBJECT_LABELS[subject] ?? subject],
        recommendedReason: status === "overdue" ? "已逾期，优先补交避免连续风险" : "老师任务优先，影响课堂节奏",
        nowTs,
        isInProgress: progress?.status === "in_progress"
      })
    );
  });

  const examPairs = await Promise.all(
    papers.map(async (paper) => {
      const assignment =
        paper.publishMode === "targeted"
          ? await getExamAssignment(paper.id, user.id)
          : await ensureExamAssignment(paper.id, user.id);
      if (!assignment || assignment.status === "submitted") return null;
      return { paper, assignment };
    })
  );

  examPairs
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .forEach(({ paper, assignment }) => {
      const klass = classMap.get(paper.classId);
      const subject = klass?.subject ?? "math";
      const startTs = toTimestamp(paper.startAt ?? null);
      let status: TodayTaskStatus;

      if (paper.status === "closed") {
        status = "overdue";
      } else if (assignment.status === "in_progress") {
        status = "in_progress";
      } else if (startTs !== null && startTs > nowTs) {
        status = "upcoming";
      } else {
        status = resolveDueStatus(paper.endAt, nowTs, todayEndTs);
      }

      const startText = paper.startAt ? `开始 ${formatDateTime(paper.startAt)} · ` : "";
      const deadlineText =
        paper.status === "closed" ? "考试已截止，需尽快查看结果与复盘。" : `截止 ${formatDateTime(paper.endAt)}`;
      tasks.push(
        buildTask({
          id: `exam-${paper.id}`,
          source: "exam",
          sourceId: paper.id,
          title: `${assignment.status === "in_progress" ? "继续考试" : "在线考试"}：${paper.title}`,
          description: `${klass?.name ?? "班级"} · ${startText}${deadlineText}`,
          href: `/student/exams/${paper.id}`,
          status,
          dueAt: paper.endAt,
          tags: ["考试", SUBJECT_LABELS[subject] ?? subject],
          recommendedReason: assignment.status === "in_progress" ? "考试进行中，先完成可快速收口" : "考试结果直接影响阶段评估",
          nowTs,
          isInProgress: assignment.status === "in_progress"
        })
      );
    });

  reviewQueue.dueToday.forEach((item) => {
    const dueTs = toTimestamp(item.nextReviewAt);
    const status: TodayTaskStatus = dueTs !== null && dueTs < nowTs ? "overdue" : "due_today";
    const kpTitle = kpMap.get(item.knowledgePointId)?.title ?? item.knowledgePointId;
    const isMemoryReview = item.sourceType === "memory";
    tasks.push(
      buildTask({
        id: `${item.sourceType}-review-${item.id}`,
        source: "wrong_review",
        sourceId: item.id,
        title: `${isMemoryReview ? "记忆复习" : "错题复练"}：${kpTitle}`,
        description: `${isMemoryReview ? "记忆节奏" : "复练节奏"} ${item.intervalLabel} · 应复练 ${formatDateTime(item.nextReviewAt)}`,
        href: isMemoryReview ? "/practice?mode=review" : "/wrong-book",
        status,
        dueAt: item.nextReviewAt,
        tags: [isMemoryReview ? "记忆复习" : "错题复练", SUBJECT_LABELS[item.subject] ?? item.subject],
        recommendedReason: isMemoryReview ? "按记忆曲线回顾，避免已学内容快速遗忘" : "错题 24 小时内复练收益最高，优先提分",
        nowTs,
        targetCountHint: 1
      })
    );
  });

  reviewQueue.upcoming.slice(0, 3).forEach((item) => {
    const kpTitle = kpMap.get(item.knowledgePointId)?.title ?? item.knowledgePointId;
    const isMemoryReview = item.sourceType === "memory";
    tasks.push(
      buildTask({
        id: `${item.sourceType}-review-upcoming-${item.id}`,
        source: "wrong_review",
        sourceId: item.id,
        title: `${isMemoryReview ? "预备记忆复习" : "预备复练"}：${kpTitle}`,
        description: `${isMemoryReview ? "记忆节奏" : "下轮节奏"} ${item.intervalLabel} · 预计 ${formatDateTime(item.nextReviewAt)}`,
        href: isMemoryReview ? "/practice?mode=review" : "/wrong-book",
        status: "upcoming",
        dueAt: item.nextReviewAt,
        tags: [isMemoryReview ? "记忆复习" : "错题复练", "排队中"],
        recommendedReason: isMemoryReview ? "提前安排记忆复习，减少遗忘回撤" : "提前排队，避免后续集中积压",
        nowTs,
        targetCountHint: 1
      })
    );
  });

  const subjects = profile?.subjects?.length ? profile.subjects : ["math"];
  let studyPlans = await getStudyPlans(user.id, subjects);
  if (!studyPlans.length) {
    studyPlans = await generateStudyPlans(user.id, subjects);
  }

  const rankedPlanItems = studyPlans
    .flatMap((plan) =>
      plan.items.map((item) => ({
        ...item,
        subject: plan.subject
      }))
    )
    .sort((a, b) => {
      const aTs = toTimestamp(a.dueDate) ?? Number.MAX_SAFE_INTEGER;
      const bTs = toTimestamp(b.dueDate) ?? Number.MAX_SAFE_INTEGER;
      return aTs - bTs;
    })
    .slice(0, 8);

  rankedPlanItems.forEach((item) => {
    const status = resolveDueStatus(item.dueDate, nowTs, todayEndTs);
    const kpTitle = kpMap.get(item.knowledgePointId)?.title ?? item.knowledgePointId;
    const recentTutorDrill = recentStudyVariantByKnowledgePoint.get(item.knowledgePointId) ?? null;
    const query = new URLSearchParams({
      subject: item.subject,
      knowledgePointId: item.knowledgePointId
    });
    tasks.push(
      buildTask({
        id: `plan-${item.subject}-${item.knowledgePointId}`,
        source: "plan",
        sourceId: `${item.subject}-${item.knowledgePointId}`,
        title: `${SUBJECT_LABELS[item.subject] ?? item.subject}薄弱点练习`,
        description: `${kpTitle} · 目标 ${item.targetCount} 题 · 截止 ${formatDateTime(item.dueDate)}`,
        href: `/practice?${query.toString()}`,
        status,
        dueAt: item.dueDate,
        tags: ["学习计划", SUBJECT_LABELS[item.subject] ?? item.subject, ...(recentTutorDrill ? ["Tutor 刚练过"] : [])],
        recommendedReason: recentTutorDrill
          ? `你刚在 Tutor 做过「${kpTitle}」变式巩固，趁热再完成计划题，最容易把掌握度坐实。`
          : "围绕薄弱知识点做定向修复",
        nowTs,
        targetCountHint: item.targetCount,
        priorityBoost: recentTutorDrill ? 8 : 0,
        impactBoost: recentTutorDrill ? 4 : 0
      })
    );
  });

  const hasTutorMomentumTask = tasks.some(
    (task) => task.tags.includes("Tutor 刚练过") || task.tags.includes("Tutor 动量") || task.recommendedReason.includes("Tutor")
  );
  if (recentStudyVariantActivity && !hasTutorMomentumTask) {
    const latestKnowledgePointId = recentStudyVariantActivity.latestKnowledgePointId;
    const latestKnowledgePointTitle = kpMap.get(latestKnowledgePointId)?.title ?? latestKnowledgePointId;
    const latestSubjectLabel =
      SUBJECT_LABELS[recentStudyVariantActivity.latestSubject] ?? recentStudyVariantActivity.latestSubject;
    const momentumQuery = new URLSearchParams({
      subject: recentStudyVariantActivity.latestSubject,
      knowledgePointId: latestKnowledgePointId
    });
    const masteredInTutor = recentStudyVariantActivity.latestCorrect;
    tasks.push(
      buildTask({
        id: `tutor-momentum-${recentStudyVariantActivity.latestSubject}-${latestKnowledgePointId}`,
        source: "plan",
        sourceId: `tutor-momentum-${latestKnowledgePointId}`,
        title: `${latestSubjectLabel} Tutor 趁热巩固`,
        description: `${latestKnowledgePointTitle} · 从 Tutor 变式切到正式练习，建议立刻完成 ${
          masteredInTutor ? 3 : 4
        } 题。`,
        href: `/practice?${momentumQuery.toString()}`,
        status: "pending",
        dueAt: null,
        tags: ["Tutor 动量", latestSubjectLabel, masteredInTutor ? "刚做对" : "刚暴露薄弱点"],
        recommendedReason: masteredInTutor
          ? `你刚在 Tutor 做对了「${latestKnowledgePointTitle}」，现在切到正式练习，最适合把会做变成稳定会做。`
          : `你刚在 Tutor 暴露了「${latestKnowledgePointTitle}」的薄弱点，立刻补 4 题正式练习，修复效率最高。`,
        nowTs,
        targetCountHint: masteredInTutor ? 3 : 4,
        priorityBoost: masteredInTutor ? 10 : 14,
        impactBoost: masteredInTutor ? 6 : 8
      })
    );
  }

  const claimableChallenges = challengeState.tasks.filter((task) => task.completed && !task.claimed).slice(0, 2);
  const pendingChallenges = challengeState.tasks.filter((task) => !task.completed && !task.claimed).slice(0, 1);

  claimableChallenges.forEach((task) => {
    tasks.push(
      buildTask({
        id: `challenge-claim-${task.id}`,
        source: "challenge",
        sourceId: task.id,
        title: `领取挑战奖励：${task.title}`,
        description: `任务已完成，可领取 ${task.points} 积分。`,
        href: "/challenge",
        status: "pending",
        dueAt: null,
        tags: ["挑战", "可领奖励"],
        recommendedReason: "及时领取奖励，强化正反馈",
        nowTs,
        targetCountHint: 1
      })
    );
  });

  pendingChallenges.forEach((task) => {
    tasks.push(
      buildTask({
        id: `challenge-progress-${task.id}`,
        source: "challenge",
        sourceId: task.id,
        title: `挑战任务：${task.title}`,
        description: task.learningProof?.missingActions?.[0] ?? task.description,
        href: "/challenge",
        status: "optional",
        dueAt: null,
        tags: ["挑战", "成长"],
        recommendedReason: "挑战可提升学习粘性，建议穿插完成",
        nowTs,
        targetCountHint: 1
      })
    );
  });

  const sortedTasks = tasks.sort(compareTasks);
  const groups = {
    mustDo: sortedTasks.filter((item) => item.group === "must_do"),
    continueLearning: sortedTasks.filter((item) => item.group === "continue_learning"),
    growth: sortedTasks.filter((item) => item.group === "growth")
  };

  const topTasks = [...groups.mustDo, ...groups.continueLearning, ...groups.growth]
    .slice(0, 3)
    .sort(compareTasks);

  const bySource = {
    assignment: 0,
    exam: 0,
    wrongReview: 0,
    plan: 0,
    challenge: 0,
    lesson: 0
  };

  sortedTasks.forEach((item) => {
    if (item.source === "assignment") bySource.assignment += 1;
    if (item.source === "exam") bySource.exam += 1;
    if (item.source === "wrong_review") bySource.wrongReview += 1;
    if (item.source === "plan") bySource.plan += 1;
    if (item.source === "challenge") bySource.challenge += 1;
    if (item.source === "lesson") bySource.lesson += 1;
  });

  return {
    data: {
      generatedAt: new Date().toISOString(),
      recentStudyVariantActivity: recentStudyVariantActivity
        ? {
            recentAttemptCount: recentStudyVariantActivity.recentAttemptCount,
            recentCorrectCount: recentStudyVariantActivity.recentCorrectCount,
            latestAttemptAt: recentStudyVariantActivity.latestAttemptAt,
            latestKnowledgePointId: recentStudyVariantActivity.latestKnowledgePointId,
            latestKnowledgePointTitle:
              kpMap.get(recentStudyVariantActivity.latestKnowledgePointId)?.title ?? recentStudyVariantActivity.latestKnowledgePointId,
            latestSubject: recentStudyVariantActivity.latestSubject,
            latestCorrect: recentStudyVariantActivity.latestCorrect
          }
        : null,
      summary: {
        total: sortedTasks.length,
        mustDo: groups.mustDo.length,
        continueLearning: groups.continueLearning.length,
        growth: groups.growth.length,
        overdue: sortedTasks.filter((item) => item.status === "overdue").length,
        dueToday: sortedTasks.filter((item) => item.status === "due_today").length,
        inProgress: sortedTasks.filter((item) => item.status === "in_progress").length,
        top3EstimatedMinutes: topTasks.reduce((sum, item) => sum + item.effortMinutes, 0),
        bySource
      },
      groups,
      topTasks,
      tasks: sortedTasks
    }
  };
  }
});
