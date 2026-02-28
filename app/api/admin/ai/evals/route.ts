import { createAdminRoute } from "@/lib/api/domains";
import { runAiOfflineEval, type AiEvalDatasetName } from "@/lib/ai-evals";
import { unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";

const querySchema = v.object<{ datasets?: string }>(
  {
    datasets: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

const ALLOWED_DATASETS: AiEvalDatasetName[] = ["explanation", "homework_review", "knowledge_points_generate"];

export const GET = createAdminRoute({
  role: "admin",
  query: querySchema,
  cache: "private-realtime",
  handler: async ({ user, query }) => {
    if (!user || user.role !== "admin") {
      unauthorized();
    }

    const selected = (query.datasets ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item): item is AiEvalDatasetName => ALLOWED_DATASETS.includes(item as AiEvalDatasetName));

    const report = runAiOfflineEval({
      datasets: selected.length ? selected : undefined
    });

    return { data: report };
  }
});

