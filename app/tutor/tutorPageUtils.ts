import type { TutorLaunchIntent } from "@/lib/tutor-launch";
import { ANSWER_MODE_OPTIONS, LEARNING_MODE_OPTIONS } from "./config";
import type { TutorAnswerMode, TutorHistoryItem } from "./types";
import type { TutorLearningMode } from "./utils";

type ResolveTutorModeLabelsArgs = {
  learningMode: TutorLearningMode;
  answerMode: TutorAnswerMode;
  resultAnswerMode: TutorAnswerMode;
  studyResult: boolean;
};

export function resolveTutorModeLabels({
  learningMode,
  answerMode,
  resultAnswerMode,
  studyResult
}: ResolveTutorModeLabelsArgs) {
  const selectedLearningMode =
    LEARNING_MODE_OPTIONS.find((item) => item.value === learningMode) ?? LEARNING_MODE_OPTIONS[0];
  const selectedAnswerMode =
    ANSWER_MODE_OPTIONS.find((item) => item.value === answerMode) ?? ANSWER_MODE_OPTIONS[1];
  const resolvedAnswerMode =
    ANSWER_MODE_OPTIONS.find((item) => item.value === resultAnswerMode) ?? selectedAnswerMode;

  return {
    selectedModeLabel:
      learningMode === "study" ? selectedLearningMode.label : selectedAnswerMode.label,
    resolvedModeLabel: studyResult ? "学习模式" : resolvedAnswerMode.label
  };
}

export function buildTutorHistoryReuseState(item: TutorHistoryItem) {
  const nextLearningMode: TutorLearningMode =
    item.meta?.learningMode === "study" ? "study" : "direct";
  const nextQuestion = item.meta?.recognizedQuestion?.trim() || item.question.trim();
  const launchIntent: TutorLaunchIntent =
    (item.meta?.origin ?? "text") === "image" ? "image" : "text";

  return {
    nextQuestion,
    nextSubject: item.meta?.subject,
    nextGrade: item.meta?.grade,
    nextAnswerMode: item.meta?.answerMode,
    nextLearningMode,
    launchIntent,
    actionMessage: "已从历史记录回填到提问区，可继续追问或重新求解。"
  };
}

export function buildTutorHistoryReuseFlowState(item: TutorHistoryItem) {
  const reuseState = buildTutorHistoryReuseState(item);
  return {
    ...reuseState,
    nextEditableQuestion: reuseState.nextQuestion,
    nextStudyThinking: "",
    nextStudyHintCount: 0,
    nextAnswer: null,
    nextResultOrigin: null,
    nextError: null,
    toastMessage: "已回填到提问区，可继续追问或重新求解"
  };
}

export function buildTutorStartOverFlowState() {
  return {
    launchIntent: "text" as TutorLaunchIntent,
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
  };
}
