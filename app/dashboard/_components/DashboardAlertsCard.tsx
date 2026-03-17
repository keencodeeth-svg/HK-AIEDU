import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { DashboardAlert } from "@/lib/dashboard-overview";
import { DASHBOARD_ALERT_TONE } from "../utils";

type DashboardAlertsCardProps = {
  alerts: DashboardAlert[];
};

export default function DashboardAlertsCard({ alerts }: DashboardAlertsCardProps) {
  return (
    <Card title="优先提醒" tag="Alerts">
      <div className="grid" style={{ gap: 10 }}>
        {alerts.length ? (
          alerts.map((alert) => {
            const tone = DASHBOARD_ALERT_TONE[alert.level];
            return (
              <div
                key={alert.id}
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 14,
                  borderRadius: 18,
                  background: tone.bg,
                  border: `1px solid ${tone.border}`
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div className="section-title" style={{ margin: 0 }}>
                    {alert.title}
                  </div>
                  <span className="pill" style={{ color: tone.text }}>
                    {tone.label}
                  </span>
                </div>
                <div style={{ color: "var(--ink-1)", lineHeight: 1.6 }}>{alert.detail}</div>
                {alert.href ? (
                  <div className="cta-row no-margin">
                    <Link className="button secondary" href={alert.href}>
                      {alert.actionLabel ?? "立即处理"}
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <StatePanel
            tone="success"
            title="当前没有高优先级提醒"
            description="今天的关键任务和消息比较平稳，可以按计划推进。"
          />
        )}
      </div>
    </Card>
  );
}
