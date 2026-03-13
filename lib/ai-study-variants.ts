import type { QuestionDraft } from "./ai-types";

type StudyVariantFallbackInput = {
  question: string;
  answer: string;
  subject?: string;
  knowledgePointTitle?: string;
  count?: number;
};

function toPreview(value: string, maxLength = 26) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "当前题目";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

function placeCorrectOption(options: string[], correctAnswer: string, seed: number) {
  const unique = Array.from(new Set([correctAnswer, ...options.filter((item) => item && item !== correctAnswer)])).slice(0, 4);
  if (!unique.includes(correctAnswer)) {
    unique.unshift(correctAnswer);
  }

  const filtered = unique.filter((item) => item !== correctAnswer);
  while (filtered.length < 3) {
    filtered.push(`干扰项 ${filtered.length + 1}`);
  }
  const index = Math.min(Math.max(seed, 0), 3);
  const arranged = filtered.slice(0, 3);
  arranged.splice(index, 0, correctAnswer);
  return arranged.slice(0, 4);
}

function buildGenericFallbacks(input: StudyVariantFallbackInput) {
  const topic = input.knowledgePointTitle || "这类题";
  const questionPreview = toPreview(input.question);
  return [
    {
      stem: `做和“${questionPreview}”同类型的题时，第一步最应该做什么？`,
      correctAnswer: `先判断它是不是在考“${topic}”`,
      distractors: ["先直接套上题答案", "先跳过题干开始计算", "先记住结果再说"],
      explanation: `迁移练习最重要的是先识别题型和关键条件，而不是照抄原题步骤。`
    },
    {
      stem: `如果这类题的数字或条件变了，你最该先检查什么？`,
      correctAnswer: "原来的方法为什么仍然成立",
      distractors: ["上题答案能不能直接搬过来", "能不能不看条件继续做", "是否只要记最后结果"],
      explanation: `真正会做，靠的是理解方法成立的原因；条件一变，先确认方法是否还适用。`
    },
    {
      stem: `做完“${topic}”同类题后，哪种复盘方式最有效？`,
      correctAnswer: "不用看答案，复述关键条件、方法和第一步",
      distractors: ["只背最终答案", "马上切走，不再回看", "只记住计算结果"],
      explanation: `复述“条件 -> 方法 -> 第一步”，最能检验你是否真的掌握。`
    }
  ];
}

function buildEnglishFallbacks(input: StudyVariantFallbackInput) {
  const topic = input.knowledgePointTitle || "当前英语知识点";
  return [
    {
      stem: `做“${topic}”同类题时，最先该检查哪一项？`,
      correctAnswer: "题干语境和关键词在提示什么",
      distractors: ["先选最长的选项", "先背上题答案", "先跳过句子结构"],
      explanation: `英语迁移先看语境和关键词，再判断词义、时态或语法功能。`
    },
    {
      stem: "如果选项看起来都很像，最稳的做法是什么？",
      correctAnswer: "回到原句，核对语义和语法是否同时成立",
      distractors: ["凭感觉快速选一个", "只看单词长度", "只看中文意思不看句子"],
      explanation: `同类题想做稳，必须同时检查语义和语法位置。`
    }
  ];
}

function buildChineseFallbacks(input: StudyVariantFallbackInput) {
  const topic = input.knowledgePointTitle || "当前语文题型";
  return [
    {
      stem: `做“${topic}”同类题时，第一步最稳的动作是什么？`,
      correctAnswer: "先圈出题干关键词和作答要求",
      distractors: ["先背上题答案", "先看最后一句", "先随便写一个结论"],
      explanation: `语文题迁移先读清“问什么”，否则很容易答偏。`
    },
    {
      stem: "如果题目换了材料，你最该先保持什么不变？",
      correctAnswer: "分析路径不变，先找信息再组织表达",
      distractors: ["直接照搬原题原句", "只写情绪不写依据", "只记住参考答案结尾"],
      explanation: `材料会变，但分析路径和证据意识不能丢。`
    }
  ];
}

function buildMathFallbacks(input: StudyVariantFallbackInput) {
  const topic = input.knowledgePointTitle || "当前数学知识点";
  return [
    {
      stem: `遇到“${topic}”同类题时，最应该先确认什么？`,
      correctAnswer: "题目条件和要用的方法是否匹配",
      distractors: ["直接抄上题步骤", "先看答案再算", "只记住最后数字"],
      explanation: `数学迁移不是抄过程，而是先判断条件变了以后方法还能不能用。`
    },
    {
      stem: "如果数字变了，但题型相近，最稳的第一步是什么？",
      correctAnswer: "重新列出已知条件，再决定公式或关系",
      distractors: ["直接把上题数字替换一下", "跳过列式直接口算", "只看最后结果"],
      explanation: `同类题也要重新列条件，避免把原题关系误搬到新题上。`
    }
  ];
}

export function buildStudyTransferGoal(input: {
  question: string;
  answer: string;
  subject?: string;
  knowledgePointTitle?: string;
}) {
  const topic = input.knowledgePointTitle || "这类题";
  if (input.subject === "english") {
    return `现在别只停在看懂答案，继续做 2 题“${topic}”同类练习，重点检查语境和语法是否真会判断。`;
  }
  if (input.subject === "chinese") {
    return `接下来做 2 题“${topic}”迁移练习，重点看你能不能在新材料里复用同一套分析路径。`;
  }
  if (input.subject === "math") {
    return `接下来做 2-3 题“${topic}”变式巩固，重点不是抄步骤，而是确认条件变了以后你还能选对方法。`;
  }
  return `继续做 2-3 题同类变式，验证你能不能把刚才的做法迁移到新题上，而不是只记住这道题的答案。`;
}

export function buildFallbackStudyVariants(input: StudyVariantFallbackInput): QuestionDraft[] {
  const count = Math.min(Math.max(Number(input.count) || 2, 1), 3);
  const templates =
    input.subject === "english"
      ? buildEnglishFallbacks(input)
      : input.subject === "chinese"
        ? buildChineseFallbacks(input)
        : input.subject === "math"
          ? buildMathFallbacks(input)
          : buildGenericFallbacks(input);

  return templates.slice(0, count).map((item, index) => {
    const options = placeCorrectOption(item.distractors, item.correctAnswer, index % 4);
    return {
      stem: item.stem,
      options,
      answer: item.correctAnswer,
      explanation: item.explanation
    };
  });
}
