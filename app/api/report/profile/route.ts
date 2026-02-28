import { getStudentContext } from "@/lib/user-context";
import { getStudentProfile } from "@/lib/profiles";
import { getKnowledgeProfile } from "@/lib/progress";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

const SUBJECT_LABEL: Record<string, string> = {
  math: "数学",
  chinese: "语文",
  english: "英语"
};

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const student = await getStudentContext();
    if (!student) {
      unauthorized();
    }

    const profile = await getStudentProfile(student.id);
    const subjects = profile?.subjects?.length ? profile.subjects : ["math"];
    const items = await getKnowledgeProfile(student.id, subjects);

    const grouped = subjects.map((subject) => {
      const list = items
        .filter((item) => item.kp.subject === subject)
        .map((item) => ({
          id: item.kp.id,
          title: item.kp.title,
          chapter: item.kp.chapter,
          unit: item.kp.unit ?? "未分单元",
          grade: item.kp.grade,
          correct: item.correct,
          total: item.total,
          ratio: Math.round(item.ratio * 100),
          lastAttemptAt: item.lastAttemptAt
        }))
        .sort((a, b) => a.title.localeCompare(b.title));

      const practiced = list.filter((item) => item.total > 0).length;
      const avgRatio = list.length
        ? Math.round(list.reduce((sum, item) => sum + item.ratio, 0) / list.length)
        : 0;

      return {
        subject,
        label: SUBJECT_LABEL[subject] ?? subject,
        practiced,
        total: list.length,
        avgRatio,
        items: list
      };
    });

    return {
      student: { id: student.id, name: student.name, grade: student.grade },
      subjects: grouped
    };
  }
});
