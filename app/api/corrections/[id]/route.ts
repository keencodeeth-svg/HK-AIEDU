import { getStudentContext } from "@/lib/user-context";
import { updateCorrectionTask } from "@/lib/corrections";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, parseParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const correctionParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const updateCorrectionBodySchema = v.object<{ status?: "pending" | "completed" }>(
  {
    status: v.optional(v.enum(["pending", "completed"] as const))
  },
  { allowUnknown: false }
);

export const PATCH = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const student = await getStudentContext();
    if (!student) {
      unauthorized();
    }

    const parsed = parseParams(params, correctionParamsSchema);
    const body = await parseJson(request, updateCorrectionBodySchema);
    if (!body.status) {
      badRequest("status required");
    }

    const next = await updateCorrectionTask({ id: parsed.id, userId: student.id, status: body.status });
    if (!next) {
      notFound("not found");
    }
    return { data: next };
  }
});
