"use client";

import Link from "next/link";
import Card from "@/components/Card";
import MathViewControls from "@/components/MathViewControls";
import StatePanel from "@/components/StatePanel";
import PracticeGuideCard from "./_components/PracticeGuideCard";
import PracticeMobileActionBar from "./_components/PracticeMobileActionBar";
import PracticeQuestionCard from "./_components/PracticeQuestionCard";
import PracticeResultCard from "./_components/PracticeResultCard";
import PracticeSettingsCard from "./_components/PracticeSettingsCard";
import { PracticeVariantAnalysisCard, PracticeVariantTrainingCard } from "./_components/PracticeVariantCards";
import { PRACTICE_MODE_LABELS } from "./config";
import { usePracticePage } from "./usePracticePage";

export default function PracticePage() {
  const practicePage = usePracticePage();

  if (practicePage.authRequired) {
    return (
      <StatePanel
        title="请先登录后开始练习"
        description="登录后即可获取题目、提交答案、查看 AI 讲解和收藏练习。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid math-view-surface practice-page" style={{ gap: 18, ...practicePage.mathView.style }}>
      <div className="section-head">
        <div>
          <h2>智能练习</h2>
          <div className="section-sub">个性化练习 + AI 讲解 + 变式训练。</div>
        </div>
        <span className="chip">{PRACTICE_MODE_LABELS[practicePage.mode] ?? "练习模式"}</span>
      </div>
      <MathViewControls
        fontScale={practicePage.mathView.fontScale}
        lineMode={practicePage.mathView.lineMode}
        onDecrease={practicePage.mathView.decreaseFontScale}
        onIncrease={practicePage.mathView.increaseFontScale}
        onReset={practicePage.mathView.resetView}
        onLineModeChange={practicePage.mathView.setLineMode}
      />

      <PracticeGuideCard visible={practicePage.showPracticeGuide} onHide={practicePage.hidePracticeGuide} onShow={practicePage.showPracticeGuideAgain} />

      {practicePage.knowledgePointsError ? (
        <StatePanel
          title="知识点列表同步失败"
          description={practicePage.knowledgePointsError}
          tone="error"
          compact
          action={
            <button className="button secondary" type="button" onClick={practicePage.reloadKnowledgePoints}>
              重试
            </button>
          }
        />
      ) : null}

      <div id="practice-settings">
        <PracticeSettingsCard
          subject={practicePage.subject}
          grade={practicePage.grade}
          mode={practicePage.mode}
          knowledgeSearch={practicePage.knowledgeSearch}
          knowledgePointId={practicePage.knowledgePointId}
          groupedKnowledgePoints={practicePage.groupedKnowledgePoints}
          filteredKnowledgePointsCount={practicePage.filteredKnowledgePointsCount}
          filteredCount={practicePage.filteredCount}
          selectedKnowledgeTitle={practicePage.selectedKnowledgeTitle}
          error={practicePage.error}
          autoFixHint={practicePage.autoFixHint}
          autoFixing={practicePage.autoFixing}
          questionLoading={practicePage.questionLoading}
          submitting={practicePage.submitting}
          questionVisible={Boolean(practicePage.question)}
          resultVisible={Boolean(practicePage.result)}
          stageTitle={practicePage.stageTitle}
          stageDescription={practicePage.stageDescription}
          timeLeft={practicePage.timeLeft}
          challengeCount={practicePage.challengeCount}
          challengeCorrect={practicePage.challengeCorrect}
          onSubjectChange={practicePage.setSubject}
          onGradeChange={practicePage.setGrade}
          onModeChange={practicePage.handleModeChange}
          onKnowledgeSearchChange={practicePage.setKnowledgeSearch}
          onKnowledgePointChange={practicePage.setKnowledgePointId}
          onLoadQuestion={practicePage.loadQuestion}
          onQuickFix={practicePage.applyPracticeQuickFix}
        />
      </div>

      {practicePage.question ? (
        <div id="practice-question" ref={practicePage.questionCardRef}>
          <PracticeQuestionCard
            question={practicePage.question}
            answer={practicePage.answer}
            favorite={practicePage.favorite}
            favoriteLoading={practicePage.favoriteLoading}
            canSubmit={practicePage.canSubmitCurrentQuestion}
            questionLoading={practicePage.questionLoading}
            submitting={practicePage.submitting}
            onAnswerChange={practicePage.setAnswer}
            onToggleFavorite={practicePage.toggleFavorite}
            onEditFavoriteTags={practicePage.editFavoriteTags}
            onLoadQuestion={practicePage.loadQuestion}
            onSubmit={practicePage.submitAnswer}
          />
        </div>
      ) : null}

      {practicePage.result ? (
        <div id="practice-result" ref={practicePage.resultCardRef}>
          <PracticeResultCard
            result={practicePage.result}
            explainMode={practicePage.explainMode}
            explainPack={practicePage.explainPack}
            explainLoading={practicePage.explainLoading}
            loadingVariants={practicePage.loadingVariants}
            questionLoading={practicePage.questionLoading}
            hasVariants={Boolean(practicePage.variantPack?.variants?.length)}
            onExplainModeChange={practicePage.setExplainMode}
            onLoadVariants={practicePage.loadVariants}
            onLoadNextQuestion={practicePage.loadQuestion}
          />
        </div>
      ) : null}

      {practicePage.variantPack ? <PracticeVariantAnalysisCard variantPack={practicePage.variantPack} /> : null}

      {practicePage.variantPack?.variants?.length ? (
        <PracticeVariantTrainingCard
          variantPack={practicePage.variantPack}
          variantAnswers={practicePage.variantAnswers}
          variantResults={practicePage.variantResults}
          onAnswerChange={(index, value) =>
            practicePage.setVariantAnswers((prev) => ({
              ...prev,
              [index]: value
            }))
          }
          onSubmit={(index, selected, correctAnswer) =>
            practicePage.setVariantResults((prev) => ({
              ...prev,
              [index]: selected === correctAnswer
            }))
          }
        />
      ) : null}

      {practicePage.mode === "challenge" && practicePage.challengeCount >= 5 ? (
        <Card title="闯关结果" tag="成果">
          <p className="practice-challenge-result">本次闯关正确 {practicePage.challengeCorrect} / 5</p>
          <button className="button secondary" type="button" onClick={practicePage.resetChallenge}>
            再来一次
          </button>
        </Card>
      ) : null}

      <PracticeMobileActionBar
        questionVisible={Boolean(practicePage.question)}
        resultVisible={Boolean(practicePage.result)}
        canSubmit={practicePage.canSubmitCurrentQuestion}
        timedMode={practicePage.mode === "timed"}
        busy={practicePage.stageBusy}
        loadingVariants={practicePage.loadingVariants}
        hasVariants={Boolean(practicePage.variantPack?.variants?.length)}
        onLoadQuestion={practicePage.loadQuestion}
        onSubmit={practicePage.submitAnswer}
        onLoadVariants={practicePage.loadVariants}
      />
    </div>
  );
}
