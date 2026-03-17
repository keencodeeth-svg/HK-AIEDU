import Link from "next/link";
import Card from "@/components/Card";
import type { SchoolActionItem } from "@/lib/school-admin-types";
import { SCHOOL_ACTION_TONE_META } from "../utils";

export function SchoolPriorityActionsCard({ actionItems }: { actionItems: SchoolActionItem[] }) {
  return (
    <Card title="本周优先动作" tag="待办">
      <div className="grid" style={{ gap: 10 }}>
        {actionItems.map((item) => {
          const meta = SCHOOL_ACTION_TONE_META[item.tone];
          return (
            <div className="card" key={item.id}>
              <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div className="section-title">{item.title}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 6 }}>{item.description}</div>
                </div>
                <span
                  className="pill"
                  style={{ background: meta.background, color: meta.color, border: `1px solid ${meta.background}` }}
                >
                  {meta.label}
                </span>
              </div>
              <div className="cta-row" style={{ marginTop: 10, justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{item.count ? `涉及 ${item.count} 个对象` : "建议持续巡检"}</div>
                <Link className="button ghost" href={item.href}>
                  {item.ctaLabel}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
