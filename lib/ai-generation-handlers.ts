import { callRoutedLLM } from "./ai-router";
import { GENERATE_PROMPT } from "./ai-prompts";
import {
  asJsonObject,
  getJsonObjectArrayField,
  getStringArrayField,
  getStringField
} from "./ai-json";
import { extractJson, normalizeQuestionDraft, normalizeTitle } from "./ai-utils";
import type {
  GenerateKnowledgePointsPayload,
  GenerateKnowledgeTreePayload,
  GenerateQuestionPayload,
  KnowledgePointDraft,
  KnowledgeTreeDraft,
  QuestionCheck,
  QuestionDraft,
  WrongExplanation
} from "./ai-types";

export async function generateQuestionDraft(payload: GenerateQuestionPayload) {
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    `知识点：${payload.knowledgePointTitle}`,
    payload.chapter ? `章节：${payload.chapter}` : "",
    payload.difficulty ? `难度：${payload.difficulty}` : "",
    payload.questionType ? `题型：${payload.questionType}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n请生成 1 道四选一选择题，字段为: stem, options, answer, explanation。\n要求: options 为 4 个简短选项，answer 必须完全等于其中一个选项文本，不要包含 A/B/C/D 前缀。`;
  const llm = await callRoutedLLM({
    taskType: "question_generate",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  // Normalize/validate model output before persistence to avoid malformed题目进入题库.
  return normalizeQuestionDraft(parsed);
}

export async function generateWrongExplanation(payload: {
  subject: string;
  grade: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  explanation?: string;
  knowledgePointTitle?: string;
}): Promise<WrongExplanation | null> {
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    payload.knowledgePointTitle ? `知识点：${payload.knowledgePointTitle}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n题目：${payload.question}\n学生答案：${payload.studentAnswer}\n正确答案：${payload.correctAnswer}\n已有解析：${payload.explanation ?? ""}\n请指出学生可能的错误原因，并用简洁语言给出纠正讲解与 2-3 条提示。返回 JSON：{\"analysis\":\"...\",\"hints\":[\"...\",\"...\"]}。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "explanation",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = asJsonObject(extractJson(llm.text));
  if (!parsed) return null;
  const analysis = getStringField(parsed, "analysis");
  const hints = getStringArrayField(parsed, "hints", 3);
  if (!analysis) return null;
  return { analysis, hints };
}

export async function generateVariantDrafts(payload: {
  subject: string;
  grade: string;
  knowledgePointTitle: string;
  chapter?: string;
  seedQuestion: string;
  count?: number;
  difficulty?: "easy" | "medium" | "hard";
}): Promise<QuestionDraft[] | null> {
  // Keep count bounded to control latency/cost and improve structured JSON stability.
  const count = Math.min(Math.max(Number(payload.count) || 2, 1), 4);
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    `知识点：${payload.knowledgePointTitle}`,
    payload.chapter ? `章节：${payload.chapter}` : "",
    payload.difficulty ? `难度：${payload.difficulty}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n参考题目：${payload.seedQuestion}\n请生成 ${count} 道同类型变式选择题，返回 JSON：{\"items\":[{\"stem\":\"...\",\"options\":[\"...\"],\"answer\":\"...\",\"explanation\":\"...\"}]}。要求选项为 4 个，答案必须等于某个选项文本，不要附加 A/B/C/D。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "variant_generate",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  if (!parsed) return null;
  const parsedObject = asJsonObject(parsed);
  const rawItems = parsedObject ? (Array.isArray(parsedObject.items) ? parsedObject.items : []) : [];
  const itemCandidates = rawItems.length ? rawItems : Array.isArray(parsed) ? parsed : [];
  const normalizedCandidates = itemCandidates.map((item) => asJsonObject(item)).filter((item) => Boolean(item));
  if (!normalizedCandidates.length) return null;

  const drafts: QuestionDraft[] = [];
  normalizedCandidates.forEach((item) => {
    const draft = normalizeQuestionDraft(item);
    if (draft) drafts.push(draft);
  });

  return drafts.length ? drafts.slice(0, count) : null;
}

export async function generateQuestionCheck(payload: {
  stem: string;
  options: string[];
  answer: string;
  explanation?: string;
  subject?: string;
  grade?: string;
}): Promise<QuestionCheck | null> {
  const context = [
    payload.subject ? `学科：${payload.subject}` : "",
    payload.grade ? `年级：${payload.grade}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n题目：${payload.stem}\n选项：${payload.options.join(" | ")}\n答案：${payload.answer}\n解析：${payload.explanation ?? ""}\n请检查是否存在题目歧义、答案错误或选项重复。输出 JSON：{\"issues\":[\"...\"],\"risk\":\"low|medium|high\",\"suggestedAnswer\":\"...\",\"notes\":\"...\"}。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "question_check",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = asJsonObject(extractJson(llm.text));
  if (!parsed) return null;

  const issues = getStringArrayField(parsed, "issues", 20);
  const riskRaw = getStringField(parsed, "risk").toLowerCase();
  const risk = ["low", "medium", "high"].includes(riskRaw) ? (riskRaw as "low" | "medium" | "high") : "low";
  const suggestedAnswer = getStringField(parsed, "suggestedAnswer");
  const notes = getStringField(parsed, "notes");

  return {
    issues,
    risk,
    suggestedAnswer: suggestedAnswer || undefined,
    notes: notes || undefined
  };
}

export async function generateKnowledgePointsDraft(payload: GenerateKnowledgePointsPayload) {
  // Keep count bounded to control latency/cost and improve structured JSON stability.
  const count = Math.min(Math.max(Number(payload.count) || 5, 1), 10);
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    payload.chapter ? `章节：${payload.chapter}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n请生成 ${count} 个知识点名称，返回 JSON。格式: {\"items\":[{\"title\":\"...\",\"chapter\":\"...\"}]}。\n要求: title 简洁准确，chapter 如果已提供则使用，否则给出合理章节名。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "knowledge_points_generate",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  if (!parsed) return null;

  const parsedObject = asJsonObject(parsed);
  const rawItems = Array.isArray(parsed)
    ? parsed
    : parsedObject && Array.isArray(parsedObject.items)
      ? parsedObject.items
      : [];
  const normalizedItems = rawItems.map((item) => asJsonObject(item)).filter((item): item is Record<string, unknown> => Boolean(item));
  if (!normalizedItems.length) return null;

  const seen = new Set<string>();
  const items: KnowledgePointDraft[] = [];

  for (const item of normalizedItems) {
    const title = normalizeTitle(getStringField(item, "title")).trim();
    const chapter = getStringField(item, "chapter") || payload.chapter || "未归类";
    if (!title) continue;
    const key = `${title}|${chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title, chapter });
    if (items.length >= count) break;
  }

  return items.length ? items : null;
}

export async function generateKnowledgeTreeDraft(payload: GenerateKnowledgeTreePayload) {
  // Bounds reduce hallucinated tree depth and keep output parseable for bulk import.
  const unitCount = Math.min(Math.max(Number(payload.unitCount) || 6, 1), 12);
  const chaptersPerUnit = Math.min(Math.max(Number(payload.chaptersPerUnit) || 2, 1), 4);
  const pointsPerChapter = Math.min(Math.max(Number(payload.pointsPerChapter) || 4, 2), 8);
  const edition = payload.edition ?? "人教版";
  const volume = payload.volume ?? "上册";

  const context = [`学科：${payload.subject}`, `年级：${payload.grade}`, `教材版本：${edition}`, `册次：${volume}`].join(
    "\n"
  );

  const userPrompt = `${context}\n请输出整本书的知识点树，按“单元->章节->知识点”分层，返回 JSON：{\"units\":[{\"title\":\"第一单元\",\"chapters\":[{\"title\":\"...\",\"points\":[{\"title\":\"...\"}]}]}]}。\n单元数量约 ${unitCount} 个，每单元 ${chaptersPerUnit} 章，每章 ${pointsPerChapter} 个知识点。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "knowledge_tree_generate",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  if (!parsed) return null;

  const parsedObject = asJsonObject(parsed);
  const rawUnits = parsedObject ? getJsonObjectArrayField(parsedObject, "units") : [];
  const normalizedUnits = rawUnits.length
    ? rawUnits
    : Array.isArray(parsed)
      ? parsed.map((item) => asJsonObject(item)).filter((item): item is Record<string, unknown> => Boolean(item))
      : [];
  if (!normalizedUnits.length) return null;

  const units: KnowledgeTreeDraft["units"] = [];

  for (const rawUnit of normalizedUnits) {
    const unitTitle = normalizeTitle(getStringField(rawUnit, "title")).trim();
    if (!unitTitle) continue;
    const rawChapters = getJsonObjectArrayField(rawUnit, "chapters");
    const chapters: KnowledgeTreeDraft["units"][number]["chapters"] = [];

    for (const rawChapter of rawChapters) {
      const chapterTitle = normalizeTitle(getStringField(rawChapter, "title")).trim();
      if (!chapterTitle) continue;
      const points = getJsonObjectArrayField(rawChapter, "points")
        .map((point) => ({ title: normalizeTitle(getStringField(point, "title")).trim() }))
        .filter((point) => point.title);

      if (!points.length) continue;
      const trimmedPoints = points.slice(0, pointsPerChapter);
      chapters.push({ title: chapterTitle, points: trimmedPoints });
      if (chapters.length >= chaptersPerUnit) break;
    }

    if (!chapters.length) continue;
    units.push({ title: unitTitle, chapters });
    if (units.length >= unitCount) break;
  }

  return units.length ? { units } : null;
}
