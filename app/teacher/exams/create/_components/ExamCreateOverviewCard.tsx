import Card from "@/components/Card";
import { SUBJECT_LABELS, getGradeLabel } from "@/lib/constants";
import type { FormState, KnowledgePoint, ClassItem, ScheduleStatus } from "../types";
import { getDifficultyLabel, getQuestionTypeLabel } from "../utils";

type ExamCreateOverviewCardProps = {
  selectedClass: ClassItem | undefined;
  selectedPoint: KnowledgePoint | null;
  filteredPointCount: number;
  targetCount: number;
  classStudentsCount: number;
  form: FormState;
  scheduleStatus: ScheduleStatus;
};

export default function ExamCreateOverviewCard({
  selectedClass,
  selectedPoint,
  filteredPointCount,
  targetCount,
  classStudentsCount,
  form,
  scheduleStatus
}: ExamCreateOverviewCardProps) {
  return (
    <Card title="发布概览" tag="Overview">
      <div className="grid grid-2">
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">班级范围</div>
          <div className="workflow-summary-value">{selectedClass?.name ?? "-"}</div>
          <div className="workflow-summary-helper">
            {SUBJECT_LABELS[selectedClass?.subject ?? ""] ?? "-"} · {getGradeLabel(selectedClass?.grade)}
          </div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">知识点范围</div>
          <div className="workflow-summary-value">{selectedPoint ? "单点定向" : "全范围"}</div>
          <div className="workflow-summary-helper">
            {selectedPoint ? `${selectedPoint.chapter} · ${selectedPoint.title}` : `可选知识点 ${filteredPointCount} 个`}
          </div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">发布对象</div>
          <div className="workflow-summary-value">{targetCount}</div>
          <div className="workflow-summary-helper">
            {form.publishMode === "targeted" ? `当前定向 ${form.studentIds.length} 人` : `当前班级学生 ${classStudentsCount} 人`}
          </div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">题目配置</div>
          <div className="workflow-summary-value">{form.questionCount}</div>
          <div className="workflow-summary-helper">
            {getDifficultyLabel(form.difficulty)} · {getQuestionTypeLabel(form.questionType)}
          </div>
        </div>
      </div>

      <div className="pill-list" style={{ marginTop: 12 }}>
        <span className="pill">考试时长 {form.durationMinutes} 分钟</span>
        <span className="pill">防作弊 {form.antiCheatLevel === "basic" ? "基础监测" : "关闭"}</span>
        <span className="pill">隔离题 {form.includeIsolated ? "允许" : "默认排除"}</span>
        <span className="pill">{scheduleStatus.summary}</span>
      </div>
    </Card>
  );
}
