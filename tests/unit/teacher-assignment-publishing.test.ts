import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, test } from "node:test";

type TeacherAssignmentPublishingModule = typeof import("../../lib/teacher-assignment-publishing");

const ENV_KEYS = ["NODE_ENV"] as const;
const ORIGINAL_ENV = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function resetModules() {
  const targets = [
    "../../lib/teacher-assignment-publishing",
    "../../lib/auth",
    "../../lib/ai",
    "../../lib/assignments",
    "../../lib/classes",
    "../../lib/content",
    "../../lib/notifications",
    "../../lib/modules",
    "../../lib/api/http"
  ];

  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function setMockModule(modulePath: string, exportsValue: Record<string, unknown>) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
    children: [],
    path: path.dirname(resolved),
    paths: []
  } as unknown as NodeModule;
}

function createQuestionRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "q-1",
    subject: "math",
    grade: "7",
    knowledgePointId: "kp-1",
    stem: "1 + 1 = ?",
    options: ["1", "2", "3", "4"],
    answer: "2",
    explanation: "基础加法",
    difficulty: "medium",
    questionType: "choice",
    tags: [],
    abilities: [],
    ...overrides
  };
}

function loadTeacherAssignmentPublishingModule(options?: {
  hasLlmProvider?: boolean;
  questions?: Array<Record<string, unknown>>;
  knowledgePoints?: Array<Record<string, unknown>>;
}) {
  restoreEnv();
  process.env.NODE_ENV = "test";
  resetModules();

  const aiCalls: Array<Record<string, unknown>> = [];
  const createQuestionCalls: Array<Record<string, unknown>> = [];
  const createAssignmentCalls: Array<Record<string, unknown>> = [];
  const notificationCalls: Array<Record<string, unknown>> = [];

  setMockModule("../../lib/auth", {
    getParentsByStudentId: async () => []
  });

  setMockModule("../../lib/ai", {
    hasConfiguredLlmProvider: (provider: string) => {
      assert.equal(provider, "chat");
      return options?.hasLlmProvider === true;
    },
    generateQuestionDraft: async (input: Record<string, unknown>) => {
      aiCalls.push({ ...input });
      return {
        stem: "AI 生成题目",
        options: ["A", "B", "C", "D"],
        answer: "A",
        explanation: "AI 解析"
      };
    }
  });

  setMockModule("../../lib/assignments", {
    createAssignment: async (input: Record<string, unknown>) => {
      createAssignmentCalls.push({ ...input });
      return {
        id: "assignment-1",
        classId: input.classId,
        moduleId: input.moduleId ?? null,
        title: input.title,
        description: input.description ?? "",
        dueDate: input.dueDate,
        questionIds: input.questionIds ?? [],
        submissionType: input.submissionType,
        maxUploads: input.maxUploads ?? null,
        gradingFocus: input.gradingFocus ?? null
      };
    }
  });

  setMockModule("../../lib/classes", {
    getClassById: async (classId: string) => ({
      id: classId,
      name: "七年级一班",
      teacherId: "teacher-1",
      subject: "math",
      grade: "7"
    }),
    getClassStudentIds: async () => []
  });

  setMockModule("../../lib/content", {
    normalizeQuestionType: (value?: string | null) => value?.trim().toLowerCase() || "choice",
    createKnowledgePoint: async (input: Record<string, unknown>) => ({
      id: "kp-created",
      unit: "未分单元",
      ...input
    }),
    createQuestion: async (input: Record<string, unknown>) => {
      createQuestionCalls.push({ ...input });
      return {
        id: "q-created",
        ...input
      };
    },
    getKnowledgePoints: async () =>
      options?.knowledgePoints ?? [
        {
          id: "kp-1",
          subject: "math",
          grade: "7",
          title: "整数运算",
          chapter: "第一章",
          unit: "第一单元"
        }
      ],
    getQuestions: async () =>
      options?.questions ?? [
        createQuestionRecord(),
        createQuestionRecord({
          id: "q-2",
          stem: "填空题示例",
          questionType: "fill"
        })
      ]
  });

  setMockModule("../../lib/notifications", {
    createNotification: async (input: Record<string, unknown>) => {
      notificationCalls.push({ ...input });
    }
  });

  setMockModule("../../lib/modules", {
    getModuleById: async () => null
  });

  setMockModule("../../lib/api/http", {
    badRequest: (message: string) => {
      throw Object.assign(new Error(message), { status: 400 });
    },
    notFound: (message: string) => {
      throw Object.assign(new Error(message), { status: 404 });
    }
  });

  const mod = require("../../lib/teacher-assignment-publishing") as TeacherAssignmentPublishingModule;
  return {
    mod,
    aiCalls,
    createQuestionCalls,
    createAssignmentCalls,
    notificationCalls
  };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("publishTeacherAssignment normalizes mixed-case questionType for bank mode pool filtering", async () => {
  const { mod, createAssignmentCalls, aiCalls, createQuestionCalls } = loadTeacherAssignmentPublishingModule();

  const result = await mod.publishTeacherAssignment({
    teacherId: "teacher-1",
    classId: "class-1",
    title: "课堂练习",
    submissionType: "quiz",
    questionCount: 1,
    mode: "bank",
    questionType: " CHOICE "
  });

  assert.equal(result.fallbackMode, null);
  assert.equal(createAssignmentCalls.length, 1);
  assert.deepEqual(createAssignmentCalls[0]?.questionIds, ["q-1"]);
  assert.equal(aiCalls.length, 0);
  assert.equal(createQuestionCalls.length, 0);
});

test("publishTeacherAssignment normalizes mixed-case questionType before AI generation and save", async () => {
  const { mod, aiCalls, createQuestionCalls, createAssignmentCalls } = loadTeacherAssignmentPublishingModule({
    hasLlmProvider: true,
    questions: []
  });

  const result = await mod.publishTeacherAssignment({
    teacherId: "teacher-1",
    classId: "class-1",
    title: "AI 练习",
    submissionType: "quiz",
    questionCount: 1,
    mode: "ai",
    questionType: " Choice "
  });

  assert.equal(result.fallbackMode, null);
  assert.equal(aiCalls.length, 1);
  assert.equal(aiCalls[0]?.questionType, "choice");
  assert.equal(createQuestionCalls.length, 1);
  assert.equal(createQuestionCalls[0]?.questionType, "choice");
  assert.equal(createAssignmentCalls.length, 1);
  assert.deepEqual(createAssignmentCalls[0]?.questionIds, ["q-created"]);
});
