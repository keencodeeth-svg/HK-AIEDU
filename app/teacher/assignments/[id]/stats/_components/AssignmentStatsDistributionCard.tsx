import Card from "@/components/Card";
import type { AssignmentStatsDistributionItem } from "../types";

type AssignmentStatsDistributionCardProps = {
  distribution: AssignmentStatsDistributionItem[];
  maxCount: number;
};

function getBucketGradient(label: string) {
  if (label === "<60") return "linear-gradient(90deg, #dc2626, #fb7185)";
  if (label === "60-69") return "linear-gradient(90deg, #ea580c, #fb923c)";
  if (label === "70-79") return "linear-gradient(90deg, #ca8a04, #facc15)";
  if (label === "80-89") return "linear-gradient(90deg, #0891b2, #38bdf8)";
  return "linear-gradient(90deg, #16a34a, #65a30d)";
}

export default function AssignmentStatsDistributionCard({
  distribution,
  maxCount
}: AssignmentStatsDistributionCardProps) {
  const lowScoreCount = distribution.find((item) => item.label === "<60")?.count ?? 0;
  const highScoreCount = distribution.find((item) => item.label === "90-100")?.count ?? 0;
  const strongestBucket =
    [...distribution].sort((left, right) => right.count - left.count)[0] ?? null;

  return (
    <Card title="成绩分布" tag="Distribution">
      <div id="assignment-stats-distribution">
        <div className="workflow-card-meta">
          <span className="pill">低于 60 分 {lowScoreCount} 人</span>
          <span className="pill">90 分以上 {highScoreCount} 人</span>
          {strongestBucket ? <span className="pill">集中在 {strongestBucket.label}</span> : null}
        </div>

        <div className="meta-text" style={{ marginTop: 12 }}>
          分布不是为了看图好看，而是为了判断风险是集中在低分段，还是已经开始向中高分迁移。
        </div>

        {distribution.length ? (
          <div className="grid" style={{ gap: 10, marginTop: 12 }}>
            {distribution.map((item) => {
              const width = item.count ? Math.max((item.count / maxCount) * 100, 12) : 0;
              return (
                <div key={item.label} className="card assignment-stats-distribution-row">
                  <div className="assignment-stats-distribution-head">
                    <div className="section-title">{item.label}</div>
                    <span className="pill">{item.count} 人</span>
                  </div>
                  <div className="assignment-stats-distribution-bar">
                    <div
                      className="assignment-stats-distribution-fill"
                      style={{
                        width: `${width}%`,
                        background: getBucketGradient(item.label)
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ marginTop: 12 }}>暂无分布数据。</p>
        )}
      </div>
    </Card>
  );
}
