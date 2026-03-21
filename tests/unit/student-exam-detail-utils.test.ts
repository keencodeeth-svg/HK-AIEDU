import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "@/lib/client-request") {
    return path.resolve(__dirname, "../../lib/client-request.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  buildStudentExamOfflineDraft,
  getStudentExamDetailDerivedState,
  getStudentExamStageCopy,
  getStudentExamDetailRequestMessage,
  getStudentExamReviewPackRequestMessage,
  getStudentExamSubmitMessage,
  getStudentExamSubmitSyncNotice,
  isMissingStudentExamDetailError,
  mergeStudentExamAutosaveDetail,
  mergeStudentExamSubmissionDetail,
  resolveStudentExamLoadState,
  STUDENT_EXAM_LOCAL_SYNC_NOTICE
} = require("../../app/student/exams/[id]/utils") as typeof import("../../app/student/exams/[id]/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student exam detail helpers map auth and stale exam errors", () => {
  assert.equal(
    getStudentExamDetailRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看考试。"
  );
  assert.equal(
    getStudentExamDetailRequestMessage(createRequestError(404, "not found"), "fallback"),
    "考试不存在，或你当前账号无权查看这场考试。"
  );
  assert.equal(
    getStudentExamDetailRequestMessage(createRequestError(400, "考试作答时间已结束"), "fallback"),
    "考试作答时间已结束，当前无法继续保存或提交。"
  );
  assert.equal(isMissingStudentExamDetailError(createRequestError(404, "not found")), true);
});

test("student exam detail helpers map review-pack and payload validation errors", () => {
  assert.equal(
    getStudentExamReviewPackRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看考试复盘。"
  );
  assert.equal(
    getStudentExamReviewPackRequestMessage(createRequestError(404, "not found"), "fallback"),
    "考试复盘暂不可用，请稍后重试。"
  );
  assert.equal(
    getStudentExamDetailRequestMessage(createRequestError(400, "answers.q1 must be a string"), "fallback"),
    "答题内容格式无效，请刷新页面后重试。"
  );
});

test("student exam detail helpers restore local draft answers and clear submitted local state", () => {
  const detail = {
    exam: {
      id: "exam-1",
      title: "月测",
      publishMode: "teacher_assigned",
      antiCheatLevel: "basic",
      endAt: "2026-03-18T10:00:00.000Z",
      durationMinutes: 45,
      status: "published"
    },
    class: {
      id: "class-1",
      name: "一班",
      subject: "math",
      grade: "4"
    },
    assignment: {
      status: "in_progress"
    },
    questions: [
      { id: "q1", stem: "1+1=?", options: ["1", "2"], score: 5, orderIndex: 1 }
    ],
    draftAnswers: { q1: "A" },
    submission: null,
    reviewPackSummary: null,
    access: {
      stage: "open",
      canEnter: true,
      canSubmit: true,
      lockReason: null,
      serverNow: "2026-03-18T09:20:00.000Z"
    }
  } satisfies import("../../app/student/exams/[id]/types").ExamDetail;

  const restored = resolveStudentExamLoadState(detail, {
    answers: { q1: "B" },
    updatedAt: "2026-03-18T09:15:00.000Z",
    clientStartedAt: "2026-03-18T09:10:00.000Z"
  });
  assert.deepEqual(restored.mergedAnswers, { q1: "B" });
  assert.equal(restored.pendingLocalSync, true);
  assert.equal(restored.dirty, true);
  assert.equal(restored.syncNotice, STUDENT_EXAM_LOCAL_SYNC_NOTICE);
  assert.equal(restored.nextClientStartedAt, "2026-03-18T09:10:00.000Z");
  assert.equal(restored.shouldClearLocalDraft, false);

  const submitted = resolveStudentExamLoadState(
    {
      ...detail,
      submission: {
        score: 5,
        total: 5,
        submittedAt: "2026-03-18T09:30:00.000Z",
        answers: { q1: "A" }
      }
    },
    {
      answers: { q1: "B" },
      updatedAt: "2026-03-18T09:15:00.000Z",
      clientStartedAt: "2026-03-18T09:10:00.000Z"
    }
  );
  assert.deepEqual(submitted.mergedAnswers, { q1: "A" });
  assert.equal(submitted.pendingLocalSync, false);
  assert.equal(submitted.shouldClearLocalDraft, true);
});

test("student exam detail helpers build offline draft and submit notices deterministically", () => {
  assert.deepEqual(
    buildStudentExamOfflineDraft({ q1: "A" }, null, "2026-03-18T09:00:00.000Z"),
    {
      answers: { q1: "A" },
      updatedAt: "2026-03-18T09:00:00.000Z",
      clientStartedAt: "2026-03-18T09:00:00.000Z"
    }
  );
  assert.equal(
    getStudentExamSubmitSyncNotice(2, {
      wrongCount: 2,
      estimatedMinutes: 12,
      topWeakKnowledgePoints: []
    }),
    "本次考试错题已加入今日复练清单（2 题）。 系统已生成考试复盘包，预计 12 分钟完成。"
  );
  assert.equal(getStudentExamSubmitSyncNotice(0, null), null);
  assert.equal(getStudentExamSubmitMessage("timeout"), "考试时间结束，系统已自动提交，并定位到下方结果区。");
  assert.equal(getStudentExamSubmitMessage("manual", true), "本场考试已提交，已恢复结果与复盘入口。");
  assert.equal(getStudentExamSubmitMessage("manual", false), "提交成功，已为你定位到下方结果与复盘区。");
});

test("student exam detail helpers merge autosave and submit snapshots deterministically", () => {
  const detail = {
    exam: {
      id: "exam-1",
      title: "月测",
      publishMode: "teacher_assigned",
      antiCheatLevel: "basic",
      endAt: "2026-03-18T10:00:00.000Z",
      durationMinutes: 45,
      status: "published"
    },
    class: {
      id: "class-1",
      name: "一班",
      subject: "math",
      grade: "4"
    },
    assignment: {
      status: "in_progress",
      startedAt: "2026-03-18T09:00:00.000Z",
      autoSavedAt: "2026-03-18T09:10:00.000Z"
    },
    questions: [
      { id: "q1", stem: "1+1=?", options: ["1", "2"], score: 5, orderIndex: 1 }
    ],
    draftAnswers: { q1: "A" },
    submission: null,
    reviewPackSummary: null,
    access: {
      stage: "open",
      canEnter: true,
      canSubmit: true,
      lockReason: null,
      serverNow: "2026-03-18T09:20:00.000Z"
    }
  } satisfies import("../../app/student/exams/[id]/types").ExamDetail;

  assert.deepEqual(
    mergeStudentExamAutosaveDetail(detail, {
      savedAt: "2026-03-18T09:25:00.000Z",
      status: "in_progress",
      startedAt: "2026-03-18T09:00:00.000Z"
    })?.assignment,
    {
      status: "in_progress",
      startedAt: "2026-03-18T09:00:00.000Z",
      autoSavedAt: "2026-03-18T09:25:00.000Z"
    }
  );

  assert.deepEqual(
    mergeStudentExamSubmissionDetail(
      detail,
      {
        score: 95,
        total: 100,
        submittedAt: "2026-03-18T09:40:00.000Z"
      },
      { q1: "B" }
    )?.submission,
    {
      score: 95,
      total: 100,
      submittedAt: "2026-03-18T09:40:00.000Z",
      answers: { q1: "B" }
    }
  );
});

test("student exam detail helpers derive stage copy from timing and completion state", () => {
  const baseDetail = {
    exam: {
      id: "exam-1",
      title: "月测",
      publishMode: "teacher_assigned",
      antiCheatLevel: "basic",
      endAt: "2026-03-18T10:00:00.000Z",
      durationMinutes: 45,
      status: "published"
    },
    class: {
      id: "class-1",
      name: "一班",
      subject: "math",
      grade: "4"
    },
    assignment: {
      status: "in_progress"
    },
    questions: [
      { id: "q1", stem: "1+1=?", options: ["1", "2"], score: 5, orderIndex: 1 },
      { id: "q2", stem: "2+2=?", options: ["3", "4"], score: 5, orderIndex: 2 }
    ],
    draftAnswers: {},
    submission: null,
    reviewPackSummary: null,
    access: {
      stage: "open",
      canEnter: true,
      canSubmit: true,
      lockReason: null,
      serverNow: "2026-03-18T09:20:00.000Z"
    }
  } satisfies import("../../app/student/exams/[id]/types").ExamDetail;

  assert.deepEqual(
    getStudentExamStageCopy({
      data: null,
      submitted: false,
      effectiveWrongCount: 0,
      remainingSeconds: null,
      unansweredCount: 0,
      startedAt: null,
      lockedByServer: false,
      lockReason: null
    }),
    {
      title: "考试详情加载中",
      description: "正在同步题目、作答进度和考试时钟。"
    }
  );

  assert.equal(
    getStudentExamStageCopy({
      data: baseDetail,
      submitted: false,
      effectiveWrongCount: 0,
      remainingSeconds: 180,
      unansweredCount: 1,
      startedAt: "2026-03-18T09:15:00.000Z",
      lockedByServer: false,
      lockReason: null
    }).title,
    "剩余 03:00，优先补未答题"
  );

  assert.equal(
    getStudentExamStageCopy({
      data: baseDetail,
      submitted: true,
      effectiveWrongCount: 2,
      remainingSeconds: null,
      unansweredCount: 0,
      startedAt: "2026-03-18T09:15:00.000Z",
      lockedByServer: false,
      lockReason: null
    }).title,
    "考试已提交，先看结果再复盘"
  );
});

test("student exam detail helpers derive page metrics and timing state deterministically", () => {
  const data = {
    exam: {
      id: "exam-1",
      title: "月测",
      publishMode: "teacher_assigned",
      antiCheatLevel: "basic",
      endAt: "2026-03-18T10:00:00.000Z",
      durationMinutes: 45,
      status: "published"
    },
    class: {
      id: "class-1",
      name: "一班",
      subject: "math",
      grade: "4"
    },
    assignment: {
      status: "in_progress",
      score: 60,
      total: 100
    },
    questions: [
      { id: "q1", stem: "1+1=?", options: ["1", "2"], score: 5, orderIndex: 1 },
      { id: "q2", stem: "2+2=?", options: ["3", "4"], score: 10, orderIndex: 2 }
    ],
    draftAnswers: {},
    submission: null,
    reviewPackSummary: {
      wrongCount: 1,
      estimatedMinutes: 12,
      topWeakKnowledgePoints: [
        { knowledgePointId: "kp-1", title: "分数", wrongCount: 1 }
      ]
    },
    access: {
      stage: "open",
      canEnter: true,
      canSubmit: true,
      lockReason: null,
      serverNow: "2026-03-18T09:20:00.000Z"
    }
  } satisfies import("../../app/student/exams/[id]/types").ExamDetail;

  const derived = getStudentExamDetailDerivedState({
    data,
    answers: { q1: "B", q2: " " },
    result: {
      score: 80,
      total: 100,
      submittedAt: "2026-03-18T09:40:00.000Z",
      wrongCount: 1,
      queuedReviewCount: 1,
      details: [],
      reviewPackSummary: {
        wrongCount: 1,
        estimatedMinutes: 10,
        topWeakKnowledgePoints: [
          { knowledgePointId: "kp-1", title: "分数", wrongCount: 1 }
        ]
      }
    },
    reviewPack: {
      wrongCount: 1,
      generatedAt: "2026-03-18T09:41:00.000Z",
      summary: {
        topWeakKnowledgePoints: [
          { knowledgePointId: "kp-1", title: "分数", wrongCount: 1 }
        ],
        wrongByDifficulty: [],
        wrongByType: [],
        estimatedMinutes: 10
      },
      rootCauses: [],
      actionItems: [],
      sevenDayPlan: []
    },
    reviewPackError: null,
    clientStartedAt: "2026-03-18T09:30:00.000Z",
    clock: new Date("2026-03-18T09:45:10.000Z").getTime()
  });

  assert.equal(derived.submitted, false);
  assert.equal(derived.startedAt, "2026-03-18T09:30:00.000Z");
  assert.equal(
    derived.deadlineMs,
    new Date("2026-03-18T10:00:00.000Z").getTime()
  );
  assert.equal(derived.remainingSeconds, 890);
  assert.equal(derived.answerCount, 1);
  assert.deepEqual(derived.answeredQuestionIds, ["q1"]);
  assert.deepEqual(derived.unansweredQuestionIds, ["q2"]);
  assert.equal(derived.unansweredCount, 1);
  assert.equal(derived.firstUnansweredQuestionId, "q2");
  assert.equal(derived.totalScore, 15);
  assert.equal(derived.finalScore, 80);
  assert.equal(derived.finalTotal, 100);
  assert.equal(derived.lockedByTime, false);
  assert.equal(derived.lockedByServer, false);
  assert.equal(derived.lockReason, null);
  assert.equal(derived.stageLabel, "考试进行中");
  assert.equal(derived.reviewPackSummary?.estimatedMinutes, 10);
  assert.equal(derived.feedbackTargetId, "exam-review-pack");
  assert.equal(derived.hasReviewPackSection, true);
  assert.equal(derived.stageCopy.title, "还差 1 题未答");
});
