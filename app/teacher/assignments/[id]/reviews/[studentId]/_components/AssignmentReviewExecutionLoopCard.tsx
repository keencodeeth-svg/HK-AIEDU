"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { ASSIGNMENT_TYPE_LABELS } from "@/lib/constants";
import type { TeacherAssignmentReviewAssignment, TeacherAssignmentReviewStudent } from "../types";

type AssignmentReviewExecutionLoopCardProps = {
  assignment: TeacherAssignmentReviewAssignment;
  student: TeacherAssignmentReviewStudent;
  wrongQuestionsCount: number;
  uploadCount: number;
  hasSubmissionText: boolean;
  hasAiReview: boolean;
  canAiReview: boolean;
  saveMessage: string | null;
  backHref: string;
};

export default function AssignmentReviewExecutionLoopCard({
  assignment,
  student,
  wrongQuestionsCount,
  uploadCount,
  hasSubmissionText,
  hasAiReview,
  canAiReview,
  saveMessage,
  backHref
}: AssignmentReviewExecutionLoopCardProps) {
  const evidenceCount = uploadCount + (hasSubmissionText ? 1 : 0);
  const reviewFocus = wrongQuestionsCount
    ? `${wrongQuestionsCount} 道错题待复盘`
    : assignment.submissionType === "quiz"
      ? "当前无错题，补总体点评即可"
      : "先看主观内容，再落人工判断";
  const reviewStatus = saveMessage ? "本次批改已保存" : hasAiReview ? "AI 建议已就位" : "等待人工判断";

  const signals = [
    {
      id: "focus",
      label: "当前焦点",
      value: reviewFocus,
      meta: `${ASSIGNMENT_TYPE_LABELS[assignment.submissionType ?? "quiz"]} · ${student.name}`
    },
    {
      id: "evidence",
      label: "可用素材",
      value: evidenceCount ? `${evidenceCount} 份证据` : "当前没有提交素材",
      meta: evidenceCount ? `附件 ${uploadCount} 份${hasSubmissionText ? " · 含文本说明" : ""}` : "先确认学生是否已提交内容"
    },
    {
      id: "status",
      label: "批改状态",
      value: reviewStatus,
      meta: canAiReview ? (hasAiReview ? "可作为第二意见参考" : "可先生成 AI 初判再人工定稿") : "当前只能依赖人工批改"
    }
  ];

  const steps = [
    {
      id: "evidence",
      step: "01",
      kicker: "先看证据",
      title: evidenceCount ? "先读学生提交内容与附件" : "先确认学生是否已经提交有效内容",
      description: evidenceCount
        ? "别急着先写结论。先把题目、附件、文本说明读完，后面的 AI 结果和 rubric 才有锚点。"
        : "如果当前没有有效内容，批改页的重点就不是给分，而是确认提交状态并回作业详情继续跟进。",
      meta: "证据先于结论",
      href: "#review-evidence",
      actionLabel: "查看提交证据"
    },
    {
      id: "judge",
      step: "02",
      kicker: "再形成人工判断",
      title: hasAiReview ? "对照 AI 建议，完成人工评分与点评" : "结合 rubric 和错因标签写出人工判断",
      description: hasAiReview
        ? "AI 结果适合提速，但最终要落在老师自己的 rubric、错因标签和总体点评上。"
        : "没有 AI 时也不必按顺序硬写。先抓主要问题，再回 rubric 和总体点评补齐判断。",
      meta: "人工判断是最终结果",
      href: "#review-form",
      actionLabel: "进入批改表单"
    },
    {
      id: "verify",
      step: "03",
      kicker: "最后回看结果",
      title: "保存后回作业详情确认这份批改是否带动整体收口",
      description: "单个学生批改完成以后，最好回作业详情看这次动作是否真正推动了班级收口，而不是只停留在一份作业上。",
      meta: "批改页负责决策，作业详情负责追整体进度",
      href: backHref,
      actionLabel: "回作业详情"
    }
  ];

  return (
    <Card title="批改执行闭环" tag="Loop">
      <div className="review-execution-loop">
        <div className="feature-card review-execution-loop-hero">
          <EduIcon name="rocket" />
          <div>
            <div className="review-execution-loop-kicker">别把批改页只当表单页</div>
            <div className="review-execution-loop-title">
              先看提交证据，再形成老师自己的判断，最后回作业详情确认这一笔批改带来的变化。
            </div>
            <p className="review-execution-loop-description">
              好的批改页不是把输入框堆满，而是把证据、AI、rubric 和保存动作按教师思路排好，让每次批改都更快、更稳。
            </p>
          </div>
        </div>

        <div className="review-execution-loop-signal-grid">
          {signals.map((item) => (
            <div className="review-execution-loop-signal-card" key={item.id}>
              <div className="review-execution-loop-signal-label">{item.label}</div>
              <div className="review-execution-loop-signal-value">{item.value}</div>
              <div className="meta-text">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="review-execution-loop-grid">
          {steps.map((item, index) => (
            <div className="review-execution-loop-step" key={item.id}>
              <div className="review-execution-loop-step-head">
                <span className="review-execution-loop-step-index">{item.step}</span>
                <div>
                  <div className="review-execution-loop-step-kicker">{item.kicker}</div>
                  <div className="review-execution-loop-step-title">{item.title}</div>
                </div>
              </div>
              <p className="review-execution-loop-step-description">{item.description}</p>
              <div className="meta-text">{item.meta}</div>
              <div className="cta-row" style={{ marginTop: 10 }}>
                {item.href.startsWith("#") ? (
                  <a className={index === 0 ? "button primary" : "button secondary"} href={item.href}>
                    {item.actionLabel}
                  </a>
                ) : (
                  <Link className={index === 0 ? "button primary" : "button secondary"} href={item.href}>
                    {item.actionLabel}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
