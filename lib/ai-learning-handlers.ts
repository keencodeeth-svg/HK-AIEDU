import { retrieveKnowledgePoints, retrieveSimilarQuestion } from "./rag";
import { getEffectiveAiProviderChain } from "./ai-config";
import { normalizeProviderChain } from "./ai-provider";
import { callRoutedLLM } from "./ai-router";
import {
  asJsonObject,
  clampScore,
  getJsonObjectArrayField,
  getJsonObjectField,
  getStringArrayField,
  getStringField
} from "./ai-json";
import { GENERATE_PROMPT, SYSTEM_PROMPT } from "./ai-prompts";
import { buildExplainFallback, buildHomeworkFallback, extractJson } from "./ai-utils";
import type {
  AssistPayload,
  AssistResponse,
  KnowledgePointExtraction,
  LearningReport,
  LessonOutline,
  WritingFeedback,
  WrongReviewScript
} from "./ai-types";

type VisionPromptPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function getPrimaryProvider() {
  const normalized = normalizeProviderChain(getEffectiveAiProviderChain());
  return normalized[0] ?? "mock";
}

export async function generateExplainVariants(payload: {
  subject: string;
  grade: string;
  stem: string;
  answer: string;
  explanation?: string;
  knowledgePointTitle?: string;
  citations?: string[];
}) {
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    payload.knowledgePointTitle ? `知识点：${payload.knowledgePointTitle}` : "",
    payload.citations?.length
      ? `教材依据：\n${payload.citations
          .slice(0, 4)
          .map((item, index) => `${index + 1}. ${item}`)
          .join("\n")}`
      : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n题目：${payload.stem}\n答案：${payload.answer}\n解析：${payload.explanation ?? ""}\n请给出三种版本讲解：文字版、图解版、生活类比版。输出 JSON：{\"text\":\"...\",\"visual\":\"...\",\"analogy\":\"...\"}。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "explanation",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${SYSTEM_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return buildExplainFallback(payload);
  const parsed = asJsonObject(extractJson(llm.text));
  if (!parsed) return buildExplainFallback(payload);
  const textExplain = getStringField(parsed, "text");
  const visual = getStringField(parsed, "visual");
  const analogy = getStringField(parsed, "analogy");
  if (!textExplain || !visual || !analogy) return buildExplainFallback(payload);
  return { text: textExplain, visual, analogy, provider: llm.provider, quality: llm.quality };
}

export async function generateHomeworkReview(payload: {
  subject: string;
  grade: string;
  assignmentTitle: string;
  assignmentDescription?: string;
  focus?: string;
  submissionType?: "quiz" | "upload" | "essay";
  submissionText?: string | null;
  images: Array<{ mimeType: string; base64: string; fileName: string }>;
}) {
  const isEssay = payload.submissionType === "essay";
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    `作业标题：${payload.assignmentTitle}`,
    payload.assignmentDescription ? `作业说明：${payload.assignmentDescription}` : "",
    payload.focus ? `批改重点：${payload.focus}` : "",
    payload.submissionText
      ? `${isEssay ? "作文内容" : "学生备注"}：${payload.submissionText}`
      : ""
  ]
    .filter(Boolean)
    .join("\n");

  const essaySchema =
    "{\"score\":80,\"summary\":\"...\",\"strengths\":[\"...\"],\"issues\":[\"...\"],\"suggestions\":[\"...\"],\"rubric\":[{\"item\":\"...\",\"score\":80,\"comment\":\"...\"}],\"writing\":{\"scores\":{\"structure\":80,\"grammar\":78,\"vocab\":75},\"summary\":\"...\",\"strengths\":[\"...\"],\"improvements\":[\"...\"],\"corrected\":\"...\"}}";
  const homeworkSchema =
    "{\"score\":80,\"summary\":\"...\",\"strengths\":[\"...\"],\"issues\":[\"...\"],\"suggestions\":[\"...\"],\"rubric\":[{\"item\":\"...\",\"score\":80,\"comment\":\"...\"}]}";

  const userText = `${context}\n请对作业进行批改，输出 JSON：${isEssay ? essaySchema : homeworkSchema}。不要输出多余文本。`;

  const content: VisionPromptPart[] = [{ type: "text", text: userText }];
  payload.images.slice(0, 4).forEach((img) => {
    content.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
  });

  const llm = await callRoutedLLM({
    taskType: "homework_review",
    messages: [
      { role: "system", content: "你是老师，擅长批改作业。请给出可执行的点评与评分。" },
      { role: "user", content }
    ],
    temperature: 0.3,
    capability: payload.images.length ? "vision" : "chat",
    customPrompt: userText
  });

  if (!llm?.text) {
    return buildHomeworkFallback({
      subject: payload.subject,
      grade: payload.grade,
      focus: payload.focus,
      uploadCount: payload.images.length,
      submissionType: payload.submissionType,
      submissionText: payload.submissionText
    });
  }

  const parsed = asJsonObject(extractJson(llm.text));
  if (!parsed) {
    return buildHomeworkFallback({
      subject: payload.subject,
      grade: payload.grade,
      focus: payload.focus,
      uploadCount: payload.images.length,
      submissionType: payload.submissionType,
      submissionText: payload.submissionText
    });
  }

  const score = clampScore(parsed.score, 0);
  const summary = getStringField(parsed, "summary");
  const strengths = getStringArrayField(parsed, "strengths", 5);
  const issues = getStringArrayField(parsed, "issues", 5);
  const suggestions = getStringArrayField(parsed, "suggestions", 5);
  const rubric = getJsonObjectArrayField(parsed, "rubric")
    .map((item) => ({
      item: getStringField(item, "item"),
      score: clampScore(item.score, 0),
      comment: getStringField(item, "comment")
    }))
    .filter((item) => item.item);

  const writing = getJsonObjectField(parsed, "writing");
  const writingScores = writing ? getJsonObjectField(writing, "scores") : null;
  const writingBlock = writing
    ? {
        scores: {
          structure: clampScore(writingScores?.structure, 0),
          grammar: clampScore(writingScores?.grammar, 0),
          vocab: clampScore(writingScores?.vocab, 0)
        },
        summary: getStringField(writing, "summary") || "写作结构清晰，可继续优化用词与细节。",
        strengths: getStringArrayField(writing, "strengths", 5),
        improvements: getStringArrayField(writing, "improvements", 5),
        corrected: getStringField(writing, "corrected") || undefined
      }
    : undefined;

  return {
    score: score || 80,
    summary: summary || "已完成批改。",
    strengths: strengths.slice(0, 5),
    issues: issues.slice(0, 5),
    suggestions: suggestions.slice(0, 5),
    rubric: rubric.slice(0, 5),
    writing: writingBlock,
    provider: llm.provider,
    quality: llm.quality
  };
}

