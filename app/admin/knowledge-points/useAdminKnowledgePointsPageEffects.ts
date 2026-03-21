import { useEffect } from "react";
import type { KnowledgePointQuery } from "./types";

type AdminKnowledgePointsPageEffectsOptions = {
  query: KnowledgePointQuery;
  page: number;
  pageSize: number;
  loadAllKnowledgePoints: () => Promise<void>;
  loadKnowledgePointList: (options?: {
    query?: KnowledgePointQuery;
    page?: number;
    pageSize?: number;
  }) => Promise<void>;
};

export function useAdminKnowledgePointsPageEffects({
  query,
  page,
  pageSize,
  loadAllKnowledgePoints,
  loadKnowledgePointList
}: AdminKnowledgePointsPageEffectsOptions) {
  useEffect(() => {
    void loadAllKnowledgePoints();
  }, [loadAllKnowledgePoints]);

  useEffect(() => {
    void loadKnowledgePointList({ query, page, pageSize });
  }, [loadKnowledgePointList, page, pageSize, query]);
}
