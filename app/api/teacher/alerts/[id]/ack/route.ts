import { getCurrentUser } from "@/lib/auth";
import { acknowledgeTeacherAlert, getTeacherAlerts } from "@/lib/teacher-alerts";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseJson, parseParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const ackParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const ackBodySchema = v.object<{ note?: string }>(
  {
    note: v.optional(v.string({ allowEmpty: true }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, params, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const parsed = parseParams(params, ackParamsSchema);
    const body = await parseJson(request, ackBodySchema);

    const overview = await getTeacherAlerts({
      teacherId: user.id,
      includeAcknowledged: true
    });
    const target = overview.alerts.find((item) => item.id === parsed.id);
    if (!target) {
      notFound("not found");
    }

    const ack = await acknowledgeTeacherAlert({
      teacherId: user.id,
      alertId: parsed.id,
      note: body.note
    });
    // Ack endpoint only changes alert status/note; no side-effect task creation.

    return {
      data: {
        id: parsed.id,
        status: "acknowledged",
        acknowledgedAt: ack?.createdAt ?? new Date().toISOString(),
        note: ack?.note ?? null
      }
    };
  }
});
