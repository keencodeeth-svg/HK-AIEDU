import type {
  TutorAnswer,
  TutorAnswerMode,
  TutorAskResponse,
  TutorHistoryOrigin
} from "./types";
import { requestJson } from "@/lib/client-request";
import type { TutorLearningMode } from "./utils";

export function normalizeTutorAnswer(
  data: TutorAnswer & {
    source?: string[];
    sources?: string[];
  },
  nextLearningMode: TutorLearningMode,
  fallbackQuestion?: string
) {
  return {
    ...data,
    learningMode: nextLearningMode,
    recognizedQuestion: data.recognizedQuestion?.trim() || fallbackQuestion?.trim() || undefined,
    source: data.source ?? data.sources
  } as TutorAnswer;
}

type RequestTutorAssistParams = {
  question: string;
  subject: string;
  grade: string;
  answerMode: TutorAnswerMode;
};

export async function requestTutorAssist({
  question,
  subject,
  grade,
  answerMode
}: RequestTutorAssistParams) {
  const payload = await requestJson<TutorAskResponse>("/api/ai/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, subject, grade, answerMode })
  });

  return normalizeTutorAnswer(
    (payload.data ?? payload) as TutorAnswer,
    "direct",
    question
  );
}

type RequestTutorCoachParams = {
  question: string;
  subject: string;
  grade: string;
  origin: TutorHistoryOrigin;
  studentAnswer?: string;
  revealAnswer?: boolean;
};

export async function requestTutorCoach({
  question,
  subject,
  grade,
  origin,
  studentAnswer,
  revealAnswer
}: RequestTutorCoachParams) {
  const payload = await requestJson<
    TutorAskResponse & { data?: TutorAnswer & { sources?: string[] } }
  >("/api/ai/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      subject,
      grade,
      studentAnswer,
      revealAnswer,
      origin
    })
  });

  return normalizeTutorAnswer(
    (payload.data ?? payload) as TutorAnswer & { sources?: string[] },
    "study",
    question
  );
}
