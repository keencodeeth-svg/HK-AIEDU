import Card from "@/components/Card";
import type { WeeklyReportTrendItem } from "../types";

export function ReportTrendCard({ trend }: { trend: WeeklyReportTrendItem[] }) {
  return (
    <Card title="掌握趋势（近 7 天）" tag="趋势">
      <div className="grid" style={{ gap: 8 }}>
        {trend.map((item) => (
          <div key={item.date} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 80, fontSize: 12, color: "var(--ink-1)" }}>{item.date}</div>
            <div style={{ flex: 1, background: "rgba(30,90,122,0.08)", borderRadius: 999, height: 10 }}>
              <div
                style={{
                  width: `${item.accuracy}%`,
                  background: "var(--brand-0)",
                  height: 10,
                  borderRadius: 999
                }}
              />
            </div>
            <div style={{ width: 40, fontSize: 12 }}>{item.accuracy}%</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
