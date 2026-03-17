import { getCurrentUser } from "@/lib/auth";
import { getDiagnosticQuestions } from "@/lib/progress";
import { getStudentProfile } from "@/lib/profiles";
import { unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

function normalizeSubjectInput(value?: string) {
  return value?.trim().toLowerCase();
}

const diagnosticStartBodySchema = v.object<{ subject?: string; grade?: string }>(
  {
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const body = await parseJson(request, diagnosticStartBodySchema);
    const subject = normalizeSubjectInput(body.subject) ?? "math";
    const profile = await getStudentProfile(user.id);
    const grade = body.grade ?? profile?.grade ?? (user.grade ?? "4");

    const questions = await getDiagnosticQuestions(subject, grade, 10);

    return {
      subject,
      grade,
      questions: questions.map((q) => ({
        id: q.id,
        stem: q.stem,
        options: q.options,
        knowledgePointId: q.knowledgePointId
      }))
    };
  }
});
