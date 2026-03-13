"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS, getGradeLabel } from "@/lib/constants";
import type { TeacherExamItem } from "../types";

type ExamManagementLoopCardProps = {
  exams: TeacherExamItem[];
  now: number;
};

function getSubmissionRate(exam: TeacherExamItem) {
  if (!exam.assignedCount) return 0;
  return Math.round((exam.submittedCount / exam.assignedCount) * 100);
}

function getDueRelativeLabel(endAt: string, now: number) {
  const diffMs = new Date(endAt).getTime() - now;
  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (diffHours < 0) return `已结束 ${Math.abs(diffHours)} 小时`;
  if (diffHours <= 1) return "1 小时内结束";
  if (diffHours < 24) return `${diffHours} 小时后结束`;
  return `${Math.ceil(diffHours / 24)} 天后结束`;
}

function getAttentionScore(exam: TeacherExamItem, now: number) {
  if (exam.status !== "published") {
    return -new Date(exam.createdAt).getTime();
  }

  const pendingCount = Math.max(0, exam.assignedCount - exam.submittedCount);
  const submissionRate = getSubmissionRate(exam);
  const endAtTs = new Date(exam.endAt).getTime();
  const hoursUntilEnd = Math.max(0, Math.ceil((endAtTs - now) / (60 * 60 * 1000)));
  const dueSoonBoost = hoursUntilEnd <= 24 ? 240 - hoursUntilEnd : 0;

  return pendingCount * 100 + (100 - submissionRate) * 10 + dueSoonBoost;
}

function getPriorityExam(exams: TeacherExamItem[], now: number) {
  return exams
    .filter((exam) => exam.status === "published")
    .slice()
    .sort((left, right) => {
      const scoreDiff = getAttentionScore(right, now) - getAttentionScore(left, now);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(left.endAt).getTime() - new Date(right.endAt).getTime();
    })[0] ?? null;
}

export default function ExamManagementLoopCard({ exams, now }: ExamManagementLoopCardProps) {
  const activeExams = exams.filter((exam) => exam.status === "published");
  const dueSoonExams = activeExams.filter((exam) => {
    const diffMs = new Date(exam.endAt).getTime() - now;
    return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000 && exam.submittedCount < exam.assignedCount;
  });
  const lowCompletionExams = activeExams.filter((exam) => getSubmissionRate(exam) < 60);
  const priorityExam = getPriorityExam(exams, now);
  const latestClosedExam =
    exams
      .filter((exam) => exam.status === "closed")
      .slice()
      .sort((left, right) => new Date(right.endAt).getTime() - new Date(left.endAt).getTime())[0] ?? null;

  const signals = [
    {
      id: "priority",
      label: "当前最该盯",
      value: priorityExam ? priorityExam.title : "当前没有进行中的考试",
      meta: priorityExam
        ? `${priorityExam.className} · ${SUBJECT_LABELS[priorityExam.classSubject] ?? priorityExam.classSubject} · ${getDueRelativeLabel(priorityExam.endAt, now)}`
        : latestClosedExam
          ? `最近收口：${latestClosedExam.title}`
          : "可以直接创建下一场考试"
    },
    {
      id: "active",
      label: "进行中考试",
      value: `${activeExams.length} 场`,
      meta:
        activeExams.length > 0
          ? `24h 内截止 ${dueSoonExams.length} 场 · 低完成率 ${lowCompletionExams.length} 场`
          : "当前没有需要催交和收口的考试"
    },
    {
      id: "close",
      label: "最近已收口",
      value: latestClosedExam ? latestClosedExam.title : "最近还没有已关闭考试",
      meta: latestClosedExam
        ? `${latestClosedExam.className} · 平均分 ${latestClosedExam.avgScore}%`
        : "关闭后的考试会沉淀到这里，便于回看本轮执行质量"
    }
  ];

  const steps = [
    {
      id: "priority",
      step: "01",
      kicker: "先定优先级",
      title: priorityExam ? `先处理「${priorityExam.title}」` : "先确认当前没有待收口的考试",
      description: priorityExam
        ? "考试列表不应该只是历史档案。先把最可能影响今天班级节奏的一场考试挑出来，再进详情页处理提交和风险。"
        : "当没有进行中的考试时，这个入口应该帮助你平滑转到下一轮创建，而不是停留在空列表。",
      meta: priorityExam
        ? `${priorityExam.className} 还剩 ${Math.max(0, priorityExam.assignedCount - priorityExam.submittedCount)} 人未提交`
        : "当前盘面已经收口，可以准备下一场考试",
      href: priorityExam ? `/teacher/exams/${priorityExam.id}` : "/teacher/exams/create",
      actionLabel: priorityExam ? "打开优先考试" : "去创建考试"
    },
    {
      id: "followup",
      step: "02",
      kicker: "再清低完成率",
      title: lowCompletionExams.length ? `还有 ${lowCompletionExams.length} 场考试完成率偏低` : "当前没有明显掉队的考试",
      description:
        "同一时间段往往不止一场考试在跑。列表页要把低完成率和近截止考试推到前面，帮助老师先清最容易拖慢进度的那批任务。",
      meta: dueSoonExams.length
        ? `其中 ${dueSoonExams.length} 场将在 24 小时内截止`
        : "如果低完成率不多，可以把时间转去卷面复盘或下一轮创建",
      href: "#exam-management-list",
      actionLabel: "查看优先队列"
    },
    {
      id: "next",
      step: "03",
      kicker: "最后续上新一轮",
      title: "收口后立刻补上下一场考试，不要让计划断档",
      description:
        "当进行中的考试已经稳定，列表页下一步应该自然切到创建页，让老师直接延续节奏，而不是回上一级菜单重新找入口。",
      meta: latestClosedExam
        ? `最近完成的是 ${latestClosedExam.className} 的一场考试`
        : "第一次建考试也应该从这里开始",
      href: "/teacher/exams/create",
      actionLabel: "发布新考试"
    }
  ];

  return (
    <Card title="考试管理闭环" tag="Loop">
      <div className="teacher-exam-management-loop">
        <div className="feature-card teacher-exam-management-loop-hero">
          <EduIcon name="rocket" />
          <div>
            <div className="teacher-exam-management-loop-kicker">先决定先管哪一场，再进入详情页</div>
            <div className="teacher-exam-management-loop-title">
              把考试列表当成执行入口，不是历史清单。
            </div>
            <p className="teacher-exam-management-loop-description">
              真正有价值的列表页，应该先告诉你今天先看哪场考试、哪些考试快要掉队，以及什么时候该直接进入创建下一轮。
            </p>
          </div>
        </div>

        <div className="teacher-exam-management-loop-signal-grid">
          {signals.map((item) => (
            <div className="teacher-exam-management-loop-signal-card" key={item.id}>
              <div className="teacher-exam-management-loop-signal-label">{item.label}</div>
              <div className="teacher-exam-management-loop-signal-value">{item.value}</div>
              <div className="meta-text">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="teacher-exam-management-loop-grid">
          {steps.map((item, index) => (
            <div className="teacher-exam-management-loop-step" key={item.id}>
              <div className="teacher-exam-management-loop-step-head">
                <span className="teacher-exam-management-loop-step-index">{item.step}</span>
                <div>
                  <div className="teacher-exam-management-loop-step-kicker">{item.kicker}</div>
                  <div className="teacher-exam-management-loop-step-title">{item.title}</div>
                </div>
              </div>
              <p className="teacher-exam-management-loop-step-description">{item.description}</p>
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
