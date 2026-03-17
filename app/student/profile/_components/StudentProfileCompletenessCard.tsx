import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";

type StudentProfileCompletenessCardProps = {
  percentage: number;
  completedFields: number;
  totalFields: number;
  missingFields: string[];
};

export default function StudentProfileCompletenessCard({
  percentage,
  completedFields,
  totalFields,
  missingFields
}: StudentProfileCompletenessCardProps) {
  return (
    <Card title="资料完整度" tag="AI 协同">
      <div className="feature-card">
        <EduIcon name="brain" />
        <p>当前完整度 {percentage}% ，资料越完整，老师端学期排座配置和系统推荐越精准。</p>
      </div>
      <div className="grid grid-3" style={{ marginTop: 12 }}>
        <div className="card">
          <div className="section-title">已完成字段</div>
          <p>{completedFields} / {totalFields}</p>
        </div>
        <div className="card">
          <div className="section-title">主要用途</div>
          <p>学期排座配置 · 个性化推荐 · 课堂协同 · 家校支持</p>
        </div>
        <div className="card">
          <div className="section-title">建议动作</div>
          <p>{missingFields.length ? "继续补齐课堂相关信息" : "已达到高质量画像"}</p>
        </div>
      </div>
      {missingFields.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {missingFields.map((field) => (
            <span key={field} className="badge">
              待补：{field}
            </span>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
