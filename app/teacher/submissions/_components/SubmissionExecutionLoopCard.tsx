"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { ASSIGNMENT_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/constants";
import type { SubmissionClassItem, SubmissionRow } from "../types";

type SubmissionExecutionLoopCardProps = {
  selectedClass: SubmissionClassItem | undefined;
  rows: SubmissionRow[];
  now: number;
};

function formatClassLabel(selectedClass: SubmissionClassItem | undefined) {
  if (!selectedClass) return "当前筛选范围";
  return `${selectedClass.name} · ${SUBJECT_LABELS[selectedClass.subject] ?? selectedClass.subject} · ${selectedClass.grade} 年级`;
}

function formatDateLabel(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function SubmissionExecutionLoopCard({
  selectedClass,
  rows,
  now
}: SubmissionExecutionLoopCardProps) {
  const overdueRows = rows.filter((row) => row.status === "overdue");
  const pendingRows = rows.filter((row) => row.status === "pending");
  const completedRows = rows.filter((row) => row.status === "completed");
  const recentSubmittedRows = completedRows.filter((row) => {
    const ts = new Date(row.submittedAt ?? row.completedAt ?? "").getTime();
    return Number.isFinite(ts) && ts >= now - 24 * 60 * 60 * 1000;
  });
  const topUrgentRow =
    [...rows]
      .filter((row) => row.status !== "completed")
      .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())[0] ?? null;
  const latestCompletedRow =
    [...completedRows].sort((left, right) => {
      const leftTs = new Date(left.submittedAt ?? left.completedAt ?? "").getTime();
      const rightTs = new Date(right.submittedAt ?? right.completedAt ?? "").getTime();
      return rightTs - leftTs;
    })[0] ?? null;
  const classLabel = formatClassLabel(selectedClass);

  const loopSignals = [
    {
      id: "urgent",
      label: "当前最急",
      value: topUrgentRow ? `${topUrgentRow.studentName} · ${topUrgentRow.assignmentTitle}` : "当前没有待交或逾期阻塞",
      meta: topUrgentRow
        ? `${topUrgentRow.status === "overdue" ? "已逾期" : "待提交"} · 截止 ${formatDateLabel(topUrgentRow.dueDate)}`
        : "说明当前提交盘面相对稳定，可优先处理已交作业"
    },
    {
      id: "followup",
      label: "待跟进学生",
      value: overdueRows.length || pendingRows.length ? `${overdueRows.length + pendingRows.length} 人待跟进` : "当前没有明显掉队学生",
      meta:
        overdueRows.length || pendingRows.length
          ? `逾期 ${overdueRows.length} 人 · 待交 ${pendingRows.length} 人`
          : "可以把时间转到批改、复盘和下一轮布置"
    },
    {
      id: "submitted",
      label: "近 24h 新提交",
      value: `${recentSubmittedRows.length} 条`,
      meta: latestCompletedRow
        ? `最新提交：${latestCompletedRow.studentName} · ${ASSIGNMENT_TYPE_LABELS[latestCompletedRow.submissionType as "quiz"] ?? latestCompletedRow.submissionType}`
        : "最近还没有新的提交沉淀到提交箱"
    }
  ];

  const loopSteps = [
    {
      id: "followup",
      step: "01",
      kicker: "先清阻塞",
      title: topUrgentRow ? `先处理「${topUrgentRow.assignmentTitle}」的未收口学生` : "先确认今天没有遗漏的未交学生",
      description: topUrgentRow
        ? `${classLabel} 当前最影响课堂执行节奏的是这批未收口学生。先把逾期和待交名单捞出来，后面的批改和复盘才不会失真。`
        : `${classLabel} 当前没有明显提交阻塞，可以直接转去看最新已交作业和批改动作。`,
      meta: topUrgentRow
        ? `${topUrgentRow.studentName} 目前处于${topUrgentRow.status === "overdue" ? "逾期" : "待提交"}状态`
        : "没有待交压力时，更适合优先处理已交内容",
      href: "#submission-list",
      actionLabel: "查看待跟进名单"
    },
    {
      id: "review",
      step: "02",
      kicker: "再看已交",
      title: latestCompletedRow ? `优先打开 ${latestCompletedRow.studentName} 的最新提交` : "最新提交会优先出现在这里",
      description: latestCompletedRow
        ? "清完阻塞后，最值得立刻接的是最新提交。趁上下文还热去看，批改和反馈效率最高。"
        : "如果当前还没有提交记录，就先把待交和逾期名单收口，提交箱自然会开始沉淀可批改内容。",
      meta: latestCompletedRow
        ? `提交时间 ${formatDateLabel(latestCompletedRow.submittedAt ?? latestCompletedRow.completedAt)}`
        : "已交作业会形成后续批改和反馈入口",
      href: latestCompletedRow
        ? `/teacher/assignments/${latestCompletedRow.assignmentId}/reviews/${latestCompletedRow.studentId}`
        : "#submission-list",
      actionLabel: latestCompletedRow ? "打开最新提交" : "查看提交列表"
    },
    {
      id: "verify",
      step: "03",
      kicker: "最后验证",
      title: "回成绩册或学情分析确认这轮收口是否有效",
      description: "提交箱负责把人和作业收口，但闭环还差一步：回看完成率、平均分和知识点风险，确认今天的催交与批改有没有真正带来变化。",
      meta: "如果提交稳定但成绩和风险没有改善，下一步应该去成绩册或学情分析继续追",
      href: "/teacher/gradebook",
      actionLabel: "去成绩册"
    }
  ];

  return (
    <Card title="提交箱执行闭环" tag="Loop">
      <div className="submission-execution-loop">
        <div className="feature-card submission-execution-loop-hero">
          <EduIcon name="rocket" />
          <div>
            <div className="submission-execution-loop-kicker">别把提交箱只当查询列表</div>
            <div className="submission-execution-loop-title">
              先清掉逾期和待交，再处理最新已交，最后回成绩册或学情分析确认效果。
            </div>
            <p className="submission-execution-loop-description">
              提交箱的价值不是列出所有记录，而是帮你快速决定今天先追谁、先看哪份提交，以及什么时候该转去更高层的教学分析。
            </p>
          </div>
        </div>

        <div className="submission-execution-loop-signal-grid">
          {loopSignals.map((item) => (
            <div className="submission-execution-loop-signal-card" key={item.id}>
              <div className="submission-execution-loop-signal-label">{item.label}</div>
              <div className="submission-execution-loop-signal-value">{item.value}</div>
              <div className="meta-text">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="submission-execution-loop-grid">
          {loopSteps.map((item, index) => (
            <div className="submission-execution-loop-step" key={item.id}>
              <div className="submission-execution-loop-step-head">
                <span className="submission-execution-loop-step-index">{item.step}</span>
                <div>
                  <div className="submission-execution-loop-step-kicker">{item.kicker}</div>
                  <div className="submission-execution-loop-step-title">{item.title}</div>
                </div>
              </div>
              <p className="submission-execution-loop-step-description">{item.description}</p>
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
