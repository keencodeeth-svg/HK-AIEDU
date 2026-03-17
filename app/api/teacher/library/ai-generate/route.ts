import { generateLessonOutline } from "@/lib/ai";
import { getClassById } from "@/lib/classes";
import { getKnowledgePoints } from "@/lib/content";
import { createLearningLibraryItem, listLearningLibraryItems, type LearningLibraryItem } from "@/lib/learning-library";
import { canAccessLearningLibraryItem } from "@/lib/library-access";
import { retrieveLibraryCitations, summarizeCitationGovernance, toCitationPrompts } from "@/lib/library-rag";
import { assessAiQuality } from "@/lib/ai-quality-control";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const bodySchema = v.object<{
  classId?: string;
  topic?: string;
  contentType?: string;
  knowledgePointIds?: string[];
}>(
  {
    classId: v.optional(v.string({ minLength: 1 })),
    topic: v.optional(v.string({ minLength: 1 })),
    contentType: v.optional(v.string({ minLength: 1 })),
    knowledgePointIds: v.optional(v.array(v.string({ minLength: 1 })))
  },
  { allowUnknown: false }
);

function formatOutlineToMarkdown(input: {
  topic: string;
  type: "courseware" | "lesson_plan";
  className: string;
  subject: string;
  grade: string;
  objectives: string[];
  keyPoints: string[];
  slides: Array<{ title: string; bullets: string[] }>;
  blackboardSteps: string[];
  citations?: Array<{ itemTitle: string; snippet: string }>;
}) {
  const header = `# ${input.topic}\n\n- 班级：${input.className}\n- 学科：${input.subject}\n- 年级：${input.grade}\n- 类型：${
    input.type === "courseware" ? "课件" : "教案"
  }\n`;
  const goals = `\n## 教学目标\n${input.objectives.map((item) => `- ${item}`).join("\n")}`;
  const keyPoints = `\n## 重点知识点\n${input.keyPoints.map((item) => `- ${item}`).join("\n")}`;
  const slideBlocks = `\n## ${input.type === "courseware" ? "课件结构" : "教学流程"}\n${input.slides
    .map(
      (slide, index) =>
        `### ${index + 1}. ${slide.title}\n${slide.bullets.map((item) => `- ${item}`).join("\n")}`
    )
    .join("\n\n")}`;
  const board = `\n## 板书/讲解顺序\n${input.blackboardSteps.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
  const citations = input.citations?.length
    ? `\n## 教材依据（AI 检索）\n${input.citations
        .map((item, index) => `${index + 1}. 《${item.itemTitle}》：${item.snippet}`)
        .join("\n")}`
    : "";
  return `${header}${goals}${keyPoints}${slideBlocks}${board}${citations}\n`;
}

export const POST = createLearningRoute({
  role: "teacher",
  body: bodySchema,
  cache: "private-realtime",
  handler: async ({ body, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const classId = body.classId?.trim();
    const topic = body.topic?.trim();
    const contentTypeInput = body.contentType?.trim().toLowerCase();
    const contentType =
      contentTypeInput === "lesson_plan" || contentTypeInput === "courseware"
        ? contentTypeInput
        : "lesson_plan";

    if (!classId || !topic) {
      badRequest("missing fields");
    }

    const klass = await getClassById(classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("not found");
    }

    const allKps = await getKnowledgePoints();
    const kpTitles = (body.knowledgePointIds ?? [])
      .map((id) => allKps.find((item) => item.id === id))
      .filter(Boolean)
      .map((item) => (item ? item.title : ""))
      .filter(Boolean);
    const libraryItems = await listLearningLibraryItems({
      subject: klass.subject,
      grade: klass.grade
    });
    const accessibleItems = (
      await Promise.all(
        libraryItems.map(async (item) => {
          const allowed = await canAccessLearningLibraryItem(user, item);
          if (!allowed) return null;
          if (item.status !== "published" && item.ownerId !== user.id) {
            return null;
          }
          return item;
        })
      )
    ).filter((item): item is LearningLibraryItem => Boolean(item));
    // RAG grounding is restricted to teacher-accessible resources for this class scope.
    const citations = await retrieveLibraryCitations({
      query: `${topic}\n${kpTitles.join("、")}`,
      subject: klass.subject,
      grade: klass.grade,
      limit: 4,
      itemIds: accessibleItems.map((item) => item.id)
    });
    const citationGovernance = summarizeCitationGovernance(citations);
    // Prefer high/medium-trust citations in prompt; still return all citations for transparency.
    const trustedCitations = citations.filter((item) => item.trustLevel !== "low");

    const outline =
      (await generateLessonOutline({
        subject: klass.subject,
        grade: klass.grade,
        topic,
        knowledgePoints: kpTitles,
        citations: toCitationPrompts(trustedCitations.length ? trustedCitations : citations)
      })) ?? {
        objectives: ["掌握核心概念", "会用标准步骤解题", "完成课堂巩固任务"],
        keyPoints: kpTitles.length ? kpTitles : ["关键概念", "易错点"],
        slides: [
          { title: "导入", bullets: ["复习旧知", "引出新课"] },
          { title: "新知讲解", bullets: ["核心定义", "典型例题"] },
          { title: "课堂练习", bullets: ["分层任务", "即时反馈"] },
          { title: "总结与作业", bullets: ["方法归纳", "课后任务"] }
        ],
        blackboardSteps: ["概念定义", "方法步骤", "例题拆解", "错因提醒"]
      };

    const textContent = formatOutlineToMarkdown({
      topic,
      type: contentType,
      className: klass.name,
      subject: klass.subject,
      grade: klass.grade,
      objectives: outline.objectives ?? [],
      keyPoints: outline.keyPoints ?? [],
      slides: outline.slides ?? [],
      blackboardSteps: outline.blackboardSteps ?? [],
      citations: citations.map((item) => ({
        itemTitle: item.itemTitle,
        snippet: item.snippet
      }))
    });

    const item = await createLearningLibraryItem({
      title: `${topic} - ${contentType === "courseware" ? "课件" : "教案"}`,
      description: `AI 生成，班级 ${klass.name}`,
      contentType,
      subject: klass.subject,
      grade: klass.grade,
      ownerRole: "teacher",
      ownerId: user.id,
      classId: klass.id,
      accessScope: "class",
      sourceType: "text",
      textContent,
      knowledgePointIds: body.knowledgePointIds ?? [],
      generatedByAi: true,
      status: "published"
    });
    const quality = assessAiQuality({
      kind: "assist",
      taskType: "lesson_outline",
      provider: "unknown",
      textBlocks: [
        topic,
        ...(outline.objectives ?? []),
        ...(outline.keyPoints ?? []),
        ...(outline.slides ?? []).flatMap((slide) => [slide.title, ...(slide.bullets ?? [])]),
        ...(outline.blackboardSteps ?? []),
        ...citations.map((citation) => citation.snippet)
      ],
      listCountHint: (outline.slides?.length ?? 0) + citations.length
    });
    const manualReviewHints: string[] = [];
    if (quality.needsHumanReview) {
      manualReviewHints.push("内容质量分触发人工复核阈值");
    }
    if (citationGovernance.needsManualReview) {
      manualReviewHints.push(`引用可信度风险（${citationGovernance.manualReviewReason}）`);
    }

    return {
      data: {
        item,
        outline,
        citations,
        citationGovernance,
        quality,
        manualReviewRule: manualReviewHints.length
          ? `建议教师先人工复核后下发：${manualReviewHints.join("；")}。`
          : ""
      }
    };
  }
});
