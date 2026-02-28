import { getKnowledgePoints } from "@/lib/content";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  cache: "public-short",
  handler: async () => {
    return { data: await getKnowledgePoints() };
  }
});
