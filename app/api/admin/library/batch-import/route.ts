import {
  createKnowledgePoint,
  createQuestion,
  getKnowledgePoints,
  getQuestions
} from "@/lib/content";
import { requireRole } from "@/lib/guard";
import { createLearningLibraryItem } from "@/lib/learning-library";
import {
  attachQualityFields,
  evaluateAndUpsertQuestionQuality
} from "@/lib/question-quality";
import { addAdminLog } from "@/lib/admin-log";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import {
  isAllowedSubject,
  normalizeDifficulty,
  trimStringArray
} from "@/lib/api/schemas/admin";
import { createAdminRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

type TextbookInput = {
  title?: string;
  description?: string;
  contentType?: string;
  subject?: string;
  grade?: string;
  sourceType?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
  linkUrl?: string;
  textContent?: string;
  knowledgePointIds?: string[];
  accessScope?: string;
  classId?: string;
};

type QuestionInput = {
  subject?: string;
  grade?: string;
  knowledgePointId?: string;
  knowledgePointTitle?: string;
  chapter?: string;
  unit?: string;
  stem?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  difficulty?: string;
  questionType?: string;
  tags?: string[];
  abilities?: string[];
};

type BatchImportOptions = {
  autoCreateKnowledgePoint?: boolean;
  skipExistingQuestionStem?: boolean;
};

const textbookSchema = v.object<TextbookInput>(
  {
    title: v.optional(v.string({ allowEmpty: true, trim: false })),
    description: v.optional(v.string({ allowEmpty: true, trim: false })),
    contentType: v.optional(v.string({ allowEmpty: true, trim: false })),
    subject: v.optional(v.string({ allowEmpty: true, trim: false })),
    grade: v.optional(v.string({ allowEmpty: true, trim: false })),
    sourceType: v.optional(v.string({ allowEmpty: true, trim: false })),
    fileName: v.optional(v.string({ allowEmpty: true, trim: false })),
    mimeType: v.optional(v.string({ allowEmpty: true, trim: false })),
    size: v.optional(v.number({ integer: true, min: 0, coerce: true })),
    contentBase64: v.optional(v.string({ allowEmpty: true, trim: false })),
    linkUrl: v.optional(v.string({ allowEmpty: true, trim: false })),
    textContent: v.optional(v.string({ allowEmpty: true, trim: false })),
    knowledgePointIds: v.optional(v.array(v.string({ minLength: 1 }))),
    accessScope: v.optional(v.string({ allowEmpty: true, trim: false })),
    classId: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

const questionSchema = v.object<QuestionInput>(
  {
    subject: v.optional(v.string({ allowEmpty: true, trim: false })),
    grade: v.optional(v.string({ allowEmpty: true, trim: false })),
    knowledgePointId: v.optional(v.string({ allowEmpty: true, trim: false })),
    knowledgePointTitle: v.optional(v.string({ allowEmpty: true, trim: false })),
    chapter: v.optional(v.string({ allowEmpty: true, trim: false })),
    unit: v.optional(v.string({ allowEmpty: true, trim: false })),
    stem: v.optional(v.string({ allowEmpty: true, trim: false })),
    options: v.optional(v.array(v.string({ allowEmpty: true, trim: false }))),
    answer: v.optional(v.string({ allowEmpty: true, trim: false })),
    explanation: v.optional(v.string({ allowEmpty: true, trim: false })),
    difficulty: v.optional(v.string({ allowEmpty: true, trim: false })),
    questionType: v.optional(v.string({ allowEmpty: true, trim: false })),
    tags: v.optional(v.array(v.string({ allowEmpty: true, trim: false }))),
    abilities: v.optional(v.array(v.string({ allowEmpty: true, trim: false })))
  },
  { allowUnknown: false }
);

const bodySchema = v.object<{
  options?: BatchImportOptions;
  textbooks?: TextbookInput[];
  questions?: QuestionInput[];
}>(
  {
    options: v.optional(
      v.object<BatchImportOptions>(
        {
          autoCreateKnowledgePoint: v.optional(v.boolean()),
          skipExistingQuestionStem: v.optional(v.boolean())
        },
        { allowUnknown: false }
      )
    ),
    textbooks: v.optional(v.array(textbookSchema)),
    questions: v.optional(v.array(questionSchema))
  },
  { allowUnknown: false }
);

function normalizeStem(text: string) {
  // Use punctuation/whitespace-insensitive fingerprinting to reduce near-duplicate imports.
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？,.!?;:；：、]/g, "");
}

function normalizeSourceType(value?: string) {
  if (value === "file" || value === "link" || value === "text") {
    return value;
  }
  return "text";
}

function normalizeContentType(value?: string) {
  if (value === "courseware" || value === "lesson_plan" || value === "textbook") {
    return value;
  }
  return "textbook";
}

function normalizeAccessScope(value?: string) {
  return value === "class" ? "class" : "global";
}

function makeKpKey(input: {
  subject: string;
  grade: string;
  title: string;
  chapter?: string;
}) {
  return [
    input.subject.trim().toLowerCase(),
    input.grade.trim(),
    (input.chapter ?? "").trim().toLowerCase(),
    input.title.trim().toLowerCase()
  ].join("|");
}

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    assertAdminStepUp(user);

    const body = await parseJson(request, bodySchema);
    const textbooks = body.textbooks ?? [];
    const questions = body.questions ?? [];
    if (!textbooks.length && !questions.length) {
      badRequest("textbooks or questions required");
    }

    const autoCreateKnowledgePoint = body.options?.autoCreateKnowledgePoint !== false;
    const skipExistingQuestionStem = body.options?.skipExistingQuestionStem !== false;

    const existingQuestions = await getQuestions();
    const qualityCandidates = [...existingQuestions];
    const seenStemKeys = new Set(
      existingQuestions.map((item) => `${item.subject}|${item.grade}|${normalizeStem(item.stem)}`)
    );

  const kpList = await getKnowledgePoints();
  const kpById = new Map(kpList.map((kp) => [kp.id, kp]));
  const kpByStrictKey = new Map<string, { id: string; title: string }>();
  const kpByLooseKey = new Map<string, { id: string; title: string }>();
  kpList.forEach((kp) => {
    kpByStrictKey.set(
      makeKpKey({
        subject: kp.subject,
        grade: kp.grade,
        chapter: kp.chapter,
        title: kp.title
      }),
      { id: kp.id, title: kp.title }
    );
    kpByLooseKey.set(
      makeKpKey({
        subject: kp.subject,
        grade: kp.grade,
        title: kp.title
      }),
      { id: kp.id, title: kp.title }
    );
  });

  const textbookCreated: Array<{ index: number; id: string; title: string }> = [];
  const textbookFailed: Array<{ index: number; reason: string }> = [];

  for (const [index, item] of textbooks.entries()) {
    const title = item.title?.trim();
    const subject = item.subject?.trim();
    const grade = item.grade?.trim();
    if (!title || !subject || !grade) {
      textbookFailed.push({ index, reason: "missing fields" });
      continue;
    }
    if (!isAllowedSubject(subject)) {
      textbookFailed.push({ index, reason: "invalid subject" });
      continue;
    }

    const contentType = normalizeContentType(item.contentType?.trim());
    const sourceType = normalizeSourceType(item.sourceType?.trim());
    // Textbooks are constrained to file uploads so reader/download/share features stay consistent.
    if (contentType === "textbook" && sourceType !== "file") {
      textbookFailed.push({ index, reason: "textbook requires file source" });
      continue;
    }
    if (sourceType === "file" && !item.contentBase64?.trim()) {
      textbookFailed.push({ index, reason: "missing file content" });
      continue;
    }
    if (sourceType === "link" && !item.linkUrl?.trim()) {
      textbookFailed.push({ index, reason: "missing link" });
      continue;
    }
    if (sourceType === "text" && !item.textContent?.trim()) {
      textbookFailed.push({ index, reason: "missing text content" });
      continue;
    }

    const created = await createLearningLibraryItem({
      title,
      description: item.description?.trim() || undefined,
      contentType,
      subject,
      grade,
      ownerRole: "admin",
      ownerId: user.id,
      accessScope: normalizeAccessScope(item.accessScope?.trim()),
      classId: item.classId?.trim() || undefined,
      sourceType,
      fileName: item.fileName?.trim() || undefined,
      mimeType: item.mimeType?.trim() || undefined,
      size: item.size,
      contentBase64: item.contentBase64?.trim() || undefined,
      linkUrl: item.linkUrl?.trim() || undefined,
      textContent: item.textContent ?? undefined,
      knowledgePointIds: trimStringArray(item.knowledgePointIds),
      generatedByAi: false,
      status: "published"
    });

    textbookCreated.push({
      index,
      id: created.id,
      title: created.title
    });
  }

  const questionCreated: Array<{
    index: number;
    id: string;
    qualityScore: number | null;
    riskLevel: string | null;
  }> = [];
  const questionFailed: Array<{ index: number; reason: string }> = [];
  let knowledgePointsCreated = 0;

  for (const [index, item] of questions.entries()) {
    const subject = item.subject?.trim();
    const grade = item.grade?.trim();
    const stem = item.stem?.trim();
    const answer = item.answer?.trim();
    const options = trimStringArray(item.options);
    const explanation = item.explanation?.trim() ?? "";
    const questionType = item.questionType?.trim() || "choice";

    if (!subject || !grade || !stem || !answer || !options.length) {
      questionFailed.push({ index, reason: "missing fields" });
      continue;
    }
    if (!isAllowedSubject(subject)) {
      questionFailed.push({ index, reason: "invalid subject" });
      continue;
    }

    const stemKey = `${subject}|${grade}|${normalizeStem(stem)}`;
    // Optional guard: skip same-subject/grade stem duplicates in a single batch to avoid noisy imports.
    if (skipExistingQuestionStem && seenStemKeys.has(stemKey)) {
      questionFailed.push({ index, reason: "duplicate stem skipped" });
      continue;
    }

    let knowledgePointId = item.knowledgePointId?.trim() || "";
    const knowledgePointTitle = item.knowledgePointTitle?.trim();
    const chapter = item.chapter?.trim() || "未分章节";
    const unit = item.unit?.trim() || "未分单元";

    if (knowledgePointId) {
      const kp = kpById.get(knowledgePointId);
      if (!kp || kp.subject !== subject || kp.grade !== grade) {
        questionFailed.push({ index, reason: "knowledge point id mismatch" });
        continue;
      }
    } else if (knowledgePointTitle) {
      const strictKey = makeKpKey({
        subject,
        grade,
        chapter,
        title: knowledgePointTitle
      });
      const looseKey = makeKpKey({
        subject,
        grade,
        title: knowledgePointTitle
      });
      knowledgePointId =
        kpByStrictKey.get(strictKey)?.id ??
        kpByLooseKey.get(looseKey)?.id ??
        "";

      if (!knowledgePointId && autoCreateKnowledgePoint) {
        const kp = await createKnowledgePoint({
          subject,
          grade,
          title: knowledgePointTitle,
          chapter,
          unit
        });
        if (kp?.id) {
          knowledgePointId = kp.id;
          kpById.set(kp.id, kp);
          kpByStrictKey.set(
            makeKpKey({
              subject,
              grade,
              chapter: kp.chapter,
              title: kp.title
            }),
            { id: kp.id, title: kp.title }
          );
          kpByLooseKey.set(
            makeKpKey({
              subject,
              grade,
              title: kp.title
            }),
            { id: kp.id, title: kp.title }
          );
          knowledgePointsCreated += 1;
        }
      }
    }

    if (!knowledgePointId) {
      questionFailed.push({ index, reason: "knowledge point missing" });
      continue;
    }

    const difficulty = normalizeDifficulty(item.difficulty);
    const next = await createQuestion({
      subject,
      grade,
      knowledgePointId,
      stem,
      options,
      answer,
      explanation,
      difficulty,
      questionType,
      tags: trimStringArray(item.tags),
      abilities: trimStringArray(item.abilities)
    });
    if (!next?.id) {
      questionFailed.push({ index, reason: "create question failed" });
      continue;
    }

    const quality = await evaluateAndUpsertQuestionQuality({
      question: next,
      candidates: qualityCandidates
    });
    qualityCandidates.push(next);
    seenStemKeys.add(stemKey);

    const withQuality = attachQualityFields(next, quality);
    questionCreated.push({
      index,
      id: withQuality.id,
      qualityScore: withQuality.qualityScore ?? null,
      riskLevel: withQuality.riskLevel ?? null
    });
  }

  await addAdminLog({
    adminId: user.id,
    action: "batch_import_curriculum",
    entityType: "library",
    entityId: null,
    detail: `textbooks=${textbookCreated.length}/${textbooks.length}, questions=${questionCreated.length}/${questions.length}, kpCreated=${knowledgePointsCreated}`
  });

    return {
      data: {
        summary: {
          textbooksTotal: textbooks.length,
          textbooksImported: textbookCreated.length,
          textbooksFailed: textbookFailed.length,
          questionsTotal: questions.length,
          questionsImported: questionCreated.length,
          questionsFailed: questionFailed.length,
          knowledgePointsCreated
        },
        textbooks: {
          created: textbookCreated,
          failed: textbookFailed
        },
        questions: {
          created: questionCreated,
          failed: questionFailed
        }
      }
    };
  }
});
