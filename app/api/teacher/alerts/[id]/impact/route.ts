import { getCurrentUser } from "@/lib/auth";
import { getTeacherAlerts } from "@/lib/teacher-alerts";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseParams, v } from "@/lib/api/validation";
import { buildTeacherAlertImpactReport, getTeacherAlertImpactByAlert } from "@/lib/teacher-alert-impacts";
import { createLearningRoute } from "@/lib/api/domains";

const paramsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const GET = createLearningRoute({
  role: "teacher",
  cache: "private-short",
  handler: async ({ params, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const parsed = parseParams(params, paramsSchema);
    const alertId = parsed.id.trim();
    if (!alertId) {
      badRequest("invalid alert id");
    }

    const impactRecord = await getTeacherAlertImpactByAlert({
      teacherId: user.id,
      alertId
    });

    const overview = await getTeacherAlerts({
      teacherId: user.id,
      includeAcknowledged: true
    });
    const target = overview.alerts.find((item) => item.id === alertId);
    if (!target && !impactRecord) {
      notFound("not found");
    }

    const impact = buildTeacherAlertImpactReport({
      record: impactRecord,
      current: target
        ? {
            riskScore: target.riskScore,
            status: target.status,
            metrics: target.metrics ?? {}
          }
        : null
    });
    // Impact endpoint merges saved baseline and latest alert snapshot into one report.

    return {
      data: {
        alertId,
        classId: target?.classId ?? impactRecord?.classId ?? null,
        type: target?.type ?? null,
        riskReason: target?.riskReason ?? "",
        recommendedAction: target?.recommendedAction ?? impactRecord?.baseline.recommendedAction ?? "",
        impact
      }
    };
  }
});
