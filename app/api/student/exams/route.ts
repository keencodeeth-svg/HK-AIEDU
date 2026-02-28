import { getClassesByStudent } from "@/lib/classes";
import { ensureExamAssignment, getExamAssignment, getExamPapersByClassIds } from "@/lib/exams";
import { resolveExamAvailability } from "@/lib/exam-availability";
import { unauthorized } from "@/lib/api/http";
import { createExamRoute } from "@/lib/api/domains";

export const GET = createExamRoute({
  role: "student",
  cache: "private-realtime",
  handler: async ({ user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const classes = await getClassesByStudent(user.id);
    const classMap = new Map(classes.map((item) => [item.id, item]));
    const papers = await getExamPapersByClassIds(classes.map((item) => item.id));
    const serverNow = new Date().toISOString();
    const serverNowMs = new Date(serverNow).getTime();

    const data = await Promise.all(
      papers.map(async (paper) => {
        const assignment =
          paper.publishMode === "targeted"
            ? await getExamAssignment(paper.id, user.id)
            : await ensureExamAssignment(paper.id, user.id);
        if (!assignment) return null;
        const klass = classMap.get(paper.classId);
        const availability = resolveExamAvailability(
          {
            status: paper.status,
            startAt: paper.startAt,
            endAt: paper.endAt
          },
          serverNowMs
        );
        return {
          ...paper,
          examStatus: paper.status,
          className: klass?.name ?? "-",
          classSubject: klass?.subject ?? "-",
          classGrade: klass?.grade ?? "-",
          status: assignment.status,
          score: assignment.score ?? null,
          total: assignment.total ?? null,
          startedAt: assignment.startedAt ?? null,
          submittedAt: assignment.submittedAt ?? null,
          availabilityStage: availability.stage,
          canEnter: availability.canEnter,
          canSubmit: availability.canSubmit,
          lockReason: availability.lockReason,
          startsInMs: availability.startsInMs,
          endsInMs: availability.endsInMs,
          serverNow
        };
      })
    );

    return { data: data.filter((item): item is NonNullable<typeof item> => Boolean(item)) };
  }
});
