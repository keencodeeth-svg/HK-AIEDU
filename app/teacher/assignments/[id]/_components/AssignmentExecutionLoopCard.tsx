"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { ASSIGNMENT_TYPE_LABELS } from "@/lib/constants";
import type { TeacherAssignmentStudent, TeacherAssignmentSubmissionType } from "../types";

type AssignmentExecutionLoopCardProps = {
  assignmentId: string;
  assignmentTitle: string;
  dueDate: string;
  submissionType: TeacherAssignmentSubmissionType;
  students: TeacherAssignmentStudent[];
  now: number;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getDueRelativeLabel(dueDate: string, now: number) {
  const diffMs = new Date(dueDate).getTime() - now;
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return `已逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return "今天截止";
  if (diffDays === 1) return "明天截止";
  return `${diffDays} 天后截止`;
}

export default function AssignmentExecutionLoopCard({
  assignmentId,
  assignmentTitle,
  dueDate,
  submissionType,
  students,
  now
}: AssignmentExecutionLoopCardProps) {
  const completedStudents = students.filter((student) => student.status === "completed");
  const pendingStudents = students.filter((student) => student.status !== "completed");
  const reviewReadyStudents = completedStudents.filter(
    (student) => student.score === null || student.total === null
  );
  const lowScoreStudents = completedStudents
    .filter(
      (student) =>
        student.score !== null &&
        student.total !== null &&
        student.total > 0 &&
        student.score / student.total < 0.6
    )
    .sort((left, right) => left.score! / left.total! - right.score! / right.total!);
  const latestCompletedStudent =
    [...completedStudents].sort((left, right) => {
      const leftTs = new Date(left.completedAt ?? "").getTime();
      const rightTs = new Date(right.completedAt ?? "").getTime();
      return rightTs - leftTs;
    })[0] ?? null;
  const nextReviewStudent = lowScoreStudents[0] ?? reviewReadyStudents[0] ?? latestCompletedStudent;
  const completionRate = students.length ? Math.round((completedStudents.length / students.length) * 100) : 0;
  const dueRelativeLabel = getDueRelativeLabel(dueDate, now);

  const signals = [
    {
      id: "progress",
      label: "完成进度",
      value: `${completedStudents.length}/${students.length} · ${completionRate}%`,
      meta: `${ASSIGNMENT_TYPE_LABELS[submissionType]} · ${dueRelativeLabel}`
    },
    {
      id: "blockers",
      label: "待处理学生",
      value: pendingStudents.length ? `${pendingStudents.length} 人未完成` : "当前没有漏交学生",
      meta: pendingStudents.length
        ? `先把学生收口，统计和批改才不会失真`
        : "可以把精力转向批改与低分复盘"
    },
    {
      id: "review",
      label: "下一步最值处理",
      value: nextReviewStudent ? nextReviewStudent.name : "当前没有可处理学生",
      meta: nextReviewStudent
        ? nextReviewStudent.score !== null && nextReviewStudent.total !== null
          ? `得分 ${nextReviewStudent.score}/${nextReviewStudent.total}`
          : `最新提交时间 ${formatDateTime(nextReviewStudent.completedAt)}`
        : "等提交沉淀后，这里会给出优先对象"
    }
  ];

  const steps = [
    {
      id: "close",
      step: "01",
      kicker: "先收口",
      title: pendingStudents.length
        ? `先处理 ${pendingStudents.length} 名未完成学生`
        : "先确认当前没有遗漏的未提交学生",
      description: pendingStudents.length
        ? `作业详情页的首要任务不是重读说明，而是先把未完成学生收回来。截止压力不解决，后面的批改与统计都只是局部真相。`
        : "当前提交盘面比较稳定，可以直接转向批改、复盘和统计验证。",
      meta: `${assignmentTitle} · ${dueRelativeLabel}`,
      href: "#assignment-students",
      actionLabel: "查看学生名单"
    },
    {
      id: "review",
      step: "02",
      kicker: "再处理作业",
      title: nextReviewStudent
        ? `优先处理 ${nextReviewStudent.name} 的作业`
        : "等新的提交进来后，这里会给你推荐下一份作业",
      description: nextReviewStudent
        ? "先把最需要反馈的学生接住，再去处理其余稳定完成的同学，教师时间会用得更值。"
        : "当还没有可批改记录时，先完成催交与提醒，作业详情会自然转成批改入口。",
      meta: nextReviewStudent
        ? nextReviewStudent.score !== null && nextReviewStudent.total !== null
          ? `当前最需要复盘的是低分或波动学生`
          : `当前最适合先接最新完成且待批改的学生`
        : "可回学生名单查看实时状态",
      href: nextReviewStudent
        ? `/teacher/assignments/${assignmentId}/reviews/${nextReviewStudent.id}`
        : "#assignment-students",
      actionLabel: nextReviewStudent ? "进入批改/复盘" : "查看学生名单"
    },
    {
      id: "verify",
      step: "03",
      kicker: "最后验证",
      title: "回统计页确认完成率和得分是否真的改善",
      description: "催交、批改和提醒做完之后，最后还要回统计页看完成率、分布和题目风险，确认本轮动作有没有产生效果。",
      meta: "作业详情负责执行，统计页负责验证",
      href: `/teacher/assignments/${assignmentId}/stats`,
      actionLabel: "去统计页"
    }
  ];

  return (
    <Card title="作业执行闭环" tag="Loop">
      <div className="assignment-execution-loop">
        <div className="feature-card assignment-execution-loop-hero">
          <EduIcon name="rocket" />
          <div>
            <div className="assignment-execution-loop-kicker">别把作业详情只当说明页</div>
            <div className="assignment-execution-loop-title">
              先看谁没交，再接住最该批改的作业，最后回统计页验证收口结果。
            </div>
            <p className="assignment-execution-loop-description">
              作业详情页真正的价值，是帮老师在同一个页面里完成催交、批改和结果验证，而不是只展示标题、描述和截止日期。
            </p>
          </div>
        </div>

        <div className="assignment-execution-loop-signal-grid">
          {signals.map((item) => (
            <div className="assignment-execution-loop-signal-card" key={item.id}>
              <div className="assignment-execution-loop-signal-label">{item.label}</div>
              <div className="assignment-execution-loop-signal-value">{item.value}</div>
              <div className="meta-text">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="assignment-execution-loop-grid">
          {steps.map((item, index) => (
            <div className="assignment-execution-loop-step" key={item.id}>
              <div className="assignment-execution-loop-step-head">
                <span className="assignment-execution-loop-step-index">{item.step}</span>
                <div>
                  <div className="assignment-execution-loop-step-kicker">{item.kicker}</div>
                  <div className="assignment-execution-loop-step-title">{item.title}</div>
                </div>
              </div>
              <p className="assignment-execution-loop-step-description">{item.description}</p>
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
