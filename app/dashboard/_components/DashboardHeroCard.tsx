import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import type { DashboardOverview } from "@/lib/dashboard-overview";

type DashboardHeroCardProps = {
  overview: DashboardOverview;
};

export default function DashboardHeroCard({ overview }: DashboardHeroCardProps) {
  return (
    <Card title="今日重点" tag="Overview">
      <div className="hero" style={{ alignItems: "stretch" }}>
        <div className="hero-stage" style={{ minHeight: 220 }}>
          <div className="badge" style={{ marginBottom: 10 }}>
            {overview.roleLabel}模式
          </div>
          <h1 style={{ fontSize: "clamp(24px, 3vw, 36px)", marginBottom: 10 }}>{overview.title}</h1>
          <p>{overview.subtitle}</p>
          <div className="cta-row">
            {overview.quickActions.slice(0, 2).map((action) => (
              <Link key={action.id} className={`button ${action.tone}`} href={action.href}>
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid" style={{ gap: 12 }}>
          {overview.metrics.map((metric) => (
            <div key={metric.id} className="card feature-card">
              <EduIcon name="chart" />
              <div>
                <div className="section-title">{metric.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>{metric.value}</div>
                {metric.helper ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>{metric.helper}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
