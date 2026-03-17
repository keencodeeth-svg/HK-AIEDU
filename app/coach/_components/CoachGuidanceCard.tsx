import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import type { CoachResponse } from "../types";

export function CoachGuidanceCard({
  data,
  hintIndex,
  onShowNextHint
}: {
  data: CoachResponse | null;
  hintIndex: number;
  onShowNextHint: () => void;
}) {
  if (!data) {
    return null;
  }

  const checkpoints = data.knowledgeChecks ?? data.checkpoints ?? [];

  return (
    <Card title="陪练指引" tag="反馈">
      <div className="feature-card">
        <EduIcon name="board" />
        <p>先追问和知识检查，再按需揭晓完整讲解。</p>
      </div>
      <div className="cta-row" style={{ marginBottom: 8 }}>
        {data.stageLabel ? <span className="badge">{data.stageLabel}</span> : null}
        {data.masteryFocus ? <span className="pill">本轮重点：{data.masteryFocus}</span> : null}
        {data.answerAvailable && !data.answer.trim() ? <span className="pill">答案已锁定</span> : null}
      </div>
      {data.coachReply ? <div>{data.coachReply}</div> : null}
      {data.feedback ? <div style={{ marginTop: 10 }}>{data.feedback}</div> : null}
      {data.nextPrompt ? (
        <div className="status-note info" style={{ marginTop: 10 }}>
          {data.nextPrompt}
        </div>
      ) : null}
      <div className="grid" style={{ gap: 8, marginTop: 12 }}>
        <div className="badge">知识检查</div>
        {checkpoints.map((step) => (
          <div key={step}>{step}</div>
        ))}
      </div>
      <div className="grid" style={{ gap: 8, marginTop: 12 }}>
        <div className="badge">再给我一点提示</div>
        {data.hints.slice(0, hintIndex).map((hint) => (
          <div key={hint}>{hint}</div>
        ))}
        <button
          className="button secondary"
          type="button"
          onClick={onShowNextHint}
          disabled={hintIndex >= data.hints.length}
        >
          我卡住了
        </button>
      </div>
      {data.answer.trim() ? (
        <div className="grid" style={{ gap: 8, marginTop: 12 }}>
          <div className="badge">完整讲解</div>
          <div>{data.answer}</div>
          {data.steps.map((step) => (
            <div key={step}>{step}</div>
          ))}
        </div>
      ) : (
        <div className="status-note info" style={{ marginTop: 12 }}>
          当前仍在学习模式中。先完成追问和提示，需要时再点击“查看完整讲解”。
        </div>
      )}
      {data.memory ? (
        <div className="grid" style={{ gap: 8, marginTop: 12 }}>
          <div className="badge">长期记忆</div>
          <div>{data.memory.patternHint}</div>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
            最近陪练 {data.memory.recentSessionCount} 次
            {data.memory.recentQuestions?.length ? ` · 最近题目：${data.memory.recentQuestions.slice(0, 3).join("；")}` : ""}
          </div>
        </div>
      ) : null}
      {data.provider ? (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-1)" }}>模型来源：{data.provider}</div>
      ) : null}
    </Card>
  );
}
