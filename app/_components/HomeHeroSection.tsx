import Link from "next/link";
import Card from "@/components/Card";
import Stat from "@/components/Stat";
import type { FirstLookItem, ProductStatusMetric } from "../home.types";

export function HomeHeroSection({
  pills,
  productStatusMetrics,
  firstLookItems
}: {
  pills: string[];
  productStatusMetrics: ProductStatusMetric[];
  firstLookItems: FirstLookItem[];
}) {
  return (
    <section className="hero hero-stage">
      <div>
        <div className="badge">航科AI教育 · 学生 / 教师 / 家长 / 学校一体化平台</div>
        <h1>不是只会做题的 AI，而是一套真正能跑起来的教育工作台</h1>
        <p>
          从学生的今日学习主场，到教师的执行工作台、家长的今晚行动台、学校的 AI 排课治理台，
          把“该做什么、先做什么、做完如何闭环”真正串起来。
        </p>
        <div className="cta-row">
          <Link className="button primary" href="/login?role=student&entry=landing">
            立即进入
          </Link>
          <Link className="button secondary" href="/dashboard">
            查看总看板
          </Link>
        </div>
        <div className="pill-list" style={{ marginTop: 14 }}>
          {pills.map((pill) => (
            <span key={pill} className="pill">
              {pill}
            </span>
          ))}
        </div>
      </div>

      <div className="grid" style={{ gap: 12 }}>
        <Card title="产品现状" tag="当前重点">
          <div className="grid grid-2">
            {productStatusMetrics.map((item) => (
              <Stat key={item.label} label={item.label} value={item.value} helper={item.helper} />
            ))}
          </div>
        </Card>

        <Card title="你将先看到什么" tag="首屏体验">
          <div className="grid" style={{ gap: 10 }}>
            {firstLookItems.map((item) => (
              <div key={item.title} className="card">
                <div className="section-title">{item.title}</div>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
