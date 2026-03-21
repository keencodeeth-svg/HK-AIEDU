import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  ExamDetail,
  LocalDraft,
  ReviewPack,
  ReviewPackSummary,
  StudentExamStageCopy,
  SubmitResult,
  StudentExamSubmitTrigger
} from "./types";

export const LOCAL_DRAFT_PREFIX = "exam-local-draft:";
export const STUDENT_EXAM_LOCAL_SYNC_NOTICE = "检测到断网暂存作答，已恢复到当前页面。恢复网络后会自动同步。";

type StudentExamLoadState = {
  mergedAnswers: Record<string, string>;
  dirty: boolean;
  pendingLocalSync: boolean;
  syncNotice: string | null;
  nextClientStartedAt?: string;
  shouldClearLocalDraft: boolean;
  shouldLoadReviewPack: boolean;
};

type StudentExamStageCopyInput = {
  data: ExamDetail | null;
  submitted: boolean;
  effectiveWrongCount: number;
  remainingSeconds: number | null;
  unansweredCount: number;
  startedAt: string | null;
  lockedByServer: boolean;
  lockReason: string | null;
};

type StudentExamDetailDerivedStateInput = {
  data: ExamDetail | null;
  answers: Record<string, string>;
  result: SubmitResult | null;
  reviewPack: ReviewPack | null;
  reviewPackError: string | null;
  clientStartedAt: string | null;
  clock: number;
};

export function formatRemain(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function getStudentExamDetailDerivedState({
  data,
  answers,
  result,
  reviewPack,
  reviewPackError,
  clientStartedAt,
  clock
}: StudentExamDetailDerivedStateInput) {
  const submitted =
    (data?.assignment.status ?? "pending") === "submitted" || Boolean(data?.submission);
  const startedAt = data?.assignment.startedAt ?? clientStartedAt ?? null;

  let deadlineMs: number | null = null;
  if (data && !submitted) {
    const endDeadline = new Date(data.exam.endAt).getTime();
    if (data.exam.durationMinutes && startedAt) {
      const durationDeadline =
        new Date(startedAt).getTime() + data.exam.durationMinutes * 60 * 1000;
      deadlineMs = Math.min(endDeadline, durationDeadline);
    } else {
      deadlineMs = endDeadline;
    }
  }

  const remainingSeconds =
    deadlineMs === null || submitted ? null : Math.max(0, Math.ceil((deadlineMs - clock) / 1000));
  const lockedByTime = !submitted && remainingSeconds !== null && remainingSeconds <= 0;
  const lockedByStatus = !submitted && data?.exam.status === "closed";
  const lockedByAccess = !submitted && !data?.access?.canSubmit;
  const lockedByServer = lockedByStatus || lockedByAccess;
  const lockReason = data?.access?.lockReason ?? (lockedByStatus ? "考试已关闭" : null);
  const totalScore = data?.questions.reduce((sum, item) => sum + (item.score ?? 1), 0) ?? 0;
  const finalScore = result?.score ?? data?.submission?.score ?? data?.assignment.score ?? 0;
  const finalTotal = result?.total ?? data?.submission?.total ?? data?.assignment.total ?? totalScore;
  const answeredQuestionIds =
    data?.questions
      .filter((item) => Boolean(answers[item.id]?.trim()))
      .map((item) => item.id) ?? [];
  const answerCount = answeredQuestionIds.length;
  const unansweredQuestionIds =
    data?.questions
      .filter((item) => !answers[item.id]?.trim())
      .map((item) => item.id) ?? [];
  const unansweredCount = unansweredQuestionIds.length;
  const firstUnansweredQuestionId = unansweredQuestionIds[0] ?? null;
  const effectiveWrongCount = result?.wrongCount ?? data?.reviewPackSummary?.wrongCount ?? 0;
  const stageLabel = submitted
    ? "已提交"
    : data?.access.stage === "upcoming"
      ? "待开始"
      : data?.access.stage === "open"
        ? "考试进行中"
        : "不可作答";
  const reviewPackSummary: ReviewPackSummary | null =
    result?.reviewPackSummary ?? data?.reviewPackSummary ?? null;
  const feedbackTargetId = reviewPack || reviewPackSummary ? "exam-review-pack" : result ? "exam-result" : null;
  const hasReviewPackSection =
    submitted || Boolean(reviewPack) || Boolean(reviewPackSummary) || Boolean(reviewPackError);

  return {
    submitted,
    startedAt,
    deadlineMs,
    remainingSeconds,
    lockedByTime,
    lockedByServer,
    lockReason,
    totalScore,
    finalScore,
    finalTotal,
    answeredQuestionIds,
    answerCount,
    unansweredQuestionIds,
    unansweredCount,
    firstUnansweredQuestionId,
    effectiveWrongCount,
    stageLabel,
    reviewPackSummary,
    feedbackTargetId,
    hasReviewPackSection,
    stageCopy: getStudentExamStageCopy({
      data,
      submitted,
      effectiveWrongCount,
      remainingSeconds,
      unansweredCount,
      startedAt,
      lockedByServer,
      lockReason
    })
  };
}

export function getStudentExamDetailRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看考试。";
  }
  if (status === 404 && lower === "not found") {
    return "考试不存在，或你当前账号无权查看这场考试。";
  }
  if (lower === "考试作答时间已结束") {
    return "考试作答时间已结束，当前无法继续保存或提交。";
  }
  if (lower === "考试已提交") {
    return "本场考试已提交，无需重复保存草稿。";
  }
  if (lower === "考试题目为空") {
    return "当前考试题目为空，请联系老师检查考试配置。";
  }
  if (lower === "at least one delta must be positive") {
    return "考试状态同步参数无效，请刷新页面后重试。";
  }
  if (lower === "answers must be an object" || /^answers\.[^.]+ must be a string$/.test(lower)) {
    return "答题内容格式无效，请刷新页面后重试。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getStudentExamReviewPackRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看考试复盘。";
  }
  if (status === 404 && lower === "not found") {
    return "考试复盘暂不可用，请稍后重试。";
  }

  return getStudentExamDetailRequestMessage(error, fallback);
}

