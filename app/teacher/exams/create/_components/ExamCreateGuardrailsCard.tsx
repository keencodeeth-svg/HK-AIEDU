import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { PoolRisk, ScheduleStatus } from "../types";

type ExamCreateGuardrailsCardProps = {
  poolRisk: PoolRisk;
  scheduleStatus: ScheduleStatus;
  configNotice: {
    title: string;
    message: string;
  } | null;
  onRefresh: () => void;
};

export default function ExamCreateGuardrailsCard({
  poolRisk,
  scheduleStatus,
  configNotice,
  onRefresh
}: ExamCreateGuardrailsCardProps) {
  return (
    <Card title="发布提醒" tag="Guardrails">
      <StatePanel compact tone={poolRisk.tone} title={poolRisk.title} description={poolRisk.description} />
      <StatePanel compact tone={scheduleStatus.tone} title={scheduleStatus.title} description={scheduleStatus.description} />
      {configNotice ? (
        <StatePanel
          compact
          tone="error"
          title={configNotice.title}
          description={configNotice.message}
          action={
            <button className="button secondary" type="button" onClick={onRefresh}>
              再试一次
            </button>
          }
        />
      ) : null}
    </Card>
  );
}
