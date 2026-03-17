import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { GRADE_OPTIONS, SUBJECT_OPTIONS } from "@/lib/constants";
import { COACH_FIELD_STYLE } from "../utils";

export function CoachComposerCard({
  question,
  subject,
  grade,
  studentAnswer,
  loading,
  error,
  hasQuestion,
  hasStudentAnswer,
  onQuestionChange,
  onSubjectChange,
  onGradeChange,
  onStudentAnswerChange,
  onStartCoach,
  onSubmitThinking,
  onRevealAnswer
}: {
  question: string;
  subject: string;
  grade: string;
  studentAnswer: string;
  loading: boolean;
  error: string | null;
  hasQuestion: boolean;
  hasStudentAnswer: boolean;
  onQuestionChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onGradeChange: (value: string) => void;
  onStudentAnswerChange: (value: string) => void;
  onStartCoach: () => void;
  onSubmitThinking: () => void;
  onRevealAnswer: () => void;
}) {
  return (
    <Card title="学习陪练模式" tag="输入">
      <div className="feature-card">
        <EduIcon name="brain" />
        <p>先说思路，再完成知识检查，需要时再揭晓完整讲解。</p>
      </div>
      <div className="grid grid-3">
        <label>
          <div className="section-title">学科</div>
          <select value={subject} onChange={(event) => onSubjectChange(event.target.value)} style={COACH_FIELD_STYLE}>
            {SUBJECT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">年级</div>
          <select value={grade} onChange={(event) => onGradeChange(event.target.value)} style={COACH_FIELD_STYLE}>
            {GRADE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">我的思路</div>
          <textarea
            value={studentAnswer}
            onChange={(event) => onStudentAnswerChange(event.target.value)}
            rows={3}
            placeholder="先写下你会怎么下手，系统会按你的思路继续追问。"
            style={COACH_FIELD_STYLE}
          />
        </label>
      </div>
      <label style={{ marginTop: 12 }}>
        <div className="section-title">题目</div>
        <textarea
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          rows={3}
          placeholder="例如：把 2/3 和 1/6 相加"
          style={COACH_FIELD_STYLE}
        />
      </label>
      <div className="cta-row" style={{ marginTop: 12 }}>
        <button className="button primary" type="button" onClick={onStartCoach} disabled={loading || !hasQuestion}>
          {loading ? "生成中..." : "开始学习模式"}
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={onSubmitThinking}
          disabled={loading || !hasQuestion || !hasStudentAnswer}
        >
          提交我的思路
        </button>
        <button className="button ghost" type="button" onClick={onRevealAnswer} disabled={loading || !hasQuestion}>
          查看完整讲解
        </button>
      </div>
      {error ? (
        <div className="status-note error" style={{ marginTop: 8 }}>
          {error}
        </div>
      ) : null}
    </Card>
  );
}
