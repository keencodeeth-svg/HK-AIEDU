import { generateAssistAnswer } from "@/lib/ai";
import { buildStudyCoachResponse } from "@/lib/ai-study-mode";
import { addHistoryItem, AI_HISTORY_ORIGINS, getHistoryByUser, type AiHistoryItem } from "@/lib/ai-history";
import { assessAiQuality } from "@/lib/ai-quality-control";
import { badRequest, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createAiRoute } from "@/lib/api/domains";

const coachBodySchema = v.object<{
  question: string;
  subject?: string;
  grade?: string;
  studentAnswer?: string;
  revealAnswer?: boolean;
  origin?: (typeof AI_HISTORY_ORIGINS)[number];
}>(
  {
    question: v.string({ minLength: 1 }),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    studentAnswer: v.optional(v.string({ allowEmpty: true, trim: false })),
    revealAnswer: v.optional(v.boolean()),
    origin: v.optional(v.enum(AI_HISTORY_ORIGINS))
  },
  { allowUnknown: false }
);

type CoachMemorySnapshot = {
  recentSessionCount: number;
  recentQuestions: string[];
  patternHint: string;
  contextPrompt: string;
};

function getTagValue(tags: string[], prefix: string) {
  const found = tags.find((tag) => tag.startsWith(prefix));
  if (!found) return "";
  return found.slice(prefix.length).trim();
}

function toPreview(value: string, max = 24) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function buildCoachMemorySnapshot(params: {
  history: AiHistoryItem[];
  subject?: string;
  grade?: string;
}): CoachMemorySnapshot {
  // Memory is scoped by subject/grade so hints do not leak across learning contexts.
  const scoped = params.history.filter((item) => {
    if (!item.tags?.includes("coach_session")) return false;
    const subjectTag = getTagValue(item.tags, "subject:");
    const gradeTag = getTagValue(item.tags, "grade:");
    if (params.subject && subjectTag !== params.subject) return false;
    if (params.grade && gradeTag !== params.grade) return false;
    return true;
  });
  const recent = scoped.slice(0, 5);
  const recentQuestions = recent.map((item) => toPreview(item.question)).filter(Boolean);
  const hasThinkingCount = recent.filter((item) => item.tags?.includes("with_thinking")).length;

  const patternHint =
    recent.length >= 4
      ? `最近 ${recent.length} 次陪练已连续进行，${
          hasThinkingCount >= Math.max(2, Math.floor(recent.length / 2))
            ? "你有持续提交思路，建议继续保持“先说思路再求解”。"
            : "建议每次先提交你的思路，再看分步提示，提分更稳定。"
        }`
      : recent.length >= 1
        ? "已记录近期陪练轨迹，本次会延续你的学习节奏。"
        : "这是你的首轮陪练记录，建议连续 3 天保持练习。";

  const contextPrompt = recent.length
    ? `最近陪练题目：${recentQuestions.join("；")}。${hasThinkingCount > 0 ? `其中 ${hasThinkingCount} 次提交了解题思路。` : "历史记录中暂未提交解题思路。"}`
    : "";

  return {
    recentSessionCount: recent.length,
    recentQuestions,
    patternHint,
    contextPrompt
  };
}

export const POST = createAiRoute({
  role: ["student", "teacher", "parent", "admin", "school_admin"],
  body: coachBodySchema,
  cache: "private-realtime",
  handler: async ({ body, user }) => {
    if (!user) {
      unauthorized();
    }

    if (!body.question?.trim()) {
      badRequest("missing question");
    }

    const question = body.question.trim();
    const subject = body.subject?.trim();
    const grade = body.grade?.trim();
    let memorySnapshot: CoachMemorySnapshot;
    if (user.role === "student") {
      try {
        const history = await getHistoryByUser(user.id);
        memorySnapshot = buildCoachMemorySnapshot({
          history,
          subject,
          grade
        });
      } catch {
        memorySnapshot = {
          recentSessionCount: 0,
          recentQuestions: [],
          patternHint: "陪练记录暂不可用，先按当前题目给出分步提示。",
          contextPrompt: ""
        };
      }
    } else {
      // Non-student roles can use coach but do not persist long-term learning memory.
      memorySnapshot = {
        recentSessionCount: 0,
        recentQuestions: [],
        patternHint: "当前角色不记录长期陪练记忆。",
        contextPrompt: ""
      };
    }

    const assist = await generateAssistAnswer({
      question,
      subject,
      grade,
      memoryContext: memorySnapshot.contextPrompt,
      answerMode: "hints_first"
    });

    const study = buildStudyCoachResponse({
      question,
      subject,
      studentAnswer: body.studentAnswer,
      revealAnswer: body.revealAnswer,
      assist
    });
    const quality = assessAiQuality({
      kind: "coach",
      taskType: "assist",
      provider: assist.provider,
      textBlocks: [
        study.coachReply,
        study.nextPrompt,
        ...(study.hints ?? []),
        ...(study.knowledgeChecks ?? []),
        ...(study.steps ?? []),
        study.answer,
        study.feedback ?? ""
      ],
      listCountHint: study.knowledgeChecks.length + study.hints.length + study.steps.length
    });

    if (user.role === "student") {
      try {
        const tags = [
          "coach_session",
          "study_mode",
          subject ? `subject:${subject}` : "",
          grade ? `grade:${grade}` : "",
          body.studentAnswer?.trim() ? "with_thinking" : "without_thinking",
          body.revealAnswer ? "answer_revealed" : "answer_locked"
        ].filter(Boolean);
        const answerSummary = [
          study.coachReply,
          study.feedback ?? "",
          study.nextPrompt,
          body.revealAnswer ? study.answer : "答案暂未揭晓",
          ...(body.revealAnswer ? study.steps.slice(0, 2) : study.hints.slice(0, 2))
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, 4000);
        await addHistoryItem({
          userId: user.id,
          question,
          answer: answerSummary,
          favorite: false,
          tags,
          meta: {
            origin: body.origin ?? "text",
            learningMode: "study",
            subject,
            grade,
            answerMode: "hints_first",
            provider: assist.provider,
            recognizedQuestion: question,
            quality
          }
        });
      } catch {
        // History persistence failure should not block real-time coaching.
      }
    }

    return {
      data: {
        ...study,
        source: study.sources,
        recognizedQuestion: question,
        memory: {
          recentSessionCount: memorySnapshot.recentSessionCount,
          recentQuestions: memorySnapshot.recentQuestions,
          patternHint: memorySnapshot.patternHint
        },
        provider: assist.provider,
        quality
      }
    };
  }
});
