import { getCurrentUser } from "@/lib/auth";
import { generateAssistAnswer } from "@/lib/ai";
import { addHistoryItem, getHistoryByUser, type AiHistoryItem } from "@/lib/ai-history";
import { assessAiQuality } from "@/lib/ai-quality-control";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createAiRoute } from "@/lib/api/domains";

const coachBodySchema = v.object<{
  question: string;
  subject?: string;
  grade?: string;
  studentAnswer?: string;
}>(
  {
    question: v.string({ minLength: 1 }),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    studentAnswer: v.optional(v.string({ allowEmpty: true, trim: false }))
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
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const body = await parseJson(request, coachBodySchema);
    if (!body.question?.trim()) {
      badRequest("missing question");
    }

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
      question: body.question.trim(),
      subject,
      grade,
      memoryContext: memorySnapshot.contextPrompt
    });

    const checkpoints = [
      "你能先说出题目里给了哪些已知条件吗？",
      "这道题对应哪个知识点或公式？",
      "下一步你准备怎么做？"
    ];

    const feedback = body.studentAnswer
      ? `我看到你的思路：${body.studentAnswer}。我们先对照已知条件和关键公式，再把步骤拆成 2-3 步。`
      : null;
    const quality = assessAiQuality({
      kind: "coach",
      taskType: "assist",
      provider: assist.provider,
      textBlocks: [assist.answer, ...(assist.steps ?? []), ...(assist.hints ?? []), feedback ?? ""],
      listCountHint: checkpoints.length + (assist.steps?.length ?? 0)
    });

    if (user.role === "student") {
      try {
        const tags = [
          "coach_session",
          subject ? `subject:${subject}` : "",
          grade ? `grade:${grade}` : "",
          body.studentAnswer?.trim() ? "with_thinking" : "without_thinking"
        ].filter(Boolean);
        const answerSummary = [assist.answer, feedback ?? ""].filter(Boolean).join("\n").slice(0, 4000);
        await addHistoryItem({
          userId: user.id,
          question: body.question.trim(),
          answer: answerSummary,
          favorite: false,
          tags
        });
      } catch {
        // History persistence failure should not block real-time coaching.
      }
    }

    return {
      data: {
        answer: assist.answer,
        steps: assist.steps,
        hints: assist.hints,
        checkpoints,
        feedback,
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
