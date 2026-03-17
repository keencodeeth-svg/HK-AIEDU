import Card from "@/components/Card";
import MathText from "@/components/MathText";
import StatePanel from "@/components/StatePanel";
import { getGradeLabel, SUBJECT_LABELS } from "@/lib/constants";
import { ANSWER_MODE_OPTIONS, QUALITY_RISK_LABELS } from "../config";
import type {
  TutorAnswer,
  TutorAnswerMode,
  TutorShareTarget,
  TutorVariantPack,
  TutorVariantProgress,
  TutorVariantReflection
} from "../types";
import type { ActiveAction, ResultOrigin } from "../utils";
import {
  getAnswerSections,
  getOriginLabel,
  getQualityToneClass,
  getShareTargetActionLabel,
  isStudyResult,
  truncateText
} from "../utils";

type TutorAnswerCardProps = {
  answer: TutorAnswer;
  subject: string;
  grade: string;
  resolvedModeLabel: string;
  resultOrigin: ResultOrigin;
  resultAnswerMode: TutorAnswerMode;
  loading: boolean;
  activeAction: ActiveAction;
  actionMessage: string | null;
  studyThinking: string;
  studyHintCount: number;
  editableQuestion: string;
  loadingVariants: boolean;
  variantPack: TutorVariantPack | null;
  variantAnswers: Record<number, string>;
  variantResults: Record<number, boolean | null>;
  variantCommittedAnswers: Record<number, string>;
  submittedVariantCount: number;
  variantProgress: TutorVariantProgress | null;
  savingVariantProgressIndex: number | null;
  variantReflection: TutorVariantReflection | null;
  loadingVariantReflection: boolean;
  shareTargets: TutorShareTarget[];
  shareTargetsLoaded: boolean;
  shareTargetsLoading: boolean;
  shareTargetsLoadError: string | null;
  shareSubmittingTargetId: string;
  shareError: string | null;
  shareSuccess: { threadId: string; targetName: string; reused: boolean } | null;
  onStartOver: () => void;
  onFocusComposerInput: () => void;
  onStudyThinkingChange: (value: string) => void;
  onSubmitStudyThinking: () => void;
  onIncreaseStudyHintCount: () => void;
  onRevealStudyAnswer: () => void;
  onEditableQuestionChange: (value: string) => void;
  onRefineSolve: () => void;
  onSyncEditableQuestion: () => void;
  onCopyEditableQuestion: () => void;
  onCopyAnswer: () => void;
  onLoadVariants: () => void;
  onShareResult: (target: TutorShareTarget) => void;
  onReloadShareTargets: () => void;
  onOpenShareThread: (threadId: string) => void;
  onVariantAnswerChange: (index: number, value: string) => void;
  onVariantSubmit: (index: number, selected: string, correctAnswer: string) => void;
  onLoadVariantReflection: () => void;
};

