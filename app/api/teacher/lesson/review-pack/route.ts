import { getCurrentUser } from "@/lib/auth";
import { getClassById, getClassStudentIds } from "@/lib/classes";
import { getKnowledgePoints, getQuestions } from "@/lib/content";
import { generateWrongReviewScript } from "@/lib/ai";
import { getAttemptsByUsers } from "@/lib/progress";
import { notFound, unauthorized, withApi } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const bodySchema = v.object<{ classId: string; rangeDays?: number }>(
  {
    classId: v.string({ minLength: 1 }),
    rangeDays: v.optional(v.number({ coerce: true, integer: true, min: 1 }))
  },
  { allowUnknown: false }
);

function levelByRatio(ratio: number) {
  if (ratio >= 0.35) return "高频";
  if (ratio >= 0.2) return "中频";
  return "低频";
}

export const POST = withApi(async (request) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    unauthorized();
  }

  const body = await parseJson(request, bodySchema);
  const klass = await getClassById(body.classId);
  if (!klass || klass.teacherId !== user.id) {
    notFound("not found");
  }

  const rangeDays = Math.max(3, Math.min(Number(body.rangeDays) || 7, 60));
  const since = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  const studentIds = await getClassStudentIds(klass.id);
  const attempts = await getAttemptsByUsers(studentIds);
  const scopedAttempts = attempts.filter((item) => new Date(item.createdAt).getTime() >= since);
  const wrongAttempts = scopedAttempts.filter((item) => !item.correct);

  const [questions, kps] = await Promise.all([getQuestions(), getKnowledgePoints()]);
  const questionMap = new Map(questions.map((item) => [item.id, item]));
  const kpMap = new Map(kps.map((item) => [item.id, item]));

  const kpWrongCount = new Map<string, number>();
  const questionWrongCount = new Map<string, number>();
  wrongAttempts.forEach((item) => {
    kpWrongCount.set(item.knowledgePointId, (kpWrongCount.get(item.knowledgePointId) ?? 0) + 1);
    questionWrongCount.set(item.questionId, (questionWrongCount.get(item.questionId) ?? 0) + 1);
  });

  const totalWrong = wrongAttempts.length || 1;
  const wrongPoints = Array.from(kpWrongCount.entries())
    .map(([kpId, count]) => ({
      kpId,
      title: kpMap.get(kpId)?.title ?? "未知知识点",
      count,
      ratio: Math.round((count / totalWrong) * 100)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const reviewOrder = wrongPoints.map((item, index) => ({
    order: index + 1,
    knowledgePointId: item.kpId,
    title: item.title,
    wrongCount: item.count,
    wrongRatio: item.ratio,
    level: levelByRatio(item.count / totalWrong),
    teachFocus:
      index === 0
        ? "先讲典型误区，再做 1 题示范。"
        : index <= 2
          ? "讲关键条件识别，安排同类变式练习。"
          : "快速回顾，布置课后复练。"
  }));

  const exemplarQuestions = reviewOrder.map((item) => {
    const matched = Array.from(questionWrongCount.entries())
      .map(([questionId, count]) => ({ questionId, count, question: questionMap.get(questionId) }))
      .filter((entry) => entry.question?.knowledgePointId === item.knowledgePointId)
      .sort((a, b) => b.count - a.count)[0];
    return {
      knowledgePointId: item.knowledgePointId,
      title: item.title,
      questionId: matched?.questionId ?? null,
      stem: matched?.question?.stem ?? "请从班级错题本中挑选该知识点典型题。",
      wrongCount: matched?.count ?? 0
    };
  });

  const classTasks = reviewOrder.slice(0, 3).map((item, idx) => ({
    id: `task-${idx + 1}`,
    title: `${item.title} 课堂任务`,
    instruction: `完成 2 题同类题 + 1 题变式题，限时 ${10 + idx * 2} 分钟。`,
    target: "当堂完成并口头复述关键步骤"
  }));

  const afterClassReviewSheet = reviewOrder.slice(0, 4).map((item, idx) => ({
    id: `sheet-${idx + 1}`,
    title: `课后复练：${item.title}`,
    suggestedCount: idx === 0 ? 6 : 4,
    dueInDays: idx === 0 ? 1 : idx <= 2 ? 3 : 7
  }));

  const script =
    (await generateWrongReviewScript({
      subject: klass.subject,
      grade: klass.grade,
      className: klass.name,
      wrongPoints: wrongPoints.map((item) => item.title)
    })) ?? {
      agenda: ["先讲共性错因", "再做示范题", "当堂练习与纠偏", "布置课后复练"],
      script: [
        "先让学生说出易错步骤，再归纳共性错因。",
        "教师示范 1 题，强调“条件识别 -> 方法选择 -> 计算验证”。",
        "学生独立练习，教师巡回纠偏。",
        "课末布置 24h/72h 复练单并明确检查标准。"
      ],
      reminders: ["讲评顺序遵循错因频次", "避免一次讲太多知识点", "每段讲评后都要有即时练习"]
    };

  return {
    data: {
      classId: klass.id,
      className: klass.name,
      subject: klass.subject,
      grade: klass.grade,
      rangeDays,
      summary: {
        totalAttempts: scopedAttempts.length,
        totalWrong: wrongAttempts.length,
        topWrongKnowledgePoints: wrongPoints.length
      },
      reviewOrder,
      exemplarQuestions,
      classTasks,
      afterClassReviewSheet,
      script
    }
  };
});
