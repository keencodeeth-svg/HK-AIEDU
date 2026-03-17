import Card from "@/components/Card";
import type { WeeklyReportWeakPoint } from "../types";

export function ReportWeakPointsCard({
  weakPoints,
  suggestions
}: {
  weakPoints: WeeklyReportWeakPoint[];
  suggestions: string[];
}) {
  return (
    <Card title="薄弱点" tag="提醒">
      <div className="grid" style={{ gap: 8 }}>
        {weakPoints.length ? (
          weakPoints.map((item) => (
            <div className="card" key={item.id}>
              <div className="section-title">{item.title}</div>
              <p>
                正确率 {item.ratio}% · 练习 {item.total} 题
              </p>
            </div>
          ))
        ) : (
          <p>暂无薄弱点数据。</p>
        )}
      </div>
      {suggestions.length ? (
        <div style={{ marginTop: 12 }}>
          <div className="badge">学习建议</div>
          <div className="grid" style={{ gap: 6, marginTop: 8 }}>
            {suggestions.map((item, index) => (
              <div key={`${item}-${index}`}>{item}</div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
