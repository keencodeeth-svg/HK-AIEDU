import { getCurrentUser } from "@/lib/auth";
import { getAssignmentById } from "@/lib/assignments";
import { getClassById } from "@/lib/classes";
import { getAssignmentRubrics, replaceAssignmentRubrics } from "@/lib/rubrics";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const rubricLevelSchema = v.object<{
  label: string;
  score: number;
  description: string;
}>(
  {
    label: v.string({ minLength: 1 }),
    score: v.number({ coerce: true }),
    description: v.string({ minLength: 1 })
  },
  { allowUnknown: false }
);

const rubricItemSchema = v.object<{
  title: string;
  description?: string;
  maxScore?: number;
  weight?: number;
  levels?: Array<{ label: string; score: number; description: string }>;
}>(
  {
    title: v.string({ minLength: 1 }),
    description: v.optional(v.string({ allowEmpty: true, trim: true })),
    maxScore: v.optional(v.number({ coerce: true, integer: true, min: 1 })),
    weight: v.optional(v.number({ coerce: true, integer: true, min: 1 })),
    levels: v.optional(v.array(rubricLevelSchema))
  },
  { allowUnknown: false }
);

const rubricBodySchema = v.object<{
  items: Array<{
    title: string;
    description?: string;
    maxScore?: number;
    weight?: number;
    levels?: Array<{ label: string; score: number; description: string }>;
  }>;
}>(
  {
    items: v.array(rubricItemSchema, { minLength: 1 })
  },
  { allowUnknown: false }
);

async function assertTeacherAccess(assignmentId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    unauthorized();
  }
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) {
    notFound();
  }
  const klass = await getClassById(assignment.classId);
  if (!klass || klass.teacherId !== user.id) {
    notFound();
  }
  return assignment;
}

export const GET = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ params }) => {
    const assignment = await assertTeacherAccess(params.id);
    const rubrics = await getAssignmentRubrics(assignment.id);
    return { data: rubrics };
  }
});

export const POST = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const assignment = await assertTeacherAccess(params.id);
    const body = await parseJson(request, rubricBodySchema);

    const cleaned = body.items
      .map((item) => ({
        title: item.title.trim(),
        description: item.description?.trim() ?? "",
        maxScore: Number(item.maxScore ?? 5),
        weight: Number(item.weight ?? 1),
        levels: item.levels?.filter((level) => level.label && level.description) ?? []
      }))
      .filter((item) => item.title);

    if (!cleaned.length) {
      badRequest("missing items");
    }

    const saved = await replaceAssignmentRubrics({ assignmentId: assignment.id, items: cleaned });
    return { data: saved };
  }
});