export function isMissingStudentExamDetailError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}

export function resolveStudentExamLoadState(detail: ExamDetail, localDraft: LocalDraft | null): StudentExamLoadState {
  const initialAnswers = detail.submission?.answers ?? detail.draftAnswers ?? {};
  const localDraftAnswers = localDraft?.answers ?? null;

  if (!detail.submission && localDraftAnswers) {
    return {
      mergedAnswers: { ...initialAnswers, ...localDraftAnswers },
      dirty: Object.keys(localDraftAnswers).length > 0,
      pendingLocalSync: Object.keys(localDraftAnswers).length > 0,
      syncNotice: Object.keys(localDraftAnswers).length > 0 ? STUDENT_EXAM_LOCAL_SYNC_NOTICE : null,
      nextClientStartedAt: detail.assignment?.startedAt ?? localDraft?.clientStartedAt,
      shouldClearLocalDraft: false,
      shouldLoadReviewPack: Boolean(detail.submission || detail.reviewPackSummary)
    };
  }

  return {
    mergedAnswers: initialAnswers,
    dirty: false,
    pendingLocalSync: false,
    syncNotice: null,
    nextClientStartedAt: detail.assignment?.startedAt,
    shouldClearLocalDraft: true,
    shouldLoadReviewPack: Boolean(detail.submission || detail.reviewPackSummary)
  };
}

export function buildStudentExamOfflineDraft(
  answers: Record<string, string>,
  clientStartedAt: string | null,
  nowIso = new Date().toISOString()
): LocalDraft {
  return {
    answers,
    updatedAt: nowIso,
    clientStartedAt: clientStartedAt ?? nowIso
  };
}

export function mergeStudentExamAutosaveDetail(
  previous: ExamDetail | null,
  payload: {
    savedAt?: string | null;
    status?: ExamDetail["assignment"]["status"];
    startedAt?: string | null;
  }
) {
  if (!previous) {
    return previous;
  }

  return {
    ...previous,
    assignment: {
      ...previous.assignment,
      status: payload.status ?? previous.assignment.status,
      startedAt: payload.startedAt ?? previous.assignment.startedAt,
      autoSavedAt: payload.savedAt ?? previous.assignment.autoSavedAt
    }
  };
}

