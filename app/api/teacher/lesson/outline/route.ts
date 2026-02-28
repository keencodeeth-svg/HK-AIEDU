import { getCurrentUser } from "@/lib/auth";
import { getClassById } from "@/lib/classes";
import { getKnowledgePoints } from "@/lib/content";
import { generateLessonOutline } from "@/lib/ai";
import { assessAiQuality } from "@/lib/ai-quality-control";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const lessonOutlineBodySchema = v.object<{
  classId?: string;
  subject?: string;
  grade?: string;
  topic: string;
  knowledgePointIds?: string[];
}>(
  {
    classId: v.optional(v.string({ minLength: 1 })),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    topic: v.string({ minLength: 1 }),
    knowledgePointIds: v.optional(v.array(v.string({ minLength: 1 })))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const body = await parseJson(request, lessonOutlineBodySchema);

    let subject = body.subject ?? "math";
    let grade = body.grade ?? "4";
    let className = "";

    if (body.classId) {
      const klass = await getClassById(body.classId);
      if (!klass || klass.teacherId !== user.id) {
        notFound("not found");
      }
      subject = klass.subject;
      grade = klass.grade;
      className = klass.name;
    }

    const knowledgePoints = await getKnowledgePoints();
    const kpTitles = Array.isArray(body.knowledgePointIds)
      ? knowledgePoints
          .filter((kp) => body.knowledgePointIds?.includes(kp.id))
          .map((kp) => kp.title)
      : [];

    const outline =
      (await generateLessonOutline({
        subject,
        grade,
        topic: body.topic,
        knowledgePoints: kpTitles
      })) ?? {
        objectives: ["明确知识点含义", "掌握关键步骤", "能独立完成同类型题目"],
        keyPoints: kpTitles.length ? kpTitles : ["核心概念", "常见误区"],
        slides: [
          { title: "导入与目标", bullets: ["情境引入", "学习目标"] },
          { title: "概念讲解", bullets: ["定义与例子", "注意事项"] },
          { title: "例题示范", bullets: ["分步讲解", "易错点提示"] },
          { title: "课堂练习", bullets: ["巩固练习", "即时反馈"] }
        ],
        blackboardSteps: ["写出关键概念", "列出解题步骤", "标注易错点", "总结方法"]
      };

    const quality = assessAiQuality({
      kind: "assist",
      taskType: "lesson_outline",
      provider: "unknown",
      textBlocks: [
        body.topic,
        ...(outline.objectives ?? []),
        ...(outline.keyPoints ?? []),
        ...(outline.slides ?? []).flatMap((slide) => [slide.title, ...(slide.bullets ?? [])]),
        ...(outline.blackboardSteps ?? [])
      ],
      listCountHint: (outline.objectives?.length ?? 0) + (outline.slides?.length ?? 0)
    });

    return {
      data: {
        className,
        subject,
        grade,
        topic: body.topic,
        outline,
        quality,
        manualReviewRule: quality.needsHumanReview ? "建议教师抽检关键教学结论后再直接上课使用。" : ""
      }
    };
  }
});
