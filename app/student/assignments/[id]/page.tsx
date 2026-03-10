"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import MathViewControls from "@/components/MathViewControls";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useMathViewSettings } from "@/lib/math-view-settings";
import AssignmentAiReviewCard from "./_components/AssignmentAiReviewCard";
import AssignmentOverviewCard from "./_components/AssignmentOverviewCard";
import AssignmentQuizResultCard from "./_components/AssignmentQuizResultCard";
import AssignmentRubricsCard from "./_components/AssignmentRubricsCard";
import AssignmentSubmissionCard from "./_components/AssignmentSubmissionCard";
import AssignmentTeacherReviewCard from "./_components/AssignmentTeacherReviewCard";
import AssignmentWrongQuestionsCard from "./_components/AssignmentWrongQuestionsCard";
import type { AssignmentDetail, AssignmentReviewPayload, SubmitResult, UploadItem } from "./types";

async function readJsonSafe(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function StudentAssignmentDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [review, setReview] = useState<AssignmentReviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingUploadId, setDeletingUploadId] = useState<string | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const mathView = useMathViewSettings("student-assignment");
  const feedbackSectionRef = useRef<HTMLDivElement | null>(null);

  const loadUploads = useCallback(async () => {
    const res = await fetch(`/api/student/assignments/${params.id}/uploads`);
    const payload = await readJsonSafe(res);
    if (!res.ok) {
      throw new Error(payload?.error ?? "上传记录加载失败");
    }
    setUploads(Array.isArray(payload?.data) ? payload.data : []);
  }, [params.id]);

  const load = useCallback(async () => {
    setLoadError(null);

    try {
      const res = await fetch(`/api/student/assignments/${params.id}`);
      const payload = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(payload?.error ?? "加载失败");
      }

      setData(payload);
      setActionError(null);
      setActionMessage(null);

      if (payload?.progress?.status === "completed") {
        const reviewRes = await fetch(`/api/student/assignments/${params.id}/review`);
        const reviewPayload = await readJsonSafe(reviewRes);
        if (reviewRes.ok) {
          setReview(reviewPayload);
        } else {
          setReview(null);
        }
      } else {
        setReview(null);
      }

      if (payload?.assignment?.submissionType === "upload" || payload?.assignment?.submissionType === "essay") {
        try {
          await loadUploads();
        } catch (error) {
          setActionError(error instanceof Error ? error.message : "上传记录加载失败");
        }
      } else {
        setUploads([]);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "加载失败");
    }
  }, [loadUploads, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (result) {
      feedbackSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) return;

    setUploading(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const res = await fetch(`/api/student/assignments/${params.id}/uploads`, {
        method: "POST",
        body: formData
      });
      const payload = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(payload?.error ?? "上传失败");
      }

      await loadUploads();
      const savedCount = Array.isArray(payload?.data) ? payload.data.length : files.length;
      setActionMessage(`已上传 ${savedCount} 份文件，确认后即可提交。`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleDeleteUpload(uploadId: string) {
    setDeletingUploadId(uploadId);
    setActionError(null);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/student/assignments/${params.id}/uploads?uploadId=${uploadId}`, { method: "DELETE" });
      const payload = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(payload?.error ?? "删除失败");
      }

      await loadUploads();
      setActionMessage("已删除上传文件，可重新上传后再提交。");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeletingUploadId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/student/assignments/${params.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, submissionText })
      });
      const payload = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(payload?.error ?? "提交失败");
      }

      setResult(payload);
      setData((previous) =>
        previous
          ? {
              ...previous,
              progress: {
                ...(previous.progress ?? {}),
                status: "completed",
                score: payload?.score,
                total: payload?.total
              }
            }
          : previous
      );

      const reviewRes = await fetch(`/api/student/assignments/${params.id}/review`);
      const reviewPayload = await readJsonSafe(reviewRes);
      if (reviewRes.ok) {
        setReview(reviewPayload);
      }

      setActionMessage("提交成功，已为你定位到下方结果与反馈区。");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  function handleAnswerChange(questionId: string, value: string) {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
  }

  if (loadError && !data) {
    return (
      <StatePanel
        tone="error"
        title="作业详情暂时不可用"
        description={loadError}
        action={
          <div className="cta-row">
            <button className="button secondary" type="button" onClick={() => void load()}>
              重新加载
            </button>
            <Link className="button ghost" href="/student/assignments">
              返回作业中心
            </Link>
          </div>
        }
      />
    );
  }

  if (!data) {
    return (
      <StatePanel
        tone="loading"
        title="作业详情加载中"
        description="正在同步题目、提交要求和老师反馈。"
      />
    );
  }

  const alreadyCompleted = data.progress?.status === "completed" && !result;
  const isUpload = data.assignment.submissionType === "upload";
  const isEssay = data.assignment.submissionType === "essay";
  const isQuiz = !isUpload && !isEssay;
  const maxUploads = data.assignment.maxUploads ?? 3;
  const hasUploads = uploads.length > 0;
  const hasText = Boolean(submissionText.trim());
  const answeredCount = data.questions.reduce((count, question) => (answers[question.id] ? count + 1 : count), 0);
  const canSubmit = alreadyCompleted
    ? false
    : isUpload
      ? hasUploads
      : isEssay
        ? hasUploads || hasText
        : data.questions.length > 0 && answeredCount === data.questions.length;
  const hasFeedbackContent = Boolean(
    result || review?.review || review?.rubrics?.length || review?.aiReview || (review?.questions?.length && isQuiz)
  );

  const stageCopy = (() => {
    if (result) {
      return {
        title: isQuiz ? "提交成功，先看结果再订正" : "提交成功，等待老师批改",
        description: hasFeedbackContent
          ? "系统已自动定位到下方反馈区，你可以直接查看得分、解析和老师点评。"
          : "作业已经提交完成，老师批改后会在本页继续显示反馈。"
      };
    }

    if (alreadyCompleted) {
      return {
        title: review ? "已完成，可直接查看反馈" : "已提交，等待老师反馈",
        description: review
          ? "这份作业已经完成，下方保留了老师点评与 AI 复盘，不需要重复作答。"
          : "这份作业已经提交成功，当前不需要再次上传或作答。"
      };
    }

    if (isUpload) {
      return hasUploads
        ? {
            title: `已上传 ${uploads.length}/${maxUploads} 份文件，可以提交`,
            description: "确认文件完整后直接提交即可；如果传错了，可以先删除再补传。"
          }
        : {
            title: "先上传作业文件",
            description: "这份作业需要先上传图片或 PDF，上传完成后才能提交。"
          };
    }

    if (isEssay) {
      return hasUploads || hasText
        ? {
            title: "内容已准备好，可以提交",
            description: hasUploads
              ? "你已经上传了作业图片，也可以继续补充作文正文或备注。"
              : "你已经填写了文字内容，如有手写稿可继续上传图片补充。"
          }
        : {
            title: "先输入作文内容或上传图片",
            description: "作文类作业支持纯文字提交，也支持补充图片；两者有其一即可提交。"
          };
    }

    if (answeredCount === 0) {
      return {
        title: "先完成题目作答",
        description: "建议先把整份作业做完，再统一提交查看得分与解析。"
      };
    }

    if (answeredCount < data.questions.length) {
      return {
        title: `已完成 ${answeredCount}/${data.questions.length} 题`,
        description: "还差几题没选答案，补齐后提交能一次看到完整结果和错因解析。"
      };
    }

    return {
      title: "答案已完成，可以提交",
      description: "提交后会立即生成成绩与解析，下方还会同步老师点评和 AI 复盘。"
    };
  })();

  const statusLabel = result ? "已提交" : alreadyCompleted ? "已完成" : canSubmit ? "待提交" : "进行中";

  return (
    <div className="grid math-view-surface" style={{ gap: 18, ...mathView.style }}>
      <div className="section-head">
        <div>
          <h2>作业详情</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <div className="pill-list">
          <span className="chip">{statusLabel}</span>
          {data.lessonLink ? <span className="chip">课前预习</span> : null}
          <span className="chip">截止 {new Date(data.assignment.dueDate).toLocaleDateString("zh-CN")}</span>
        </div>
      </div>
      {data.lessonLink ? (
        <div className="card">
          <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div className="section-title">这是一份课前预习任务</div>
              <div className="section-sub" style={{ marginTop: 4 }}>
                {data.lessonLink.lessonDate}
                {data.lessonLink.startTime && data.lessonLink.endTime ? ` · ${data.lessonLink.startTime}-${data.lessonLink.endTime}` : ""}
                {data.lessonLink.slotLabel ? ` · ${data.lessonLink.slotLabel}` : ""}
                {data.lessonLink.room ? ` · ${data.lessonLink.room}` : ""}
              </div>
            </div>
            <Link className="button ghost" href="/calendar">
              回到课程表
            </Link>
          </div>
          {data.lessonLink.focusSummary ? <div className="meta-text" style={{ marginTop: 8 }}>课堂焦点：{data.lessonLink.focusSummary}</div> : null}
          {data.lessonLink.note ? <div className="meta-text" style={{ marginTop: 6 }}>老师提醒：{data.lessonLink.note}</div> : null}
        </div>
      ) : null}

      <MathViewControls
        fontScale={mathView.fontScale}
        lineMode={mathView.lineMode}
        onDecrease={mathView.decreaseFontScale}
        onIncrease={mathView.increaseFontScale}
        onReset={mathView.resetView}
        onLineModeChange={mathView.setLineMode}
      />

      <AssignmentOverviewCard data={data} isUpload={isUpload} isEssay={isEssay} />

      <div id="assignment-submission">
        <AssignmentSubmissionCard
          data={data}
          review={review}
          alreadyCompleted={alreadyCompleted}
          isUpload={isUpload}
          isEssay={isEssay}
          uploads={uploads}
          uploading={uploading}
          deletingUploadId={deletingUploadId}
          submissionText={submissionText}
          answers={answers}
          answeredCount={answeredCount}
          loading={loading}
          error={actionError}
          message={actionMessage}
          hasUploads={hasUploads}
          hasText={hasText}
          maxUploads={maxUploads}
          canSubmit={canSubmit}
          stageTitle={stageCopy.title}
          stageDescription={stageCopy.description}
          hasFeedback={hasFeedbackContent}
          onUpload={handleUpload}
          onDeleteUpload={handleDeleteUpload}
          onSubmit={handleSubmit}
          onSubmissionTextChange={setSubmissionText}
          onAnswerChange={handleAnswerChange}
        />
      </div>

      {hasFeedbackContent ? (
        <div className="grid" id="assignment-feedback" ref={feedbackSectionRef} style={{ gap: 18 }}>
          {result && isQuiz ? <AssignmentQuizResultCard result={result} questions={data.questions} /> : null}

          {result && (isUpload || isEssay) ? (
            <Card title="提交结果" tag="已提交">
              <p>作业已提交，等待老师批改。</p>
              <div className="status-note info" style={{ marginTop: 8 }}>
                老师反馈生成后会继续显示在本页，无需重复上传或再次提交。
              </div>
              <div className="cta-row" style={{ marginTop: 12 }}>
                <a className="button ghost" href="#assignment-submission">
                  回到作答区
                </a>
                <Link className="button secondary" href="/student/assignments">
                  返回作业中心
                </Link>
              </div>
            </Card>
          ) : null}

          {review?.review ? (
            <AssignmentTeacherReviewCard
              overallComment={review.review.overallComment}
              reviewItems={review.reviewItems ?? []}
              questions={review.questions ?? []}
            />
          ) : null}

          {review?.rubrics?.length ? (
            <AssignmentRubricsCard rubrics={review.rubrics} reviewRubrics={review.reviewRubrics ?? []} />
          ) : null}

          {review?.aiReview ? <AssignmentAiReviewCard aiReview={review.aiReview} /> : null}

          {review?.questions && isQuiz ? <AssignmentWrongQuestionsCard questions={review.questions} /> : null}
        </div>
      ) : null}
    </div>
  );
}
