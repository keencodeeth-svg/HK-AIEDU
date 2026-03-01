import { getCurrentUser } from "@/lib/auth";
import { getClassById, getClassStudents } from "@/lib/classes";
import { ensureExamAssignmentsForPaper, getExamPaperById, getExamSubmissionsByPaper } from "@/lib/exams";
import { getExamEventsByPaper } from "@/lib/exam-events";
import { notFound, unauthorized } from "@/lib/api/http";
import { createExamRoute } from "@/lib/api/domains";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

export const GET = createExamRoute({
  cache: "private-short",
  handler: async ({ params }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const paperId = params.id;
    const paper = await getExamPaperById(paperId);
    if (!paper) {
      notFound("not found");
    }

    const klass = await getClassById(paper.classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("not found");
    }

    const students = await getClassStudents(paper.classId);
    const assignments = await ensureExamAssignmentsForPaper(paper.id);
    const submissions = await getExamSubmissionsByPaper(paper.id);
    const eventAggregates = await getExamEventsByPaper(paper.id);
    const studentMap = new Map(students.map((student) => [student.id, student]));
    const assignmentMap = new Map(assignments.map((item) => [item.studentId, item]));
    const submissionMap = new Map(submissions.map((item) => [item.studentId, item]));
    const eventMap = new Map(eventAggregates.map((item) => [item.studentId, item]));
    const targetStudentIds =
      paper.publishMode === "targeted"
        ? Array.from(
            new Set([...assignmentMap.keys(), ...submissionMap.keys(), ...eventMap.keys()]).values()
          )
        : students.map((student) => student.id);
    // Export includes anti-cheat counters for post-exam audit and follow-up interviews.

    const header = ["学生姓名", "邮箱", "状态", "得分", "总分", "得分率", "提交时间", "离屏次数", "切屏次数"];
    const rows = targetStudentIds
      .map((studentId) => studentMap.get(studentId))
      .filter((student): student is NonNullable<typeof student> => Boolean(student))
      .map((student) => {
        const assignment = assignmentMap.get(student.id);
        const submission = submissionMap.get(student.id);
        const event = eventMap.get(student.id);
        const status = assignment?.status ?? (submission ? "submitted" : "pending");
        const score = assignment?.score ?? submission?.score ?? "";
        const total = assignment?.total ?? submission?.total ?? "";
        const rate =
          typeof score === "number" && typeof total === "number" && total > 0
            ? `${Math.round((score / total) * 100)}%`
            : "";
        const submittedAt = assignment?.submittedAt ?? submission?.submittedAt ?? "";
        return [
          student.name,
          student.email,
          status,
          score,
          total,
          rate,
          submittedAt,
          event?.visibilityHiddenCount ?? 0,
          event?.blurCount ?? 0
        ];
      });

    const csv = [header, ...rows].map((row) => row.map((item) => csvCell(item)).join(",")).join("\n");
    const filename = `${paper.title.replace(/[\\/:*?"<>|]/g, "_") || paper.id}-scores.csv`;

    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      }
    });
  }
});
