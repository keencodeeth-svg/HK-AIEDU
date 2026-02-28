import { getClassStudentIds } from "@/lib/classes";
import { getAssignmentUploads } from "@/lib/assignment-uploads";
import { notFound } from "@/lib/api/http";
import { requireTeacherAssignment } from "@/lib/guard";
import { parseSearchParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const assignmentUploadsQuerySchema = v.object<{ studentId: string }>(
  {
    studentId: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const GET = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const query = parseSearchParams(request, assignmentUploadsQuerySchema);
    const studentId = query.studentId;

    const { assignment, klass } = await requireTeacherAssignment(params.id);
    const studentIds = await getClassStudentIds(klass.id);
    if (!studentIds.includes(studentId)) {
      notFound("student not in class");
    }

    const uploads = await getAssignmentUploads(assignment.id, studentId);
    return { data: uploads };
  }
});
