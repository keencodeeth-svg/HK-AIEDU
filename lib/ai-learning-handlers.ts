import { retrieveKnowledgePoints, retrieveSimilarQuestion } from "./rag";
import { getEffectiveAiProviderChain } from "./ai-config";
import { normalizeProviderChain } from "./ai-provider";
import { callRoutedLLM } from "./ai-router";
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
  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") return buildExplainFallback(payload);
  const textExplain = String((parsed as any).text ?? "").trim();
  const visual = String((parsed as any).visual ?? "").trim();
  const analogy = String((parsed as any).analogy ?? "").trim();
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

  const content: any[] = [{ type: "text", text: userText }];
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

  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") {
    return buildHomeworkFallback({
      subject: payload.subject,
      grade: payload.grade,
      focus: payload.focus,
      uploadCount: payload.images.length,
      submissionType: payload.submissionType,
      submissionText: payload.submissionText
    });
  }

  const score = Math.max(0, Math.min(100, Math.round(Number((parsed as any).score ?? 0))));
  const summary = String((parsed as any).summary ?? "").trim();
  const strengths = Array.isArray((parsed as any).strengths)
    ? (parsed as any).strengths.map((item: any) => String(item).trim()).filter(Boolean)
    : [];
  const issues = Array.isArray((parsed as any).issues)
    ? (parsed as any).issues.map((item: any) => String(item).trim()).filter(Boolean)
    : [];
  const suggestions = Array.isArray((parsed as any).suggestions)
    ? (parsed as any).suggestions.map((item: any) => String(item).trim()).filter(Boolean)
    : [];
  const rubricRaw = Array.isArray((parsed as any).rubric) ? (parsed as any).rubric : [];
  const rubric = rubricRaw
    .map((item: any) => ({
      item: String(item.item ?? "").trim(),
      score: Math.max(0, Math.min(100, Math.round(Number(item.score ?? 0)))),
      comment: String(item.comment ?? "").trim()
    }))
    .filter((item: any) => item.item);

  const writing = (parsed as any).writing ?? null;
  const writingScores = writing?.scores ?? {};
  const writingBlock = writing
    ? {
        scores: {
          structure: Math.max(0, Math.min(100, Math.round(Number(writingScores.structure ?? 0)))),
          grammar: Math.max(0, Math.min(100, Math.round(Number(writingScores.grammar ?? 0)))),
          vocab: Math.max(0, Math.min(100, Math.round(Number(writingScores.vocab ?? 0))))
        },
        summary: String(writing.summary ?? "").trim() || "写作结构清晰，可继续优化用词与细节。",
        strengths: Array.isArray(writing.strengths)
          ? writing.strengths.map((item: any) => String(item).trim()).filter(Boolean).slice(0, 5)
          : [],
        improvements: Array.isArray(writing.improvements)
          ? writing.improvements.map((item: any) => String(item).trim()).filter(Boolean).slice(0, 5)
          : [],
        corrected: String(writing.corrected ?? "").trim() || undefined
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
  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") return null;

  const scores = (parsed as any).scores ?? {};
  const normalizeScore = (value: any) => {
    const num = Number(value);
    if (Number.isNaN(num)) return 0;
    return Math.max(0, Math.min(100, Math.round(num)));
  };

  const summary = String((parsed as any).summary ?? "").trim();
  const strengths = Array.isArray((parsed as any).strengths)
    ? (parsed as any).strengths.map((item: any) => String(item).trim()).filter(Boolean)
    : [];
  const improvements = Array.isArray((parsed as any).improvements)
    ? (parsed as any).improvements.map((item: any) => String(item).trim()).filter(Boolean)
    : [];
  const corrected = String((parsed as any).corrected ?? "").trim();

  return {
    scores: {
      structure: normalizeScore(scores.structure),
      grammar: normalizeScore(scores.grammar),
      vocab: normalizeScore(scores.vocab)
    },
    summary: summary || "已完成基础批改，请参考评分与建议进行修改。",
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
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

  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") {
    return { points: [], provider: llm.provider, quality: llm.quality } as KnowledgePointExtraction;
  }

  const pointsRaw = Array.isArray((parsed as any).points) ? (parsed as any).points : [];
  const points = Array.from(
    new Set(
      pointsRaw
        .map((item: any) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 10)
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
  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") return null;
  const objectives = Array.isArray((parsed as any).objectives) ? (parsed as any).objectives : [];
  const keyPoints = Array.isArray((parsed as any).keyPoints) ? (parsed as any).keyPoints : [];
  const slides = Array.isArray((parsed as any).slides) ? (parsed as any).slides : [];
  const blackboardSteps = Array.isArray((parsed as any).blackboardSteps) ? (parsed as any).blackboardSteps : [];

  const cleanSlides = slides
    .map((item: any) => ({
      title: String(item?.title ?? "").trim(),
      bullets: Array.isArray(item?.bullets) ? item.bullets.map((b: any) => String(b).trim()).filter(Boolean) : []
    }))
    .filter((item: any) => item.title);

  return {
    objectives: objectives.map((item: any) => String(item).trim()).filter(Boolean),
    keyPoints: keyPoints.map((item: any) => String(item).trim()).filter(Boolean),
    slides: cleanSlides,
    blackboardSteps: blackboardSteps.map((item: any) => String(item).trim()).filter(Boolean)
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
  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") return null;

  const agenda = Array.isArray((parsed as any).agenda) ? (parsed as any).agenda : [];
  const script = Array.isArray((parsed as any).script) ? (parsed as any).script : [];
  const reminders = Array.isArray((parsed as any).reminders) ? (parsed as any).reminders : [];

  return {
    agenda: agenda.map((item: any) => String(item).trim()).filter(Boolean),
    script: script.map((item: any) => String(item).trim()).filter(Boolean),
    reminders: reminders.map((item: any) => String(item).trim()).filter(Boolean)
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
  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") return null;
  const report = String((parsed as any).report ?? "").trim();
  const highlights = Array.isArray((parsed as any).highlights) ? (parsed as any).highlights : [];
  const reminders = Array.isArray((parsed as any).reminders) ? (parsed as any).reminders : [];

  if (!report) return null;
  return {
    report,
    highlights: highlights.map((item: any) => String(item).trim()).filter(Boolean),
    reminders: reminders.map((item: any) => String(item).trim()).filter(Boolean),
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
    return {
      answer: relatedQuestion.explanation,
      steps: ["看清题目条件", "列出关键关系", "逐步计算"],
      hints: ["先把题目中的已知量圈出来", "分步检查"],
      sources: [relatedQuestion.knowledgePointId],
      provider: "mock"
    };
  }

  const kpNames = relatedKps.map((kp) => kp.title);
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
