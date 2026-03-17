import { createAdminRoute } from "@/lib/api/domains";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { addAdminLog } from "@/lib/admin-log";
import { badRequest, unauthorized } from "@/lib/api/http";
import type { AiEvalDatasetName } from "@/lib/ai-evals";
import {
  refreshAiEvalGateState,
  getAiEvalGateConfig,
  listAiEvalGateRuns,
  runAiEvalGate,
  updateAiEvalGateConfig
} from "@/lib/ai-eval-gate";
import { v } from "@/lib/api/validation";

const ALLOWED_DATASETS: AiEvalDatasetName[] = [
  "explanation",
  "homework_review",
  "knowledge_points_generate",
  "writing_feedback",
  "lesson_outline",
  "question_check"
];

const querySchema = v.object<{ limit?: number }>(
  {
    limit: v.optional(v.number({ integer: true, min: 1, max: 100, coerce: true }))
  },
  { allowUnknown: true }
);

function parseDatasets(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const allowed = new Set<AiEvalDatasetName>(ALLOWED_DATASETS);
  const datasets = Array.from(
    new Set(
      value
        .map((item) => String(item).trim())
        .filter(Boolean)
        .filter((item): item is AiEvalDatasetName => allowed.has(item as AiEvalDatasetName))
    )
  );
  return datasets.length ? datasets : undefined;
}

async function buildPayload(limit = 10) {
  await refreshAiEvalGateState();
  return {
    config: getAiEvalGateConfig(),
    recentRuns: listAiEvalGateRuns(limit)
  };
}

export const GET = createAdminRoute({
  role: "admin",
  query: querySchema,
  cache: "private-realtime",
  handler: async ({ user, query }) => {
    if (!user || user.role !== "admin") {
      unauthorized();
    }
    const limit = query.limit ?? 10;
    return { data: await buildPayload(limit) };
  }
});

export const POST = createAdminRoute({
  role: "admin",
  cache: "private-realtime",
  handler: async ({ user, request }) => {
    if (!user || user.role !== "admin") {
      unauthorized();
    }
    assertAdminStepUp(user);

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      badRequest("invalid json body");
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      badRequest("body must be object");
    }
    const body = payload as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";

    if (action === "run") {
      const override = body.configOverride && typeof body.configOverride === "object" && !Array.isArray(body.configOverride)
        ? (body.configOverride as Record<string, unknown>)
        : {};
      const runResult = await runAiEvalGate({
        force: body.force === true,
        runBy: user.id,
        configOverride: {
          enabled: typeof override.enabled === "boolean" ? override.enabled : undefined,
          datasets: parseDatasets(override.datasets),
          minPassRate: typeof override.minPassRate === "number" ? override.minPassRate : undefined,
          minAverageScore: typeof override.minAverageScore === "number" ? override.minAverageScore : undefined,
          maxHighRiskCount: typeof override.maxHighRiskCount === "number" ? override.maxHighRiskCount : undefined,
          autoRollbackOnFail:
            typeof override.autoRollbackOnFail === "boolean" ? override.autoRollbackOnFail : undefined
        }
      });

      await addAdminLog({
        adminId: user.id,
        action: "run_ai_eval_gate",
        entityType: "ai_eval_gate",
        entityId: runResult.run.id,
        detail: JSON.stringify({
          passed: runResult.run.passed,
          failedRules: runResult.run.failedRules,
          rollback: runResult.run.rollback
        })
      });
      return {
        data: {
          ...(await buildPayload(10)),
          lastRun: runResult.run,
          report: runResult.report
        }
      };
    }

    const hasPatchField =
      body.enabled !== undefined ||
      body.datasets !== undefined ||
      body.minPassRate !== undefined ||
      body.minAverageScore !== undefined ||
      body.maxHighRiskCount !== undefined ||
      body.autoRollbackOnFail !== undefined;
    if (!hasPatchField) {
      badRequest("missing action or config patch");
    }

    const next = await updateAiEvalGateConfig(
      {
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        datasets: parseDatasets(body.datasets),
        minPassRate: typeof body.minPassRate === "number" ? body.minPassRate : undefined,
        minAverageScore: typeof body.minAverageScore === "number" ? body.minAverageScore : undefined,
        maxHighRiskCount: typeof body.maxHighRiskCount === "number" ? body.maxHighRiskCount : undefined,
        autoRollbackOnFail: typeof body.autoRollbackOnFail === "boolean" ? body.autoRollbackOnFail : undefined
      },
      { updatedBy: user.id }
    );

    await addAdminLog({
      adminId: user.id,
      action: "update_ai_eval_gate_config",
      entityType: "ai_eval_gate",
      entityId: "runtime",
      detail: JSON.stringify(next)
    });

    return { data: await buildPayload(10) };
  }
});
