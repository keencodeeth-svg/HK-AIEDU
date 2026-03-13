import type { AssistResponse, StudyCoachResponse } from "./ai-types";

const STAGE_LABELS: Record<StudyCoachResponse["stage"], string> = {
  diagnose: "先说思路",
  check: "知识检查",
  reveal: "完整讲解"
};

function normalizeInline(value: string, maxLength = 72) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

function simplifyStepLead(value: string) {
  const normalized = normalizeInline(value, 48)
    .replace(/[=].*$/, "")
    .replace(/[0-9]+(?:\/[0-9]+)?/g, "关键量")
    .trim();
  return normalized || "先判断题目要你求什么";
}

function buildMasteryFocus(input: {
  question: string;
  subject?: string;
  sources: string[];
}) {
  const primarySource = input.sources.find(Boolean);
  if (primarySource) {
    return `先确认你为什么要用「${primarySource}」来切题。`;
  }

  if (input.subject === "math") {
    if (/\d+\s*\/\s*\d+/.test(input.question) || /分数|通分|约分/.test(input.question)) {
      return "先判断分数之间的关系，再决定是否需要通分或约分。";
    }
    if (/面积|周长|长方形|正方形|三角形|圆|图形/.test(input.question)) {
      return "先找清图形条件和要求，再决定公式。";
    }
    if (/方程|未知数|x|等量关系/.test(input.question)) {
      return "先列出等量关系，再动手求未知数。";
    }
  }

  if (input.subject === "english") {
    return "先判断题目考的是词义、语法还是语境。";
  }

  if (input.subject === "chinese") {
    return "先圈出题干关键词，再判断答题角度。";
  }

  return "先说清题目的已知条件、目标和第一步。";
}

function buildHints(assist: AssistResponse) {
  const nextHints = assist.hints.filter(Boolean).slice(0, 4);
  if (nextHints.length) {
    return nextHints;
  }

  return ["先圈出题目里的已知条件。", "不要急着算，先判断要用什么方法。"];
}

function buildKnowledgeChecks(input: {
  question: string;
  studentAnswer?: string;
  masteryFocus: string;
  sources: string[];
  steps: string[];
}) {
  const primarySource = input.sources.find(Boolean);
  const firstStep = simplifyStepLead(input.steps[0] ?? "");

  return [
    primarySource
      ? `这道题为什么会用到「${primarySource}」？请用一句话说明。`
      : "题目里最关键的已知条件是什么？",
    `如果现在开始，你的第一步会怎么做？可以先从“${firstStep}”这个方向思考。`,
    input.studentAnswer?.trim()
      ? "回头看你的思路，哪一步最不稳？你准备怎么修正？"
      : `请把这句要求落实成你的动作：${input.masteryFocus}`
  ];
}

function buildFeedback(input: { studentAnswer?: string; masteryFocus: string; hints: string[] }) {
  const studentAnswer = input.studentAnswer?.trim();
  if (!studentAnswer) {
    return null;
  }

  const preview = normalizeInline(studentAnswer, 56);
  const nextHint = input.hints[0] ? `提示你先抓住：${normalizeInline(input.hints[0], 36)}` : "";
  const detailHint =
    studentAnswer.length < 16
      ? "思路还比较短，建议补上“已知条件 + 用到的方法 + 第一动作”。"
      : "你已经给出了起点，下一步把方法依据说得更明确。";

  return `已收到你的思路：“${preview}”。${detailHint} 当前先盯住这件事：${input.masteryFocus}${nextHint ? ` ${nextHint}` : ""}`;
}

function buildCoachReply(input: {
  stage: StudyCoachResponse["stage"];
  masteryFocus: string;
  feedback: string | null;
}) {
  if (input.stage === "reveal") {
    return "下面给你完整讲解。看完先别退出，试着不看答案再复述一遍关键转折。";
  }

  if (input.stage === "check") {
    return input.feedback ?? `先别急着看答案，我们继续把这道题的切题方法说扎实。重点是：${input.masteryFocus}`;
  }

  return `先不直接给答案。这一轮按学习模式来，先判断你会不会选对方法。重点是：${input.masteryFocus}`;
}

function buildNextPrompt(input: {
  stage: StudyCoachResponse["stage"];
  question: string;
  studentAnswer?: string;
}) {
  const questionPreview = normalizeInline(input.question, 28);
  if (input.stage === "reveal") {
    return `现在回到题目“${questionPreview}”，请你不用看答案，再复述一遍为什么要这么做。`;
  }

  if (input.studentAnswer?.trim()) {
    return "把你的解法重写成 2-3 句：先说条件，再说方法，最后说第一步。";
  }

  return `围绕题目“${questionPreview}”，先用 1-2 句话说出已知条件和你准备下手的第一步。`;
}

function buildRevealAnswerCta(stage: StudyCoachResponse["stage"]) {
  if (stage === "reveal") {
    return "已显示完整讲解";
  }
  if (stage === "check") {
    return "需要时可查看完整讲解";
  }
  return "先回答后再看讲解";
}

export function buildStudyCoachResponse(input: {
  question: string;
  subject?: string;
  studentAnswer?: string;
  revealAnswer?: boolean;
  assist: AssistResponse;
}): StudyCoachResponse {
  const stage: StudyCoachResponse["stage"] = input.revealAnswer
    ? "reveal"
    : input.studentAnswer?.trim()
      ? "check"
      : "diagnose";
  const hints = buildHints(input.assist);
  const masteryFocus = buildMasteryFocus({
    question: input.question,
    subject: input.subject,
    sources: input.assist.sources
  });
  const feedback = buildFeedback({
    studentAnswer: input.studentAnswer,
    masteryFocus,
    hints
  });
  const knowledgeChecks = buildKnowledgeChecks({
    question: input.question,
    studentAnswer: input.studentAnswer,
    masteryFocus,
    sources: input.assist.sources,
    steps: input.assist.steps
  });

  return {
    learningMode: "study",
    stage,
    stageLabel: STAGE_LABELS[stage],
    coachReply: buildCoachReply({
      stage,
      masteryFocus,
      feedback
    }),
    nextPrompt: buildNextPrompt({
      stage,
      question: input.question,
      studentAnswer: input.studentAnswer
    }),
    knowledgeChecks,
    checkpoints: knowledgeChecks,
    masteryFocus,
    studentTurnRequired: stage !== "reveal",
    answerAvailable: Boolean(input.assist.answer.trim()),
    revealAnswerCta: buildRevealAnswerCta(stage),
    answer: stage === "reveal" ? input.assist.answer : "",
    steps: stage === "reveal" ? input.assist.steps : [],
    hints,
    sources: input.assist.sources,
    provider: input.assist.provider,
    quality: input.assist.quality,
    feedback
  };
}
