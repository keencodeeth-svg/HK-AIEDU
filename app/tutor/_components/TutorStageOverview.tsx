import { getGradeLabel, SUBJECT_LABELS } from "@/lib/constants";
import type { TutorLearningMode } from "../utils";

type TutorFlowStepState = "idle" | "active" | "done";

export type TutorFlowStep = {
  id: string;
  step: string;
  title: string;
  description: string;
  state: TutorFlowStepState;
};

type TutorStageOverviewProps = {
  launchMessage: string | null;
  learningMode: TutorLearningMode;
  subject: string;
  grade: string;
  resolvedModeLabel: string;
  selectedModeLabel: string;
  selectedImagesCount: number;
  selectedCropCount: number;
  maxImageCount: number;
  hasAnswer: boolean;
  stageCopy: {
    title: string;
    description: string;
  };
  tutorFlowSteps: TutorFlowStep[];
};

export function TutorStageOverview({
  launchMessage,
  learningMode,
  subject,
  grade,
  resolvedModeLabel,
  selectedModeLabel,
  selectedImagesCount,
  selectedCropCount,
  maxImageCount,
  hasAnswer,
  stageCopy,
  tutorFlowSteps
}: TutorStageOverviewProps) {
  return (
    <>
      <div className="section-head">
        <div>
          <h2>AI 辅导</h2>
          <div className="section-sub">直接讲解与学习模式双轨并行，支持文字提问、拍照识题、阶段追问、质量提示与历史回放。</div>
        </div>
        <span className="chip">{learningMode === "study" ? "学习模式" : "智能讲解"}</span>
      </div>

      {launchMessage ? (
        <div className="status-note info" style={{ whiteSpace: "pre-line" }}>
          {launchMessage}
        </div>
      ) : null}

      <div className="tutor-stage-banner">
        <div className="tutor-stage-kicker">当前阶段</div>
        <div className="tutor-stage-title">{stageCopy.title}</div>
        <p className="tutor-stage-description">{stageCopy.description}</p>
        <div className="pill-list">
          <span className="pill">{SUBJECT_LABELS[subject] ?? subject}</span>
          <span className="pill">{getGradeLabel(grade)}</span>
          <span className="pill">{hasAnswer ? resolvedModeLabel : selectedModeLabel}</span>
          <span className="pill">题图 {selectedImagesCount}/{maxImageCount} 张</span>
          {selectedCropCount ? <span className="pill">已框选 {selectedCropCount} 张</span> : null}
        </div>
      </div>

      <div className="tutor-jump-row">
        <a className="button ghost" href="#tutor-composer-anchor">去输入区</a>
        <a className="button ghost" href={hasAnswer ? "#tutor-answer-anchor" : "#tutor-history-anchor"}>
          {hasAnswer ? "看当前结果" : "看历史记录"}
        </a>
        <a className="button ghost" href="#tutor-history-anchor">回看历史</a>
      </div>

      <div className="tutor-flow-grid">
        {tutorFlowSteps.map((item) => (
          <div
            key={item.id}
            className={`tutor-flow-card${item.state === "active" ? " active" : item.state === "done" ? " done" : ""}`}
          >
            <div className="tutor-flow-card-head">
              <span className="tutor-flow-step">{item.step}</span>
              <div className="tutor-flow-title">{item.title}</div>
            </div>
            <p className="tutor-flow-description">{item.description}</p>
          </div>
        ))}
      </div>
    </>
  );
}
