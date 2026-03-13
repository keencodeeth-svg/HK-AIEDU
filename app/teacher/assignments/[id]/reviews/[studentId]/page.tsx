"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import MathViewControls from "@/components/MathViewControls";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useMathViewSettings } from "@/lib/math-view-settings";
import AssignmentReviewAiCard from "./_components/AssignmentReviewAiCard";
import AssignmentReviewExecutionLoopCard from "./_components/AssignmentReviewExecutionLoopCard";
import AssignmentReviewFormCard from "./_components/AssignmentReviewFormCard";
import AssignmentReviewOverviewCard from "./_components/AssignmentReviewOverviewCard";
import AssignmentReviewSubmissionTextCard from "./_components/AssignmentReviewSubmissionTextCard";
import AssignmentReviewUploadsCard from "./_components/AssignmentReviewUploadsCard";
import type {
  TeacherAssignmentAiReviewResult,
  TeacherAssignmentReviewData,
  TeacherAssignmentReviewItemState,
  TeacherAssignmentReviewRubricState
} from "./types";
import { buildReviewItemState, buildReviewRubricState } from "./utils";

export default function TeacherAssignmentReviewPage({
  params
}: {
  params: { id: string; studentId: string };
}) {
  const [data, setData] = useState<TeacherAssignmentReviewData | null>(null);
  const [overallComment, setOverallComment] = useState("");
  const [itemState, setItemState] = useState<TeacherAssignmentReviewItemState>({});
  const [rubricState, setRubricState] = useState<TeacherAssignmentReviewRubricState>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReview, setAiReview] = useState<TeacherAssignmentAiReviewResult | null>(null);
  const mathView = useMathViewSettings("teacher-assignment-review");

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetch(`/api/teacher/assignments/${params.id}/reviews/${params.studentId}`);
    const payload = (await res.json()) as TeacherAssignmentReviewData & { error?: string };
    if (!res.ok) {
      setLoadError(payload.error ?? "加载失败");
      return;
    }
    setData(payload);
    setOverallComment(payload.review?.overallComment ?? "");
    setItemState(buildReviewItemState(payload.reviewItems ?? []));
    setRubricState(buildReviewRubricState(payload.reviewRubrics ?? [], payload.rubrics ?? []));
    setAiReview(payload.aiReview?.result ?? null);
  }, [params.id, params.studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const wrongQuestions = useMemo(
    () => (data?.questions ?? []).filter((item) => !item.correct),
    [data]
  );
  const canAiReview =
    (data?.uploads?.length ?? 0) > 0 || Boolean(data?.submission?.submissionText?.trim());
  const isEssay = data?.assignment?.submissionType === "essay";
  const isUpload = data?.assignment?.submissionType === "upload";
  const isQuiz = !isEssay && !isUpload;

  async function handleAiReview() {
    if (!data) return;
    setAiLoading(true);
    setAiError(null);
    const res = await fetch(`/api/teacher/assignments/${params.id}/ai-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: params.studentId })
    });
    const payload = (await res.json()) as {
      error?: string;
      data?: {
        result?: TeacherAssignmentAiReviewResult | null;
      } | null;
    };
    if (!res.ok) {
      setAiError(payload.error ?? "AI 批改失败");
      setAiLoading(false);
      return;
    }
    setAiReview(payload.data?.result ?? null);
    setAiLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setSaving(true);
    setMessage(null);
    setSaveError(null);
    const items = wrongQuestions.map((question) => ({
      questionId: question.id,
      wrongTag: itemState[question.id]?.wrongTag || "",
      comment: itemState[question.id]?.comment || ""
    }));
    const rubrics = data.rubrics.map((rubric) => ({
      rubricId: rubric.id,
      score: rubricState[rubric.id]?.score ?? 0,
      comment: rubricState[rubric.id]?.comment ?? ""
    }));
    const res = await fetch(`/api/teacher/assignments/${params.id}/reviews/${params.studentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overallComment, items, rubrics })
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setSaveError(payload.error ?? "保存失败");
      setSaving(false);
      return;
    }
    setMessage("批改已保存并通知学生。");
    setSaving(false);
  }

  function handleQuestionWrongTagChange(questionId: string, value: string) {
    setItemState((prev) => ({
      ...prev,
      [questionId]: {
        wrongTag: value,
        comment: prev[questionId]?.comment ?? ""
      }
    }));
  }

  function handleQuestionCommentChange(questionId: string, value: string) {
    setItemState((prev) => ({
      ...prev,
      [questionId]: {
        wrongTag: prev[questionId]?.wrongTag ?? "",
        comment: value
      }
    }));
  }

  function handleRubricScoreChange(rubricId: string, value: number) {
    setRubricState((prev) => ({
      ...prev,
      [rubricId]: {
        score: value,
        comment: prev[rubricId]?.comment ?? ""
      }
    }));
  }

  function handleRubricCommentChange(rubricId: string, value: string) {
    setRubricState((prev) => ({
      ...prev,
      [rubricId]: {
        score: prev[rubricId]?.score ?? 0,
        comment: value
      }
    }));
  }

  if (loadError && !data) {
    return (
      <Card title="作业批改">
        <StatePanel
          compact
          tone="error"
          title="作业批改加载失败"
          description={loadError}
          action={
            <Link className="button secondary" href={`/teacher/assignments/${params.id}`}>
              返回作业详情
            </Link>
          }
        />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card title="作业批改">
        <StatePanel
          compact
          tone="loading"
          title="作业批改加载中"
          description="正在同步学生提交内容、AI 结果和 rubric。"
        />
      </Card>
    );
  }

  const uploadCount = data.uploads?.length ?? 0;
  const hasSubmissionText = Boolean(data.submission?.submissionText?.trim());
  const evidenceCount = uploadCount + (hasSubmissionText ? 1 : 0);

  return (
    <div className="grid math-view-surface" style={{ gap: 18, ...mathView.style }}>
      <div className="section-head">
        <div>
          <h2>作业批改</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">学生：{data.student.name}</span>
          <span className="chip">错题 {wrongQuestions.length}</span>
          <span className="chip">素材 {evidenceCount}</span>
          <span className="chip">Rubric {data.rubrics.length}</span>
          {aiReview ? <span className="chip">AI 已生成</span> : canAiReview ? <span className="chip">可生成 AI</span> : null}
          {message ? <span className="chip">已保存</span> : null}
        </div>
      </div>

      <MathViewControls
        fontScale={mathView.fontScale}
        lineMode={mathView.lineMode}
        onDecrease={mathView.decreaseFontScale}
        onIncrease={mathView.increaseFontScale}
        onReset={mathView.resetView}
        onLineModeChange={mathView.setLineMode}
      />

      <AssignmentReviewExecutionLoopCard
        assignment={data.assignment}
        student={data.student}
        wrongQuestionsCount={wrongQuestions.length}
        uploadCount={uploadCount}
        hasSubmissionText={hasSubmissionText}
        hasAiReview={Boolean(aiReview)}
        canAiReview={canAiReview}
        saveMessage={message}
        backHref={`/teacher/assignments/${params.id}`}
      />

      <div className="review-top-grid">
        <AssignmentReviewOverviewCard
          assignment={data.assignment}
          submission={data.submission}
          wrongQuestionsCount={wrongQuestions.length}
          isQuiz={isQuiz}
          backHref={`/teacher/assignments/${params.id}`}
        />

        <Card title="批改工作台" tag="Desk">
          <div className="grid grid-2">
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">复盘重点</div>
              <div className="workflow-summary-value">{wrongQuestions.length}</div>
              <div className="workflow-summary-helper">
                {isQuiz ? "错误题目数量" : isEssay ? "重点看结构、语言和立意" : "重点看附件与文字说明"}
              </div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">证据素材</div>
              <div className="workflow-summary-value">{evidenceCount}</div>
              <div className="workflow-summary-helper">附件与文本说明可交叉验证</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">评分维度</div>
              <div className="workflow-summary-value">{data.rubrics.length}</div>
              <div className="workflow-summary-helper">
                {data.rubrics.length ? "人工评分会自动对齐 rubric" : "当前没有 rubric，直接写总体点评"}
              </div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">当前状态</div>
              <div className="workflow-summary-value">{message ? "已保存" : "待定稿"}</div>
              <div className="workflow-summary-helper">
                {saveError ? "保存失败，需要重新提交" : aiError ? "AI 生成失败，但不影响人工批改" : "保存后会通知学生"}
              </div>
            </div>
          </div>

          <div className="pill-list" style={{ marginTop: 12 }}>
            <span className="pill">AI {aiReview ? "已生成" : canAiReview ? "可用" : "不可用"}</span>
            <span className="pill">提交文本 {hasSubmissionText ? "有" : "无"}</span>
            <span className="pill">附件 {uploadCount} 份</span>
          </div>

          <div className="meta-text" style={{ marginTop: 12 }}>
            当前页面已经把证据、AI 和表单拆成同层结构。先看证据，再形成判断，最后保存，不需要在长页面里来回找。
          </div>
        </Card>
      </div>

      <div id="review-evidence" className="review-evidence-grid">
        {data.uploads?.length ? <AssignmentReviewUploadsCard uploads={data.uploads} /> : null}

        {hasSubmissionText ? (
          <AssignmentReviewSubmissionTextCard text={data.submission?.submissionText ?? ""} isEssay={isEssay} />
        ) : null}

        <AssignmentReviewAiCard
          aiLoading={aiLoading}
          canAiReview={canAiReview}
          aiReview={aiReview}
          error={aiError}
          onGenerate={handleAiReview}
        />
      </div>

      <div id="review-form">
        <AssignmentReviewFormCard
          isQuiz={isQuiz}
          isEssay={isEssay}
          wrongQuestions={wrongQuestions}
          overallComment={overallComment}
          itemState={itemState}
          rubricState={rubricState}
          rubrics={data.rubrics}
          saving={saving}
          message={message}
          error={saveError}
          onSubmit={handleSubmit}
          onOverallCommentChange={setOverallComment}
          onQuestionWrongTagChange={handleQuestionWrongTagChange}
          onQuestionCommentChange={handleQuestionCommentChange}
          onRubricScoreChange={handleRubricScoreChange}
          onRubricCommentChange={handleRubricCommentChange}
        />
      </div>
    </div>
  );
}