export function TutorAnswerCard({
  answer,
  subject,
  grade,
  resolvedModeLabel,
  resultOrigin,
  resultAnswerMode,
  loading,
  activeAction,
  actionMessage,
  studyThinking,
  studyHintCount,
  editableQuestion,
  loadingVariants,
  variantPack,
  variantAnswers,
  variantResults,
  variantCommittedAnswers,
  submittedVariantCount,
  variantProgress,
  savingVariantProgressIndex,
  variantReflection,
  loadingVariantReflection,
  shareTargets,
  shareTargetsLoaded,
  shareTargetsLoading,
  shareTargetsLoadError,
  shareSubmittingTargetId,
  shareError,
  shareSuccess,
  onStartOver,
  onFocusComposerInput,
  onStudyThinkingChange,
  onSubmitStudyThinking,
  onIncreaseStudyHintCount,
  onRevealStudyAnswer,
  onEditableQuestionChange,
  onRefineSolve,
  onSyncEditableQuestion,
  onCopyEditableQuestion,
  onCopyAnswer,
  onLoadVariants,
  onShareResult,
  onReloadShareTargets,
  onOpenShareThread,
  onVariantAnswerChange,
  onVariantSubmit,
  onLoadVariantReflection
}: TutorAnswerCardProps) {
  const studyResult = isStudyResult(answer);
  const answerSections = getAnswerSections(answer, resultAnswerMode);
  const visibleStudyHints =
    studyResult && answer
      ? (answer.hints ?? []).slice(0, answer.answer.trim() ? answer.hints?.length ?? 0 : studyHintCount)
      : [];
  const canLoadVariants = Boolean(answer.answer.trim());
  const teacherShareTargets = shareTargets.filter((item) => item.kind === "teacher");
  const parentShareTargets = shareTargets.filter((item) => item.kind === "parent");
  const resultSummary = studyResult
    ? answer.answer.trim()
      ? "完整讲解已经揭晓，接下来最重要的是复盘：不用看答案，再说一遍为什么这么做。"
      : "当前仍在学习模式中，答案默认锁定。先完成提示、追问和知识检查，再决定是否揭晓讲解。"
    : resultOrigin === "image"
      ? "图片题目已识别完成，建议先核对题干，再根据讲解决定是否需要重新求解或分享给老师。"
      : resultOrigin === "refine"
        ? "这是按你编辑后的题目重新生成的结果，可以直接对比并判断是否更贴合原题。"
        : "文字问题已经讲解完成，适合直接复制答案、继续追问或发给老师 / 家长。";

  return (
    <Card title="AI 讲解" tag="讲解">
      <div className="cta-row" style={{ marginBottom: 10 }}>
        <span className="pill">{SUBJECT_LABELS[subject] ?? subject}</span>
        <span className="pill">{getGradeLabel(grade)}</span>
        <span className="pill">{resolvedModeLabel}</span>
        <span className="pill">{getOriginLabel(resultOrigin)}</span>
        {answer.provider ? <span className="pill">模型：{answer.provider}</span> : null}
      </div>

      {actionMessage ? <div className="status-note success" style={{ marginBottom: 10 }}>{actionMessage}</div> : null}
      <div className="tutor-result-summary">{resultSummary}</div>
      <div className="cta-row tutor-result-next-actions" style={{ marginBottom: 12 }}>
        <button className="button secondary" type="button" onClick={onStartOver}>
          再问一题
        </button>
        <button className="button ghost" type="button" onClick={onFocusComposerInput}>
          回到提问区
        </button>
        <a className="button ghost" href="#tutor-history-anchor">
          看历史记录
        </a>
      </div>

      {answer.quality ? (
        <>
          <div className={`status-note ${getQualityToneClass(answer.quality.riskLevel)}`} style={{ marginBottom: 10 }}>
            可信度 {answer.quality.confidenceScore}/100 · {QUALITY_RISK_LABELS[answer.quality.riskLevel]} · {answer.quality.fallbackAction}
          </div>
          {answer.quality.reasons.length ? (
            <div className="pill-list" style={{ marginBottom: 12 }}>
              {answer.quality.reasons.map((reason) => (
                <span className="pill" key={reason}>
                  {reason}
                </span>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {studyResult ? (
        <>
          <div className="card" style={{ marginBottom: 12, display: "grid", gap: 10 }}>
            <div className="cta-row">
              {answer.stageLabel ? <span className="badge">{answer.stageLabel}</span> : null}
              {answer.masteryFocus ? <span className="pill">本轮重点：{answer.masteryFocus}</span> : null}
              {answer.answerAvailable && !answer.answer.trim() ? <span className="pill">答案已锁定</span> : null}
            </div>
            {answer.coachReply ? <MathText as="div" text={answer.coachReply} /> : null}
            {answer.memory ? (
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                {answer.memory.patternHint}
                {answer.memory.recentQuestions?.length ? ` · 最近题目：${answer.memory.recentQuestions.slice(0, 3).join("；")}` : ""}
              </div>
            ) : null}
          </div>

          {answer.knowledgeChecks?.length ? (
            <div className="grid" style={{ gap: 6, marginBottom: 12 }}>
              <div className="badge">知识检查</div>
              {answer.knowledgeChecks.map((item) => (
                <MathText as="div" key={item} text={item} />
              ))}
            </div>
          ) : null}

          {visibleStudyHints.length ? (
            <div className="grid" style={{ gap: 6, marginBottom: 12 }}>
              <div className="badge">当前提示</div>
              {visibleStudyHints.map((item) => (
                <MathText as="div" key={item} text={item} />
              ))}
            </div>
          ) : null}

          {answer.nextPrompt ? (
            <div className="status-note info" style={{ marginBottom: 12 }}>
              下一步：{answer.nextPrompt}
            </div>
          ) : null}

          {!answer.answer.trim() ? (
            <div className="card" style={{ marginBottom: 12, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div className="section-title">我的当前思路</div>
                <textarea
                  value={studyThinking}
                  onChange={(event) => onStudyThinkingChange(event.target.value)}
                  rows={3}
                  placeholder="先说说你会怎么下手，系统会按你的思路继续追问。"
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
              <div className="cta-row">
                <button className="button secondary" type="button" onClick={onSubmitStudyThinking} disabled={loading || !studyThinking.trim()}>
                  {activeAction === "study" ? "提交中..." : "提交我的思路"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={onIncreaseStudyHintCount}
                  disabled={loading || studyHintCount >= (answer.hints?.length ?? 0)}
                >
                  再给我一点提示
                </button>
                <button className="button ghost" type="button" onClick={onRevealStudyAnswer} disabled={loading || !answer.answerAvailable}>
                  {answer.revealAnswerCta ?? "查看完整讲解"}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        <div className="badge">识别到的题目 / 可编辑后再{studyResult ? "开始学习模式" : "求解"}</div>
        <textarea
          value={editableQuestion}
          onChange={(event) => onEditableQuestionChange(event.target.value)}
          rows={4}
          placeholder="识别后的题目会显示在这里，你可以手动修正后重新求解。"
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
        />
      </label>

      <div className="cta-row" style={{ marginBottom: 12 }}>
        <button className="button secondary" onClick={onRefineSolve} disabled={loading || !editableQuestion.trim()}>
          {activeAction === "refine" ? "处理中..." : studyResult ? "按编辑题目重新开始学习模式" : "按编辑题目重新求解"}
        </button>
        <button className="button secondary" onClick={onSyncEditableQuestion} disabled={!editableQuestion.trim()}>
          同步到提问框
        </button>
        <button className="button secondary" onClick={onCopyEditableQuestion}>
          复制题目
        </button>
        <button className="button secondary" onClick={onCopyAnswer} disabled={!answer.answer.trim()}>
          复制答案
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={onLoadVariants}
          disabled={loading || loadingVariants || !canLoadVariants || Boolean(variantPack?.variants?.length)}
        >
          {loadingVariants ? "生成变式中..." : variantPack?.variants?.length ? "变式已生成" : "做变式巩固"}
        </button>
      </div>

      {answer.answer.trim() ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="section-title">一键同步给老师 / 家长</div>
          <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 6 }}>
            将题目、答案、关键步骤和可信度同步到站内信，方便老师继续答疑或家长及时跟进。
          </div>

          {shareTargetsLoading && !shareTargetsLoaded ? (
            <div className="status-note info" style={{ marginTop: 10 }}>
              正在加载可分享对象...
            </div>
          ) : null}

          {shareTargetsLoaded && !shareTargets.length && shareTargetsLoadError ? (
            <div style={{ marginTop: 12 }}>
              <StatePanel
                compact
                tone="error"
                title="可分享对象加载失败"
                description={shareTargetsLoadError}
                action={
                  <button className="button secondary" type="button" onClick={onReloadShareTargets} disabled={shareTargetsLoading}>
                    {shareTargetsLoading ? "重试中..." : "重试"}
                  </button>
                }
              />
            </div>
          ) : null}

          {shareTargetsLoaded && !shareTargets.length && !shareTargetsLoadError ? (
            <div style={{ marginTop: 12 }}>
              <StatePanel
                compact
                tone="info"
                title="当前没有可分享对象"
                description="加入班级或绑定家长后，这里会自动开放老师 / 家长分享。"
              />
            </div>
          ) : null}

          {teacherShareTargets.length ? (
            <div className="grid" style={{ gap: 8, marginTop: 12 }}>
              <div className="badge">发给老师</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                {teacherShareTargets.map((target) => {
                  const submitting = shareSubmittingTargetId === target.id;
                  return (
                    <button
                      key={target.id}
                      type="button"
                      className="button secondary"
                      onClick={() => onShareResult(target)}
                      disabled={loading || Boolean(shareSubmittingTargetId)}
                      style={{ minHeight: 56, justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" }}
                    >
                      <span style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontWeight: 600 }}>{submitting ? "发送中..." : getShareTargetActionLabel(target)}</span>
                        <span style={{ fontSize: 12, color: "var(--ink-1)" }}>
                          {target.description}
                          {target.contextLabels.length ? ` · ${target.contextLabels.join("、")}` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {parentShareTargets.length ? (
            <div className="grid" style={{ gap: 8, marginTop: 12 }}>
              <div className="badge">发给家长</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                {parentShareTargets.map((target) => {
                  const submitting = shareSubmittingTargetId === target.id;
                  return (
                    <button
                      key={target.id}
                      type="button"
                      className="button secondary"
                      onClick={() => onShareResult(target)}
                      disabled={loading || Boolean(shareSubmittingTargetId)}
                      style={{ minHeight: 56, justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" }}
                    >
                      <span style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontWeight: 600 }}>{submitting ? "发送中..." : getShareTargetActionLabel(target)}</span>
                        <span style={{ fontSize: 12, color: "var(--ink-1)" }}>{target.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {shareError ? (
            <div className="status-note error" style={{ marginTop: 10 }}>
              {shareError}
            </div>
          ) : null}

          {shareSuccess ? (
            <>
              <div className="status-note success" style={{ marginTop: 10 }}>
                已{shareSuccess.reused ? "继续" : ""}发送给 {shareSuccess.targetName}，可前往站内信继续沟通。
              </div>
              <div className="cta-row" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => onOpenShareThread(shareSuccess.threadId)}
                >
                  查看站内信
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : studyResult ? (
        <div className="status-note info" style={{ marginBottom: 12 }}>
          当前仍在学习模式中，答案未揭晓前不会开放分享，避免把完整解法过早发出去。
        </div>
      ) : null}

      {answer.answer.trim() ? (
        <div className="grid" style={{ gap: 8 }}>
          <div className="badge">答案</div>
          <MathText as="div" text={answer.answer} />
        </div>
      ) : studyResult ? (
        <div className="status-note info">答案当前仍保持锁定。先完成思路表达和知识检查，需要时再揭晓完整讲解。</div>
      ) : null}

      {studyResult && answer.answer.trim() && answer.steps?.length ? (
        <div className="grid" style={{ gap: 6, marginTop: 12 }}>
          <div className="badge">完整讲解步骤</div>
          {answer.steps.map((item) => (
            <MathText as="div" key={`study-step-${item}`} text={item} />
          ))}
        </div>
      ) : null}

      {!studyResult
        ? answerSections.map((section) =>
            section.items.length ? (
              <div key={section.key} className="grid" style={{ gap: 6, marginTop: 12 }}>
                <div className="badge">{section.title}</div>
                {section.items.map((item) => (
                  <MathText as="div" key={`${section.key}-${item}`} text={item} />
                ))}
              </div>
            ) : null
          )
        : null}

      {variantPack ? (
        <div className="card" style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div className="section-title">迁移巩固</div>
            <div className="pill-list">
              {variantPack.knowledgePointTitle ? <span className="pill">{variantPack.knowledgePointTitle}</span> : null}
              <span className="pill">
                {variantPack.sourceMode === "pool" ? "题库变式" : variantPack.sourceMode === "fallback" ? "概念迁移题" : "AI 变式"}
              </span>
            </div>
          </div>
          <div className="status-note info">{variantPack.transferGoal}</div>
          <div className="grid" style={{ gap: 10 }}>
            {variantPack.variants.map((variant, index) => {
              const selected = variantAnswers[index] ?? "";
              const checked = variantResults[index];
              return (
                <div className="card" key={`${variant.stem}-${index}`}>
                  <div className="badge">变式题 {index + 1}</div>
                  <div style={{ marginTop: 8 }}>
                    <MathText as="div" text={variant.stem} />
                  </div>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {variant.options.map((option) => (
                      <label
                        key={`${variant.stem}-${option}`}
                        className="card"
                        style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", minHeight: 44 }}
                      >
                        <input
                          type="radio"
                          name={`tutor-variant-${index}`}
                          checked={selected === option}
                          onChange={() => onVariantAnswerChange(index, option)}
                          style={{ marginTop: 4 }}
                        />
                        <MathText as="div" text={option} />
                      </label>
                    ))}
                  </div>
                  <div className="cta-row" style={{ marginTop: 10 }}>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => onVariantSubmit(index, selected, variant.answer)}
                      disabled={
                        !selected ||
                        savingVariantProgressIndex !== null ||
                        (variantCommittedAnswers[index] === selected && checked !== undefined && checked !== null)
                      }
                    >
                      {savingVariantProgressIndex === index ? "计入成长中..." : "提交本题"}
                    </button>
                  </div>
                  {checked !== undefined && checked !== null ? (
                    <div className={`status-note ${checked ? "success" : "info"}`} style={{ marginTop: 10 }}>
                      {checked ? "回答正确" : "回答错误"} · 正确答案：{variant.answer}
                    </div>
                  ) : null}
                  {checked !== undefined && checked !== null ? (
                    <div style={{ marginTop: 8 }}>
                      <MathText as="div" text={variant.explanation} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="cta-row">
            <button
              className="button secondary"
              type="button"
              onClick={onLoadVariantReflection}
              disabled={!submittedVariantCount || loadingVariantReflection}
            >
              {loadingVariantReflection ? "生成复盘中..." : variantReflection ? "更新学习复盘" : "生成学习复盘"}
            </button>
            <span style={{ fontSize: 12, color: "var(--ink-1)" }}>
              已提交 {submittedVariantCount}/{variantPack.variants.length} 题
            </span>
          </div>
          {loadingVariantReflection ? (
            <div className="status-note info">系统正在汇总这轮迁移表现，并补出重点错因与下一步建议。</div>
          ) : null}
          {variantProgress ? (
            <div className="card" style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div className="section-title">学习成长更新</div>
                <div className="pill-list">
                  <span className="pill">{variantProgress.persisted ? "已计入成长" : "未计入成长"}</span>
                  {variantProgress.mastery ? <span className="pill">掌握 {variantProgress.mastery.masteryScore}</span> : null}
                  {variantProgress.mastery && typeof variantProgress.mastery.weaknessRank === "number" ? (
                    <span className="pill">薄弱度第 {variantProgress.mastery.weaknessRank} 位</span>
                  ) : null}
                </div>
              </div>
              <div className={`status-note ${variantProgress.persisted ? "success" : "info"}`}>{variantProgress.message}</div>
              {variantProgress.mastery ? (
                <div className="pill-list">
                  <span className="pill">
                    变化 {variantProgress.mastery.masteryDelta > 0 ? "+" : ""}
                    {variantProgress.mastery.masteryDelta}
                  </span>
                  <span className="pill">信心 {variantProgress.mastery.confidenceScore}</span>
                  <span className="pill">
                    7日趋势 {variantProgress.mastery.masteryTrend7d > 0 ? "+" : ""}
                    {variantProgress.mastery.masteryTrend7d}
                  </span>
                  <span className="pill">
                    作答 {variantProgress.mastery.correct}/{variantProgress.mastery.total}
                  </span>
                </div>
              ) : null}
              {variantProgress.plan ? (
                <div className="card" style={{ display: "grid", gap: 6 }}>
                  <div className="badge">计划联动</div>
                  <div>
                    该知识点已同步到学习计划：目标 {variantProgress.plan.targetCount} 题，截止{" "}
                    {new Date(variantProgress.plan.dueDate).toLocaleDateString("zh-CN")}。
                  </div>
                  <div style={{ color: "var(--ink-1)", fontSize: 13 }}>推荐理由：{variantProgress.plan.recommendedReason}</div>
                </div>
              ) : null}
            </div>
          ) : null}
          {variantReflection ? (
            <div className="card" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div className="section-title">学习复盘</div>
                <div className="pill-list">
                  <span className="pill">{variantReflection.masteryLabel}</span>
                  <span className="pill">
                    正确 {variantReflection.correctCount}/{variantReflection.total}
                  </span>
                  <span className="pill">{variantReflection.detailSource === "ai" ? "AI 错因解释" : "规则兜底复盘"}</span>
                </div>
              </div>
              <div className={`status-note ${variantReflection.masteryLevel === "secure" ? "success" : "info"}`}>
                {variantReflection.summary}
              </div>
              {variantReflection.strengths.length ? (
                <div className="grid" style={{ gap: 6 }}>
                  <div className="badge">这次做对了什么</div>
                  {variantReflection.strengths.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              ) : null}
              {variantReflection.improvements.length ? (
                <div className="grid" style={{ gap: 6 }}>
                  <div className="badge">还要补哪里</div>
                  {variantReflection.improvements.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              ) : null}
              <div className="card" style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div className="badge">{variantReflection.detail.title}</div>
                  {variantReflection.detail.variantStem ? (
                    <span className="pill">聚焦：{truncateText(variantReflection.detail.variantStem, 28)}</span>
                  ) : null}
                </div>
                <MathText as="div" text={variantReflection.detail.analysis} />
                {variantReflection.detail.hints.length ? (
                  <div className="grid" style={{ gap: 6 }}>
                    {variantReflection.detail.hints.map((hint) => (
                      <MathText as="div" key={hint} text={hint} />
                    ))}
                  </div>
                ) : null}
              </div>
              {variantReflection.nextSteps.length ? (
                <div className="grid" style={{ gap: 6 }}>
                  <div className="badge">下一步怎么练</div>
                  {variantReflection.nextSteps.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {answer.source?.length ? (
        <div className="grid" style={{ gap: 6, marginTop: 12 }}>
          <div className="badge">参考来源</div>
          <div className="pill-list">
            {answer.source.map((item) => (
              <span className="pill" key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