export function mergeStudentExamSubmissionDetail(
  previous: ExamDetail | null,
  payload: {
    score: number;
    total: number;
    submittedAt: string;
  },
  answers: Record<string, string>
) {
  if (!previous) {
    return previous;
  }

  return {
    ...previous,
    assignment: {
      ...previous.assignment,
      status: "submitted" as const,
      submittedAt: payload.submittedAt,
      score: payload.score,
      total: payload.total,
      autoSavedAt: payload.submittedAt ?? previous.assignment.autoSavedAt
    },
    submission: {
      score: payload.score,
      total: payload.total,
      submittedAt: payload.submittedAt,
      answers
    }
  };
}

export function getStudentExamSubmitSyncNotice(
  queuedReviewCount?: number | null,
  reviewPackSummary?: ReviewPackSummary | null
) {
  const reviewNotice =
    typeof queuedReviewCount === "number" && queuedReviewCount > 0
      ? `本次考试错题已加入今日复练清单（${queuedReviewCount} 题）。`
      : "";
  const reviewPackNotice = reviewPackSummary?.estimatedMinutes
    ? `系统已生成考试复盘包，预计 ${reviewPackSummary.estimatedMinutes} 分钟完成。`
    : "";
  const syncText = [reviewNotice, reviewPackNotice].filter(Boolean).join(" ");
  return syncText || null;
}

export function getStudentExamSubmitMessage(
  trigger: StudentExamSubmitTrigger,
  alreadySubmitted = false
) {
  if (trigger === "timeout") {
    return "考试时间结束，系统已自动提交，并定位到下方结果区。";
  }
  if (alreadySubmitted) {
    return "本场考试已提交，已恢复结果与复盘入口。";
  }
  return "提交成功，已为你定位到下方结果与复盘区。";
}

export function getStudentExamStageCopy({
  data,
  submitted,
  effectiveWrongCount,
  remainingSeconds,
  unansweredCount,
  startedAt,
  lockedByServer,
  lockReason
}: StudentExamStageCopyInput): StudentExamStageCopy {
  if (!data) {
    return {
      title: "考试详情加载中",
      description: "正在同步题目、作答进度和考试时钟。"
    };
  }

  if (submitted) {
    return effectiveWrongCount > 0
      ? {
          title: "考试已提交，先看结果再复盘",
          description: "这场考试已经结束，建议先查看下方答题结果，再打开复盘包安排错题修复。"
        }
      : {
          title: "考试已提交，本次表现稳定",
          description: "成绩已经生成，下方保留了结果和复盘入口，可以直接查看本次考试表现。"
        };
  }

  if (data.access.stage === "upcoming") {
    return {
      title: "考试尚未开始",
      description: lockReason ?? "当前还不能作答，开放后即可进入考试。"
    };
  }

  if (lockedByServer) {
    return {
      title: lockReason ?? "当前不可作答",
      description: "本场考试已被系统锁定，当前可以查看题目与已保存记录，但不能继续提交。"
    };
  }

  if (remainingSeconds !== null && remainingSeconds <= 300 && unansweredCount > 0) {
    return {
      title: `剩余 ${formatRemain(remainingSeconds)}，优先补未答题`,
      description: "时间已经不多了，先完成未作答题目，再决定是否检查已答内容。"
    };
  }

  if (!startedAt && data.exam.durationMinutes) {
    return {
      title: "开始作答后正式计时",
      description: "一旦选择答案就会进入正式考试时长，建议先快速浏览题量再开始作答。"
    };
  }

  if (unansweredCount === data.questions.length) {
    return {
      title: "先从第 1 题开始",
      description: "建议先完成会做的题，再回头处理不确定的题目，减少考试焦虑。"
    };
  }

  if (unansweredCount > 0) {
    return {
      title: `还差 ${unansweredCount} 题未答`,
      description: "先用下方题号导航补齐未答题目，避免交卷时出现不必要失分。"
    };
  }

  return {
    title: "全部已作答，可以提交",
    description: "如果没有需要修改的答案，现在提交就能立即看到结果和考试复盘建议。"
  };
}
