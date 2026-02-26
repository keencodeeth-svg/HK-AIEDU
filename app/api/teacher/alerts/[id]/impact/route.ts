import { getCurrentUser } from "@/lib/auth";
import { getTeacherAlerts } from "@/lib/teacher-alerts";
import { badRequest, notFound, unauthorized, withApi } from "@/lib/api/http";
import { parseParams, v } from "@/lib/api/validation";
import { buildTeacherAlertImpactReport, getTeacherAlertImpactByAlert } from "@/lib/teacher-alert-impacts";

export const dynamic = "force-dynamic";

const paramsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const GET = withApi(async (_request, context) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") {
    unauthorized();
  }

  const params = parseParams(context.params, paramsSchema);
  const alertId = params.id.trim();
  if (!alertId) {
    badRequest("invalid alert id");
  }

  const overview = await getTeacherAlerts({
    teacherId: user.id,
    includeAcknowledged: true
  });
  const target = overview.alerts.find((item) => item.id === alertId);
  if (!target) {
    notFound("not found");
  }

  const impactRecord = await getTeacherAlertImpactByAlert({
    teacherId: user.id,
    alertId
  });
  const impact = buildTeacherAlertImpactReport({
    record: impactRecord,
    current: {
      riskScore: target.riskScore,
      status: target.status,
      metrics: target.metrics ?? {}
    }
  });

  return {
    data: {
      alertId,
      classId: target.classId,
      type: target.type,
      riskReason: target.riskReason,
      recommendedAction: target.recommendedAction,
      impact
    }
  };
});
