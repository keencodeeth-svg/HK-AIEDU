import type { PortraitStageCopy } from "../types";

type StudentPortraitStageBannerProps = {
  stageCopy: PortraitStageCopy;
  averageMasteryScore: number;
  averageConfidenceScore: number;
  averageTrend7d: number;
  lowestAbilityLabel?: string | null;
};

export default function StudentPortraitStageBanner({
  stageCopy,
  averageMasteryScore,
  averageConfidenceScore,
  averageTrend7d,
  lowestAbilityLabel
}: StudentPortraitStageBannerProps) {
  return (
    <div className="portrait-stage-banner">
      <div className="portrait-stage-kicker">当前阶段</div>
      <div className="portrait-stage-title">{stageCopy.title}</div>
      <p className="portrait-stage-description">{stageCopy.description}</p>
      <div className="pill-list">
        <span className="pill">平均掌握 {averageMasteryScore} 分</span>
        <span className="pill">平均信心 {averageConfidenceScore} 分</span>
        <span className="pill">7日趋势 {averageTrend7d}</span>
        {lowestAbilityLabel ? <span className="pill">待提升能力：{lowestAbilityLabel}</span> : null}
      </div>
    </div>
  );
}
