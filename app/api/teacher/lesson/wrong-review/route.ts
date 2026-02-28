import { getCurrentUser } from "@/lib/auth";
import { getClassById, getClassStudentIds } from "@/lib/classes";
import { getKnowledgePoints } from "@/lib/content";
import { getAttemptsByUsers } from "@/lib/progress";
import { generateWrongReviewScript } from "@/lib/ai";
import { assessAiQuality } from "@/lib/ai-quality-control";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const wrongReviewBodySchema = v.object<{ classId: string; rangeDays?: number }>(
  {
    classId: v.string({ minLength: 1 }),
    rangeDays: v.optional(v.number({ coerce: true, integer: true, min: 1 }))
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

    const body = await parseJson(request, wrongReviewBodySchema);

    const klass = await getClassById(body.classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("not found");
    }

    const rangeDays = Math.max(3, Math.min(Number(body.rangeDays) || 7, 60));
    const since = Date.now() - rangeDays * 24 * 60 * 60 * 1000;

    const studentIds = await getClassStudentIds(klass.id);
    const attempts = await getAttemptsByUsers(studentIds);
    const wrongAttempts = attempts.filter(
      (item) => !item.correct && new Date(item.createdAt).getTime() >= since
    );

    const kpMap = new Map((await getKnowledgePoints()).map((kp) => [kp.id, kp]));
    const counts = new Map<string, number>();
    wrongAttempts.forEach((item) => {
      counts.set(item.knowledgePointId, (counts.get(item.knowledgePointId) ?? 0) + 1);
    });

    const ranked = Array.from(counts.entries())
      .map(([kpId, count]) => ({
        kpId,
        count,
        title: kpMap.get(kpId)?.title ?? "未知知识点"
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const wrongPoints = ranked.map((item) => item.title);
    const script =
      (await generateWrongReviewScript({
        subject: klass.subject,
        grade: klass.grade,
        className: klass.name,
        wrongPoints
      })) ?? {
        agenda: ["回顾高频错题知识点", "示范典型题解法", "学生练习与纠错"],
        script: [
          `今天我们聚焦 ${wrongPoints.join("、") || "近期错题"}，先回顾概念与常见误区。`,
          "选取 1-2 道典型错题示范解法，强调步骤与关键条件。",
          "安排学生现场练习，教师即时纠正并总结方法。"
        ],
        reminders: ["强调审题与条件匹配", "提醒步骤书写规范", "布置对应巩固练习"]
      };
    const quality = assessAiQuality({
      kind: "assist",
      taskType: "wrong_review_script",
      provider: "unknown",
      textBlocks: [
        ...wrongPoints,
        ...(script.agenda ?? []),
        ...(script.script ?? []),
        ...(script.reminders ?? [])
      ],
      listCountHint: (script.agenda?.length ?? 0) + (script.script?.length ?? 0)
    });

    return {
      data: {
        className: klass.name,
        subject: klass.subject,
        grade: klass.grade,
        rangeDays,
        wrongPoints: ranked,
        script,
        quality,
        manualReviewRule: quality.needsHumanReview ? "建议教师先人工核对错因归纳与话术后再课堂使用。" : ""
      }
    };
  }
});
