export type StudyReflectionMasteryLevel = "secure" | "developing" | "review";

export type StudyReflectionVariantAttempt = {
  stem: string;
  answer: string;
  explanation: string;
  studentAnswer?: string;
};

export type StudyReflectionDetail = {
  title: string;
  analysis: string;
  hints: string[];
  variantStem?: string;
};

export type StudyVariantReflection = {
  masteryLevel: StudyReflectionMasteryLevel;
  masteryLabel: string;
  correctCount: number;
  total: number;
  answeredCount: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  detailSource: "ai" | "fallback";
  detail: StudyReflectionDetail;
};

type StudyReflectionInput = {
  subject?: string;
  knowledgePointTitle?: string;
  variants: StudyReflectionVariantAttempt[];
};

function normalizeText(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function getTopic(input: StudyReflectionInput) {
  return normalizeText(input.knowledgePointTitle) || "这类题";
}

function buildMasteryLevel(input: { answeredCount: number; total: number; correctCount: number }): StudyReflectionMasteryLevel {
  if (input.answeredCount <= 0) {
    return "review";
  }
  if (input.answeredCount < input.total) {
    return input.correctCount === input.answeredCount ? "developing" : input.correctCount >= Math.ceil(input.answeredCount / 2) ? "developing" : "review";
  }
  if (input.correctCount === input.total) {
    return "secure";
  }
  return input.correctCount >= Math.ceil(input.total / 2) ? "developing" : "review";
}

function buildMasteryLabel(level: StudyReflectionMasteryLevel) {
  if (level === "secure") return "迁移已稳";
  if (level === "developing") return "还需巩固";
  return "建议回看";
}

function buildSummary(input: {
  subject?: string;
  topic: string;
  total: number;
  answeredCount: number;
  correctCount: number;
  level: StudyReflectionMasteryLevel;
}) {
  if (input.answeredCount < input.total) {
    return `你已经提交 ${input.answeredCount}/${input.total} 题，当前答对 ${input.correctCount} 题。先把剩余变式做完，再判断“${input.topic}”是不是真的迁移稳了。`;
  }
  if (input.level === "secure") {
    return `这轮 ${input.total} 题全部答对，说明你已经能把“${input.topic}”的方法迁移到新题里，不只是记住原题答案。`;
  }
  if (input.level === "developing") {
    return `这轮 ${input.total} 题答对 ${input.correctCount} 题，说明你开始会迁移“${input.topic}”，但看到条件变化时，方法判断还不够稳定。`;
  }
  if (input.subject === "english") {
    return `这轮 ${input.total} 题里还没有把“${input.topic}”迁移稳，主要问题更像是没有先回到语境和句子结构再判断。`;
  }
  if (input.subject === "chinese") {
    return `这轮 ${input.total} 题里还没有把“${input.topic}”迁移稳，说明材料一换，你的分析路径还没固定下来。`;
  }
  return `这轮 ${input.total} 题里还没有把“${input.topic}”迁移稳，问题不在算得慢，而在看到新条件时还没先判断该用什么方法。`;
}

function buildStrengths(input: {
  topic: string;
  level: StudyReflectionMasteryLevel;
  correctCount: number;
  answeredCount: number;
}) {
  const strengths: string[] = [];
  if (input.correctCount > 0) {
    strengths.push(`至少有 ${input.correctCount} 题说明你已经能在新条件下识别“${input.topic}”的核心方法。`);
  }
  if (input.level === "secure") {
    strengths.push("这轮没有停在背答案，而是把方法真正迁移到了新题。");
    strengths.push("你对题干变化的适应是稳定的，可以开始拉开一点难度。");
  } else if (input.answeredCount > 0 && input.correctCount > 0) {
    strengths.push("你已经出现了正确迁移的信号，接下来要做的是把这种判断变成稳定动作。");
  }
  return strengths.slice(0, 3);
}

function buildImprovements(input: {
  subject?: string;
  topic: string;
  total: number;
  answeredCount: number;
  wrongCount: number;
}) {
  const improvements: string[] = [];
  if (input.answeredCount < input.total) {
    improvements.push("剩余题目还没提交，当前复盘只能先看趋势，不能代表最终掌握情况。");
  }
  if (input.wrongCount > 0) {
    improvements.push(`做错的 ${input.wrongCount} 题说明你还需要把“${input.topic}”的判断依据说得更清楚，而不是直接套原题印象。`);
  }
  if (input.subject === "english") {
    improvements.push("先回到原句核对语境和语法位置，再在相似选项里做判断。");
  } else if (input.subject === "chinese") {
    improvements.push("材料可以变，但读题关键词、找依据、再组织表达的路径不能变。");
  } else {
    improvements.push("下一次先重列已知条件，再决定公式、关系或方法，不要直接搬原题步骤。");
  }
  return improvements.slice(0, 3);
}

function buildNextSteps(input: { subject?: string; topic: string; level: StudyReflectionMasteryLevel }) {
  if (input.subject === "english") {
    return input.level === "secure"
      ? [
          `不用看解析，自己解释一次“${input.topic}”要先看哪些语境线索。`,
          "再做 1 题同语法点但换句子的题，确认你不是只记住原句。"
        ]
      : [
          "把做错的题重新读一遍，只圈关键词和语法位置，不急着选答案。",
          `用一句话写下：遇到“${input.topic}”时，我先检查什么。`
        ];
  }
  if (input.subject === "chinese") {
    return input.level === "secure"
      ? [
          `闭卷复述一次“${input.topic}”的作答路径：先看什么，再写什么。`,
          "再做 1 题换材料但题型相同的题，检验分析路径是否稳定。"
        ]
      : [
          "把原题和错题并排看，只比较题干要求和作答依据有什么变化。",
          `重新说一遍“${input.topic}”这类题的第一步和证据来源。`
        ];
  }
  return input.level === "secure"
    ? [
        `不用看讲解，自己复述一次“${input.topic}”的条件、方法和第一步。`,
        "再做 1 题把数字或条件换掉但方法相同的题，继续验证迁移是否稳定。"
      ]
    : [
        "把原题和做错的变式并排看，只比较条件哪里变了、方法为什么还能或不能继续用。",
        `写下一句自己的判定规则：看到什么条件，就优先想到“${input.topic}”的哪种方法。`
      ];
}

function buildFallbackDetail(input: {
  subject?: string;
  level: StudyReflectionMasteryLevel;
  wrongVariant?: StudyReflectionVariantAttempt;
}) {
  if (!input.wrongVariant) {
    return {
      title: "继续拉开难度",
      analysis: `这轮都做对了。下一步别停在“选对答案”，而是试着不用看解析，自己说出“看到什么条件 -> 用什么方法 -> 为什么这样做”。`,
      hints:
        input.subject === "english"
          ? ["闭卷解释这类题先看哪几个关键词。", "把同语法点换成新句子再做 1 题。"]
          : input.subject === "chinese"
            ? ["复述这类题的读题要求和取证路径。", "换一段新材料再做 1 题。"]
            : ["闭卷复述这类题的条件、方法和第一步。", "把数字换掉再做 1 题，确认方法还能用。"],
      variantStem: undefined
    };
  }

  if (input.subject === "english") {
    return {
      title: "重点错因",
      analysis: `这次更像是没有先回到语境和句子结构做判断，而是在相似选项里过早做了选择。真正稳定的做法，是先确认句子到底需要什么语法或词义线索。`,
      hints: ["先划出决定答案的关键词。", "先判语法位置，再判语义是否通顺。", "重新解释一次为什么正确选项同时满足语义和语法。"],
      variantStem: input.wrongVariant.stem
    };
  }

  if (input.subject === "chinese") {
    return {
      title: "重点错因",
      analysis: `这次更像是材料一换，你就开始凭印象作答，没有先重新对齐题干要求和文本依据。语文迁移最怕的是会背答案、不会抓证据。`,
      hints: ["先圈出题干关键词和作答要求。", "先找文本依据，再组织表达。", "复述一次正确答案背后的证据链。"],
      variantStem: input.wrongVariant.stem
    };
  }

  return {
    title: "重点错因",
    analysis:
      input.level === "review"
        ? `这次更像是把原题印象直接搬到了新题，没有先重新核对条件和方法是否匹配。数学迁移不靠背步骤，而是靠先判断为什么这个方法还能用。`
        : `你已经有部分迁移能力了，但做错这题说明一遇到条件变化，第一步判断还不够稳。先别急着算，先确认题目到底在考什么关系。`,
    hints: ["重新列出这题的已知条件和目标。", "先说出为什么要用这个方法，再动笔。", "对照正确答案，找出你是在哪一步开始沿错方向走的。"],
    variantStem: input.wrongVariant.stem
  };
}

export function buildStudyVariantReflection(input: StudyReflectionInput): StudyVariantReflection {
  const normalizedVariants = input.variants.map((variant) => ({
    stem: normalizeText(variant.stem),
    answer: normalizeText(variant.answer),
    explanation: normalizeText(variant.explanation),
    studentAnswer: normalizeText(variant.studentAnswer)
  }));

  const answeredVariants = normalizedVariants.filter((variant) => variant.studentAnswer);
  const wrongVariants = answeredVariants.filter((variant) => variant.studentAnswer !== variant.answer);
  const correctCount = answeredVariants.length - wrongVariants.length;
  const topic = getTopic(input);
  const masteryLevel = buildMasteryLevel({
    answeredCount: answeredVariants.length,
    total: normalizedVariants.length,
    correctCount
  });

  return {
    masteryLevel,
    masteryLabel: buildMasteryLabel(masteryLevel),
    correctCount,
    total: normalizedVariants.length,
    answeredCount: answeredVariants.length,
    summary: buildSummary({
      subject: input.subject,
      topic,
      total: normalizedVariants.length,
      answeredCount: answeredVariants.length,
      correctCount,
      level: masteryLevel
    }),
    strengths: buildStrengths({
      topic,
      level: masteryLevel,
      correctCount,
      answeredCount: answeredVariants.length
    }),
    improvements: buildImprovements({
      subject: input.subject,
      topic,
      total: normalizedVariants.length,
      answeredCount: answeredVariants.length,
      wrongCount: wrongVariants.length
    }),
    nextSteps: buildNextSteps({
      subject: input.subject,
      topic,
      level: masteryLevel
    }),
    detailSource: "fallback",
    detail: buildFallbackDetail({
      subject: input.subject,
      level: masteryLevel,
      wrongVariant: wrongVariants[0]
    })
  };
}
