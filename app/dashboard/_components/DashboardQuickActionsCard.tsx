import Link from "next/link";
import Card from "@/components/Card";
import type { DashboardQuickAction } from "@/lib/dashboard-overview";

type DashboardQuickActionsCardProps = {
  quickActions: DashboardQuickAction[];
};

export default function DashboardQuickActionsCard({ quickActions }: DashboardQuickActionsCardProps) {
  return (
    <Card title="快捷动作" tag="Actions">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10
        }}
      >
        {quickActions.map((action) => (
          <Link key={action.id} href={action.href} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="section-title" style={{ marginBottom: 6 }}>
              {action.label}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.6 }}>{action.description}</div>
            <div className="cta-row cta-row-tight">
              <span className={`button ${action.tone}`}>立即进入</span>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
