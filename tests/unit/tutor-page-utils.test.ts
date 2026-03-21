import assert from "node:assert/strict";
import { test } from "node:test";

const {
  buildTutorHistoryReuseFlowState,
  buildTutorHistoryReuseState,
  buildTutorStartOverFlowState,
  resolveTutorModeLabels
} = require("../../app/tutor/tutorPageUtils") as typeof import("../../app/tutor/tutorPageUtils");

test("tutor page helpers resolve mode labels for direct and study results", () => {
  assert.deepEqual(
    resolveTutorModeLabels({
      learningMode: "direct",
      answerMode: "hints_first",
      resultAnswerMode: "answer_only",
      studyResult: false
    }),
    {
      selectedModeLabel: "先提示后答案",
      resolvedModeLabel: "只要答案"
    }
  );

  assert.deepEqual(
    resolveTutorModeLabels({
      learningMode: "study",
      answerMode: "step_by_step",
      resultAnswerMode: "step_by_step",
      studyResult: true
    }),
    {
      selectedModeLabel: "学习模式",
      resolvedModeLabel: "学习模式"
    }
  );
});

test("tutor page helpers build history reuse state from recognized question and meta", () => {
  assert.deepEqual(
    buildTutorHistoryReuseState({
      id: "history-1",
      question: "原题干",
      answer: "答案",
      createdAt: "2026-03-19T08:00:00.000Z",
      favorite: false,
      tags: [],
      meta: {
        origin: "image",
        recognizedQuestion: "识别后的题干",
        subject: "physics",
        grade: "8",
        answerMode: "hints_first",
        learningMode: "study"
      }
    }),
    {
      nextQuestion: "识别后的题干",
      nextSubject: "physics",
      nextGrade: "8",
      nextAnswerMode: "hints_first",
      nextLearningMode: "study",
      launchIntent: "image",
      actionMessage: "已从历史记录回填到提问区，可继续追问或重新求解。"
    }
  );

  assert.deepEqual(
    buildTutorHistoryReuseState({
      id: "history-2",
      question: "  直接输入题目  ",
      answer: "答案",
      createdAt: "2026-03-19T08:00:00.000Z",
      favorite: false,
      tags: []
    }),
    {
      nextQuestion: "直接输入题目",
      nextSubject: undefined,
      nextGrade: undefined,
      nextAnswerMode: undefined,
      nextLearningMode: "direct",
      launchIntent: "text",
      actionMessage: "已从历史记录回填到提问区，可继续追问或重新求解。"
    }
  );
});

test("tutor page helpers build history reuse flow state with reset defaults", () => {
  assert.deepEqual(
    buildTutorHistoryReuseFlowState({
      id: "history-3",
      question: "  原始题干  ",
      answer: "答案",
      createdAt: "2026-03-19T08:00:00.000Z",
      favorite: false,
      tags: [],
      meta: {
        origin: "text",
        subject: "chemistry",
        grade: "9",
        answerMode: "step_by_step",
        learningMode: "direct"
      }
    }),
    {
      nextQuestion: "原始题干",
      nextSubject: "chemistry",
      nextGrade: "9",
      nextAnswerMode: "step_by_step",
      nextLearningMode: "direct",
      launchIntent: "text",
      actionMessage: "已从历史记录回填到提问区，可继续追问或重新求解。",
      nextEditableQuestion: "原始题干",
      nextStudyThinking: "",
      nextStudyHintCount: 0,
      nextAnswer: null,
      nextResultOrigin: null,
      nextError: null,
      toastMessage: "已回填到提问区，可继续追问或重新求解"
    }
  );
});

test("tutor page helpers build start-over flow state deterministically", () => {
  assert.deepEqual(buildTutorStartOverFlowState(), {
    launchIntent: "text",
    launchMessage: null,
    actionMessage: null,
    nextAnswer: null,
    nextStudyThinking: "",
    nextStudyHintCount: 0,
    nextEditableQuestion: "",
    nextQuestion: "",
    nextResultOrigin: null,
    nextError: null,
    toastMessage: "已清空当前结果，可以开始新一轮提问"
  });
});
