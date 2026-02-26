import { getCurrentUser } from "@/lib/auth";
import { getClassesByStudent } from "@/lib/classes";
import { getAssignmentProgressByStudent, getAssignmentsByClassIds } from "@/lib/assignments";
import { getChallengeState } from "@/lib/challenges";
import { SUBJECT_LABELS } from "@/lib/constants";
import { getKnowledgePoints } from "@/lib/content";
import { ensureExamAssignment, getExamAssignment, getExamPapersByClassIds } from "@/lib/exams";
import { generateStudyPlans, getStudyPlans } from "@/lib/progress";
import { getStudentProfile } from "@/lib/profiles";
import { getIntervalLabel, getWrongReviewQueue } from "@/lib/wrong-review";
import { unauthorized, withApi } from "@/lib/api/http";

export const dynamic = "force-dynamic";

type TodayTaskSource = "assignment" | "exam" | "wrong_review" | "plan" | "challenge";
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
  dueAt: string | null;
  group: TodayTaskGroup;
  tags: string[];
};

const PRIORITY_MAP: Record<TodayTaskSource, Record<TodayTaskStatus, number>> = {
  assignment: {
    overdue: 94,
    due_today: 88,
    in_progress: 86,
    pending: 78,
    upcoming: 70,
    optional: 55
  },
  exam: {
    overdue: 98,
    due_today: 92,
    in_progress: 96,
    pending: 84,
    upcoming: 68,
    optional: 52
  },
  wrong_review: {
    overdue: 99,
    due_today: 95,
    in_progress: 90,
    pending: 74,
    upcoming: 62,
    optional: 50
  },
  plan: {
    overdue: 86,
    due_today: 80,
    in_progress: 78,
    pending: 72,
    upcoming: 66,
    optional: 52
  },
  challenge: {
    overdue: 60,
    due_today: 64,
    in_progress: 66,
    pending: 72,
    upcoming: 68,
    optional: 56
  }
};

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

function resolveTaskGroup(source: TodayTaskSource, status: TodayTaskStatus): TodayTaskGroup {
  if (source === "challenge") return "growth";
  if (status === "overdue" || status === "due_today" || status === "in_progress") {
    return "must_do";
  }
  return "continue_learning";
}

function buildTask(input: Omit<TodayTask, "group" | "priority">) {
  const priority = PRIORITY_MAP[input.source][input.status];
  const group = resolveTaskGroup(input.source, input.status);
  return {
    ...input,
    group,
    priority
  } satisfies TodayTask;
}

function compareTasks(a: TodayTask, b: TodayTask) {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const aTs = toTimestamp(a.dueAt);
  const bTs = toTimestamp(b.dueAt);
  if (aTs === null && bTs === null) return a.title.localeCompare(b.title, "zh-CN");
  if (aTs === null) return 1;
  if (bTs === null) return -1;
  if (aTs !== bTs) return aTs - bTs;
  return a.title.localeCompare(b.title, "zh-CN");
}

export const GET = withApi(async () => {
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

  const [assignments, assignmentProgress, papers, wrongQueue, challengeState, profile] = await Promise.all([
    getAssignmentsByClassIds(classIds),
    getAssignmentProgressByStudent(user.id),
    getExamPapersByClassIds(classIds),
    getWrongReviewQueue(user.id),
    getChallengeState(user.id),
    getStudentProfile(user.id)
  ]);

  const assignmentProgressMap = new Map(assignmentProgress.map((item) => [item.assignmentId, item]));
  const tasks: TodayTask[] = [];

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
        tags: ["作业", SUBJECT_LABELS[subject] ?? subject]
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
          tags: ["考试", SUBJECT_LABELS[subject] ?? subject]
        })
      );
    });

  wrongQueue.dueToday.forEach((item) => {
    const dueTs = toTimestamp(item.nextReviewAt);
    const status: TodayTaskStatus = dueTs !== null && dueTs < nowTs ? "overdue" : "due_today";
    const kpTitle = kpMap.get(item.knowledgePointId)?.title ?? item.knowledgePointId;
    tasks.push(
      buildTask({
        id: `wrong-review-${item.id}`,
        source: "wrong_review",
        sourceId: item.id,
        title: `错题复练：${kpTitle}`,
        description: `复练节奏 ${getIntervalLabel(item.intervalLevel)} · 应复练 ${formatDateTime(item.nextReviewAt)}`,
        href: "/wrong-book",
        status,
        dueAt: item.nextReviewAt,
        tags: ["错题复练", SUBJECT_LABELS[item.subject] ?? item.subject]
      })
    );
  });

  wrongQueue.upcoming.slice(0, 3).forEach((item) => {
    const kpTitle = kpMap.get(item.knowledgePointId)?.title ?? item.knowledgePointId;
    tasks.push(
      buildTask({
        id: `wrong-review-upcoming-${item.id}`,
        source: "wrong_review",
        sourceId: item.id,
        title: `预备复练：${kpTitle}`,
        description: `下轮节奏 ${getIntervalLabel(item.intervalLevel)} · 预计 ${formatDateTime(item.nextReviewAt)}`,
        href: "/wrong-book",
        status: "upcoming",
        dueAt: item.nextReviewAt,
        tags: ["错题复练", "排队中"]
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
        tags: ["学习计划", SUBJECT_LABELS[item.subject] ?? item.subject]
      })
    );
  });

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
        tags: ["挑战", "可领奖励"]
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
        tags: ["挑战", "成长"]
      })
    );
  });

  const sortedTasks = tasks.sort(compareTasks);
  const groups = {
    mustDo: sortedTasks.filter((item) => item.group === "must_do"),
    continueLearning: sortedTasks.filter((item) => item.group === "continue_learning"),
    growth: sortedTasks.filter((item) => item.group === "growth")
  };

  const bySource = {
    assignment: 0,
    exam: 0,
    wrongReview: 0,
    plan: 0,
    challenge: 0
  };

  sortedTasks.forEach((item) => {
    if (item.source === "assignment") bySource.assignment += 1;
    if (item.source === "exam") bySource.exam += 1;
    if (item.source === "wrong_review") bySource.wrongReview += 1;
    if (item.source === "plan") bySource.plan += 1;
    if (item.source === "challenge") bySource.challenge += 1;
  });

  return {
    data: {
      generatedAt: new Date().toISOString(),
      summary: {
        total: sortedTasks.length,
        mustDo: groups.mustDo.length,
        continueLearning: groups.continueLearning.length,
        growth: groups.growth.length,
        overdue: sortedTasks.filter((item) => item.status === "overdue").length,
        dueToday: sortedTasks.filter((item) => item.status === "due_today").length,
        inProgress: sortedTasks.filter((item) => item.status === "in_progress").length,
        bySource
      },
      groups,
      tasks: sortedTasks
    }
  };
});
