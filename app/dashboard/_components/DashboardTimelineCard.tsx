import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import type { DashboardTimelineItem } from "@/lib/dashboard-overview";
import { DASHBOARD_ALERT_TONE, DASHBOARD_TIMELINE_ICON } from "../utils";

type DashboardTimelineCardProps = {
  timeline: DashboardTimelineItem[];
};

export default function DashboardTimelineCard({ timeline }: DashboardTimelineCardProps) {
  return (
    <Card title="最近动态" tag="Timeline">
      <div className="grid" style={{ gap: 10 }}>
        {timeline.length ? (
          timeline.map((item) => {
            const tone = DASHBOARD_ALERT_TONE[item.status ?? "info"];
            return (
              <Link
                key={item.id}
                href={item.href}
                className="card"
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "grid",
                  gap: 8,
                  borderLeft: `4px solid ${tone.border}`
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ marginTop: 2 }}>
                      <EduIcon name={DASHBOARD_TIMELINE_ICON[item.type]} />
                    </div>
                    <div>
                      <div className="section-title" style={{ marginBottom: 4 }}>
                        {item.title}
                      </div>
                      <div style={{ color: "var(--ink-1)", lineHeight: 1.6 }}>{item.detail}</div>
                    </div>
                  </div>
                  <span className="pill" style={{ whiteSpace: "nowrap" }}>
                    {item.meta}
                  </span>
                </div>
              </Link>
            );
          })
        ) : (
          <StatePanel
            tone="empty"
            title="最近没有新的动态"
            description="你可以从上方快捷动作进入主线功能，继续推进今天的任务。"
          />
        )}
      </div>
    </Card>
  );
}
