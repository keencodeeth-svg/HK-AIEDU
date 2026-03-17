import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { SubjectMastery } from "../types";

type StudentPortraitSubjectMasteryCardProps = {
  subjects: SubjectMastery[];
};

export default function StudentPortraitSubjectMasteryCard({ subjects }: StudentPortraitSubjectMasteryCardProps) {
  return (
    <Card title="学科掌握概览" tag="学科">
      {!subjects.length ? (
        <StatePanel
          compact
          tone="empty"
          title="暂无学科掌握概览"
          description="积累更多练习和作答记录后，这里会按学科展示掌握、信心和趋势。"
        />
      ) : (
        <div className="portrait-subject-grid">
          {subjects.map((item) => (
            <div className="card" key={item.subject}>
              <div className="section-title">{SUBJECT_LABELS[item.subject] ?? item.subject}</div>
              <div className="workflow-card-meta">
                <span className="pill">掌握 {item.averageMasteryScore}</span>
                <span className="pill">信心 {item.averageConfidenceScore}</span>
                <span className="pill">趋势 {item.averageTrend7d}</span>
              </div>
              <div className="student-module-resource-meta">已跟踪 {item.trackedKnowledgePoints} 个知识点，可据此安排对应学科的复习优先级。</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
