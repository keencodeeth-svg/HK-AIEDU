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
  buildTeacherExamReviewPackMessage,
  getTeacherExamDetailDerivedState,
  getTeacherExamDetailDueRelativeLabel,
  getTeacherExamDetailRequestMessage,
  isMissingTeacherExamDetailError,
  updateTeacherExamDetailStatus
} = require("../../app/teacher/exams/[id]/utils") as typeof import("../../app/teacher/exams/[id]/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher exam detail helpers map auth and business errors", () => {
  assert.equal(
    getTeacherExamDetailRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "教师登录状态已失效，请重新登录后继续查看考试详情。"
  );
  assert.equal(
    getTeacherExamDetailRequestMessage(createRequestError(400, "考试已关闭"), "fallback"),
    "考试已经处于关闭状态，无需重复操作。"
  );
  assert.equal(
    getTeacherExamDetailRequestMessage(createRequestError(400, "考试题目为空"), "fallback"),
    "当前考试没有题目，暂时无法发布复盘任务。"
  );
});

test("teacher exam detail helpers detect stale exam resources", () => {
  const missingError = createRequestError(404, "not found");

  assert.equal(
    getTeacherExamDetailRequestMessage(missingError, "fallback"),
    "考试不存在，或当前教师账号无权查看该考试。"
  );
  assert.equal(isMissingTeacherExamDetailError(missingError), true);
  assert.equal(isMissingTeacherExamDetailError(createRequestError(400, "考试已开放")), false);
});

test("teacher exam detail helpers derive ranking, score, and due state deterministically", () => {
  const data = {
    exam: {
      id: "exam-1",
      title: "分数单元测",
      publishMode: "teacher_assigned",
      antiCheatLevel: "basic",
      status: "published",
      endAt: "2026-03-20T05:00:00.000Z",
      createdAt: "2026-03-19T01:00:00.000Z"
    },
    class: {
      id: "class-1",
      name: "四年级一班",
      subject: "math",
      grade: "4"
    },
    summary: {
      assigned: 5,
      submitted: 3,
      pending: 2,
      avgScore: 84,
      totalBlurCount: 1,
      totalVisibilityHiddenCount: 2,
      highRiskCount: 1,
      mediumRiskCount: 1
    },
    questions: [
      { id: "q-1", stem: "题目一", score: 30, orderIndex: 1 },
      { id: "q-2", stem: "题目二", score: 20, orderIndex: 2 }
    ],
    students: [
      {
        id: "student-1",
        name: "李明",
        email: "li@example.com",
        status: "pending",
        score: null,
        total: null,
        submittedAt: null,
        blurCount: 0,
        visibilityHiddenCount: 0,
        lastExamEventAt: null,
        riskScore: 92,
        riskLevel: "high",
        riskReasons: ["多次切屏"],
        recommendedAction: "优先约谈"
      },
      {
        id: "student-2",
        name: "王芳",
        email: "wang@example.com",
        status: "submitted",
        score: 82,
        total: 100,
        submittedAt: "2026-03-20T01:30:00.000Z",
        blurCount: 1,
        visibilityHiddenCount: 1,
        lastExamEventAt: "2026-03-20T01:20:00.000Z",
        riskScore: 92,
        riskLevel: "medium",
        riskReasons: ["一次切屏"],
        recommendedAction: "继续观察"
      },
      {
        id: "student-3",
        name: "陈雪",
        email: "chen@example.com",
        status: "submitted",
        score: 96,
        total: 100,
        submittedAt: "2026-03-20T01:10:00.000Z",
        blurCount: 0,
        visibilityHiddenCount: 0,
        lastExamEventAt: "2026-03-20T01:05:00.000Z",
        riskScore: 55,
        riskLevel: "low",
        riskReasons: [],
        recommendedAction: "正常跟进"
      }
    ]
  } satisfies import("../../app/teacher/exams/[id]/types").ExamDetail;

  assert.equal(getTeacherExamDetailDueRelativeLabel("2026-03-20T05:00:00.000Z", Date.parse("2026-03-20T03:10:00.000Z")), "2 小时后结束");
  assert.deepEqual(
    getTeacherExamDetailDerivedState({
      data,
      lastLoadedAt: null,
      now: Date.parse("2026-03-20T03:10:00.000Z")
    }),
    {
      rankedStudents: [data.students[1], data.students[0], data.students[2]],
      submittedRate: 60,
      topRiskStudent: data.students[1],
      totalQuestionScore: 50,
      dueRelativeLabel: "2 小时后结束",
      lastLoadedAtLabel: ""
    }
  );
});

test("teacher exam detail helpers build publish copy and patch status safely", () => {
  assert.equal(
    buildTeacherExamReviewPackMessage(
      {
        publishedStudents: 4,
        targetedStudents: 5,
        skippedLowRisk: 1,
        skippedNoSubmission: 2
      },
      true
    ),
    "预览完成：计划通知学生 4 人 覆盖 5 人，跳过低风险 1 人，缺少提交 2 人。"
  );
  assert.equal(
    buildTeacherExamReviewPackMessage(
      {
        message: "发布完成：高风险学生已全部触达",
        targetedStudents: 6,
        skippedLowRisk: 2,
        skippedNoSubmission: 1
      },
      false
    ),
    "发布完成：高风险学生已全部触达 覆盖 6 人，跳过低风险 2 人，缺少提交 1 人。"
  );
  assert.deepEqual(
    updateTeacherExamDetailStatus(
      {
        exam: {
          id: "exam-1",
          title: "测试",
          publishMode: "teacher_assigned",
          antiCheatLevel: "basic",
          status: "published",
          endAt: "2026-03-20T05:00:00.000Z",
          createdAt: "2026-03-19T01:00:00.000Z"
        },
        class: {
          id: "class-1",
          name: "四年级一班",
          subject: "math",
          grade: "4"
        },
        summary: {
          assigned: 1,
          submitted: 0,
          pending: 1,
          avgScore: 0,
          totalBlurCount: 0,
          totalVisibilityHiddenCount: 0,
          highRiskCount: 0,
          mediumRiskCount: 0
        },
        questions: [],
        students: []
      },
      "closed"
    )?.exam.status,
    "closed"
  );
  assert.equal(updateTeacherExamDetailStatus(null, "closed"), null);
});
