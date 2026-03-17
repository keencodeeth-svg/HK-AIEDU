import Link from "next/link";
import Card from "@/components/Card";
import type { FirstDayFlow } from "../home.types";

export function HomeFirstDayFlowsSection({ firstDayFlows }: { firstDayFlows: FirstDayFlow[] }) {
  return (
    <section className="grid" style={{ gap: 14 }}>
      <div className="section-head">
        <div>
          <h2>首日上手路径</h2>
          <div className="section-sub">不讲空话，直接告诉新用户第一天怎么把系统跑起来。</div>
        </div>
        <span className="chip">Onboarding</span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        {firstDayFlows.map((flow) => (
          <Card key={flow.id} title={flow.roleLabel} tag={flow.tag}>
            <div className="grid" style={{ gap: 10 }}>
              {flow.steps.map((step, index) => (
                <div className="card" key={`${flow.id}-${step.title}`}>
                  <div className="section-title">
                    {index + 1}. {step.title}
                  </div>
                  <div className="meta-text" style={{ marginTop: 6, lineHeight: 1.7 }}>
                    {step.description}
                  </div>
                </div>
              ))}
              <Link className="button secondary" href={flow.href}>
                查看该角色页面
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
