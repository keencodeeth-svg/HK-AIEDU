import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import type { AbilityStat } from "../types";
import { buildGridPoints } from "../utils";

type StudentPortraitRadarCardProps = {
  abilities: AbilityStat[];
  radarSize: number;
  radarCenter: number;
  radarRadius: number;
  radarGridLevels: number[];
  polygonPoints: string;
};

export default function StudentPortraitRadarCard({
  abilities,
  radarSize,
  radarCenter,
  radarRadius,
  radarGridLevels,
  polygonPoints
}: StudentPortraitRadarCardProps) {
  return (
    <Card title="学习画像 / 能力雷达" tag="雷达">
      <div className="feature-card">
        <EduIcon name="chart" />
        <p>能力雷达适合快速判断当前强弱项，再结合下方知识点和学科掌握概览安排下一步学习动作。</p>
      </div>

      {!abilities.length ? (
        <div style={{ marginTop: 12 }}>
          <StatePanel
            compact
            tone="empty"
            title="暂无能力雷达数据"
            description="先完成几次练习或诊断测评，系统会自动生成能力维度表现。"
            action={
              <Link className="button secondary" href="/practice">
                去练习
              </Link>
            }
          />
        </div>
      ) : (
        <div className="portrait-radar-layout">
          <div className="portrait-radar-visual">
            <svg width={radarSize} height={radarSize} viewBox={`0 0 ${radarSize} ${radarSize}`}>
              {radarGridLevels.map((level) => (
                <polygon
                  key={level}
                  points={buildGridPoints(abilities.length, radarRadius * level, radarCenter)}
                  fill="none"
                  stroke="rgba(27,108,168,0.18)"
                  strokeWidth="1"
                />
              ))}
              {abilities.map((_, index) => {
                const angle = (Math.PI * 2 * index) / abilities.length - Math.PI / 2;
                const x = radarCenter + radarRadius * Math.cos(angle);
                const y = radarCenter + radarRadius * Math.sin(angle);
                return (
                  <line
                    key={`axis-${index}`}
                    x1={radarCenter}
                    y1={radarCenter}
                    x2={x}
                    y2={y}
                    stroke="rgba(27,108,168,0.16)"
                    strokeWidth="1"
                  />
                );
              })}
              <polygon points={polygonPoints} fill="rgba(244,208,111,0.28)" stroke="#d36b3f" strokeWidth="2" />
            </svg>
            <div className="portrait-radar-legend">越接近外圈代表当前该能力越稳定；建议优先关注分值最低的 1-2 个维度。</div>
          </div>

          <div className="portrait-ability-grid">
            {abilities.map((item) => (
              <div className="card portrait-ability-card" key={item.id}>
                <div className="section-title">{item.label}</div>
                <div className="kpi-value">{item.score} 分</div>
                <div className="workflow-card-meta">
                  <span className="pill">正确 {item.correct}</span>
                  <span className="pill">总计 {item.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
