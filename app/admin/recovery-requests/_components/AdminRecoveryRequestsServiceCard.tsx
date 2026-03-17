import Card from "@/components/Card";
import type { RecoverySummary } from "../types";

type AdminRecoveryRequestsServiceCardProps = {
  summary: RecoverySummary | null;
  itemsCount: number;
};

export function AdminRecoveryRequestsServiceCard({
  summary,
  itemsCount
}: AdminRecoveryRequestsServiceCardProps) {
  return (
    <Card title="服务水位" tag="恢复中心">
      <div className="pill-list">
        <span className="pill">总工单 {summary?.total ?? itemsCount}</span>
        <span className="pill">待处理 {summary?.pending ?? 0}</span>
        <span className="pill">处理中 {summary?.inProgress ?? 0}</span>
        <span className="pill">紧急 {summary?.urgent ?? 0}</span>
        <span className="pill">高优先 {summary?.highPriority ?? 0}</span>
        <span className="pill">未接单 {summary?.unassigned ?? 0}</span>
        <span className="pill">超 SLA {summary?.overdue ?? 0}</span>
      </div>
    </Card>
  );
}
