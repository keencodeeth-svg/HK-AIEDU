import Link from "next/link";
import Card from "@/components/Card";

type StudentPortraitOverviewCardProps = {
  abilityCount: number;
  averageMasteryScore: number;
  averageConfidenceScore: number;
  averageTrend7d: number;
  primaryHref: string;
  secondaryHref: string;
  secondaryLabel: string;
};

export default function StudentPortraitOverviewCard({
  abilityCount,
  averageMasteryScore,
  averageConfidenceScore,
  averageTrend7d,
  primaryHref,
  secondaryHref,
  secondaryLabel
}: StudentPortraitOverviewCardProps) {
  return (
    <Card title="画像概览" tag="概览">
      <div className="grid grid-2">
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">能力维度</div>
          <div className="workflow-summary-value">{abilityCount}</div>
          <div className="workflow-summary-helper">已纳入能力雷达统计的维度数</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">平均掌握分</div>
          <div className="workflow-summary-value">{averageMasteryScore}</div>
          <div className="workflow-summary-helper">知识点整体掌握水平的平均分</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">平均信心分</div>
          <div className="workflow-summary-value">{averageConfidenceScore}</div>
          <div className="workflow-summary-helper">近期作答数据支撑当前画像结论的可信程度</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">7日趋势</div>
          <div className="workflow-summary-value">{averageTrend7d}</div>
          <div className="workflow-summary-helper">最近 7 天掌握度变化的平均趋势</div>
        </div>
      </div>

      <div className="cta-row portrait-next-actions" style={{ marginTop: 12 }}>
        <Link className="button secondary" href={primaryHref}>
          去做练习
        </Link>
        <Link className="button ghost" href={secondaryHref}>
          {secondaryLabel}
        </Link>
      </div>
    </Card>
  );
}