export async function generateWritingFeedback(payload: {
  subject: string;
  grade: string;
  title?: string;
  content: string;
}) {
  const context = [`学科：${payload.subject}`, `年级：${payload.grade}`, payload.title ? `题目：${payload.title}` : ""]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n写作内容：${payload.content}\n请给出结构、语法、词汇三个维度的评分（0-100），并提供简短总结、优点、改进建议。返回 JSON：{\"scores\":{\"structure\":80,\"grammar\":78,\"vocab\":75},\"summary\":\"...\",\"strengths\":[\"...\"],\"improvements\":[\"...\"],\"corrected\":\"...\"}。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "writing_feedback",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = asJsonObject(extractJson(llm.text));
  if (!parsed) return null;

  const scores = getJsonObjectField(parsed, "scores");
  const summary = getStringField(parsed, "summary");
  const strengths = getStringArrayField(parsed, "strengths", 3);
  const improvements = getStringArrayField(parsed, "improvements", 3);
  const corrected = getStringField(parsed, "corrected");

  return {
    scores: {
      structure: clampScore(scores?.structure, 0),
      grammar: clampScore(scores?.grammar, 0),
      vocab: clampScore(scores?.vocab, 0)
    },
    summary: summary || "已完成基础批改，请参考评分与建议进行修改。",
    strengths,
    improvements,
    corrected: corrected || undefined,
    quality: llm.quality
  } as WritingFeedback;
}

export async function extractKnowledgePointCandidates(payload: {
  subject: string;
  grade: string;
  text: string;
  candidates?: string[];
}) {
  const primaryProvider = getPrimaryProvider();
  const text = payload.text.trim().slice(0, 3000);
  if (!text) {
    return { points: [], provider: "rule" } as KnowledgePointExtraction;
  }

  const candidateText = (payload.candidates ?? []).slice(0, 60).join("、");
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    candidateText ? `可选知识点：${candidateText}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n文本内容：${text}\n请提取最相关的知识点，返回 JSON：{"points":["知识点1","知识点2"]}。只输出 JSON，不要解释。`;

  const llm = await callRoutedLLM({
    taskType: "kp_extract",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) {
    return { points: [], provider: primaryProvider } as KnowledgePointExtraction;
  }

  const parsed = asJsonObject(extractJson(llm.text));
  if (!parsed) {
    return { points: [], provider: llm.provider, quality: llm.quality } as KnowledgePointExtraction;
  }

  const points = Array.from(
    new Set(
      getStringArrayField(parsed, "points", 10)
    )
  );

  return { points, provider: llm.provider, quality: llm.quality } as KnowledgePointExtraction;
}

export async function generateLessonOutline(payload: {
  subject: string;
  grade: string;
  topic: string;
  knowledgePoints?: string[];
  citations?: string[];
}) {
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    `主题：${payload.topic}`,
    payload.knowledgePoints?.length ? `知识点：${payload.knowledgePoints.join("、")}` : "",
    payload.citations?.length
      ? `教材依据：\n${payload.citations
          .slice(0, 4)
          .map((item, index) => `${index + 1}. ${item}`)
          .join("\n")}`
      : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n请生成课堂讲稿结构，输出 JSON：{\"objectives\":[\"...\"],\"keyPoints\":[\"...\"],\"slides\":[{\"title\":\"...\",\"bullets\":[\"...\"]}],\"blackboardSteps\":[\"...\"]}。slides 为 PPT 大纲，blackboardSteps 为板书步骤。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "lesson_outline",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = asJsonObject(extractJson(llm.text));
  if (!parsed) return null;

  const cleanSlides = getJsonObjectArrayField(parsed, "slides")
    .map((item) => ({
      title: getStringField(item, "title"),
      bullets: getStringArrayField(item, "bullets", 12)
    }))
    .filter((item) => item.title);

  return {
    objectives: getStringArrayField(parsed, "objectives", 12),
    keyPoints: getStringArrayField(parsed, "keyPoints", 12),
    slides: cleanSlides,
    blackboardSteps: getStringArrayField(parsed, "blackboardSteps", 20)
  } as LessonOutline;
}

export async function generateWrongReviewScript(payload: {
  subject: string;
  grade: string;
  className?: string;
  wrongPoints: string[];
}) {
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    payload.className ? `班级：${payload.className}` : "",
    `重点错因/知识点：${payload.wrongPoints.join("、")}`
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n请输出“错题讲评课”脚本，JSON 格式：{\"agenda\":[\"...\"],\"script\":[\"...\"],\"reminders\":[\"...\"]}。script 为讲评课流程话术分段。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "wrong_review_script",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = asJsonObject(extractJson(llm.text));
  if (!parsed) return null;

  return {
    agenda: getStringArrayField(parsed, "agenda", 10),
    script: getStringArrayField(parsed, "script", 30),
    reminders: getStringArrayField(parsed, "reminders", 10)
  } as WrongReviewScript;
}

export async function generateLearningReport(payload: {
  className?: string;
  summary: string;
  weakPoints: string[];
}) {
  const context = [
    payload.className ? `班级：${payload.className}` : "",
    `摘要：${payload.summary}`,
    payload.weakPoints.length ? `薄弱点：${payload.weakPoints.join("、")}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n请生成学情报告，输出 JSON：{\"report\":\"...\",\"highlights\":[\"...\"],\"reminders\":[\"...\"]}。report 为简短段落，reminders 为重点提醒。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "learning_report",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = asJsonObject(extractJson(llm.text));
  if (!parsed) return null;
  const report = getStringField(parsed, "report");

  if (!report) return null;
  return {
    report,
    highlights: getStringArrayField(parsed, "highlights", 10),
    reminders: getStringArrayField(parsed, "reminders", 10),
    quality: llm.quality
  } as LearningReport;
}

export async function generateAssistAnswer(payload: AssistPayload): Promise<AssistResponse> {
  const question = payload.question.trim();
  const subject = payload.subject;
  const grade = payload.grade;
  const memoryContext = payload.memoryContext?.trim();

  const relatedQuestion = await retrieveSimilarQuestion(question, subject, grade);
  const relatedKps = await retrieveKnowledgePoints(question, subject, grade);

  const contextLines = [];
  if (relatedQuestion) {
    contextLines.push(`参考题目：${relatedQuestion.stem}`);
    contextLines.push(`参考解析：${relatedQuestion.explanation}`);
  }
  if (relatedKps.length) {
    contextLines.push(`相关知识点：${relatedKps.map((kp) => kp.title).join("、")}`);
  }
  if (memoryContext) {
    contextLines.push(`学习记忆：${memoryContext}`);
  }

  const userPrompt = `问题：${question}\n${contextLines.join("\n")}\n请用 3-5 句话讲清楚思路。`;

  const llm = await callRoutedLLM({
    taskType: "assist",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${SYSTEM_PROMPT}\n${userPrompt}`
  });
  if (llm?.text) {
    // Primary path: routed model answer + light structured scaffolding for UI rendering.
    return {
      answer: llm.text,
      steps: ["识别题干关键点", "匹配知识点", "给出清晰步骤"],
      hints: ["先理解题意", "注意单位一致"],
      sources: relatedKps.map((kp) => kp.title),
      provider: llm.provider,
      quality: llm.quality
    };
  }

  if (relatedQuestion) {
    // Secondary path: retrieval fallback when model chain is unavailable.
    return {
      answer: relatedQuestion.explanation,
      steps: ["看清题目条件", "列出关键关系", "逐步计算"],
      hints: ["先把题目中的已知量圈出来", "分步检查"],
      sources: [relatedQuestion.knowledgePointId],
      provider: "mock"
    };
  }

  const kpNames = relatedKps.map((kp) => kp.title);
  // Last-resort fallback keeps tutoring endpoint usable even without model + retrieval hit.
  const fallback = kpNames.length
    ? `这道题可能属于：${kpNames.join("、")}。建议先回顾该知识点，再按步骤解题。`
    : "先找出题目中的数量关系，然后一步步推理。";

  return {
    answer: fallback,
    steps: ["找出已知条件", "确定目标", "逐步推导"],
    hints: ["画图或列式", "检查是否需要通分"],
    sources: kpNames,
    provider: "mock"
  };
}
