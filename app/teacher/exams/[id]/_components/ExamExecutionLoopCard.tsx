"use client";

import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import type { ExamDetail } from "../types";

type ExamExecutionLoopCardProps = {
  data: ExamDetail;
  now: number;
};

function getDueRelativeLabel(endAt: string, now: number) {
  const diffMs = new Date(endAt).getTime() - now;
  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (diffHours < 0) return `已结束 ${Math.abs(diffHours)} 小时`;
  if (diffHours <= 1) return "1 小时内结束";
  if (diffHours < 24) return `${diffHours} 小时后结束`;
  const diffDays = Math.ceil(diffHours / 24);
  return `${diffDays} 天后结束`;
}

export default function ExamExecutionLoopCard({ data, now }: ExamExecutionLoopCardProps) {
  const submittedRate = data.summary.assigned
    ? Math.round((data.summary.submitted / data.summary.assigned) * 100)
    : 0;
  const topRiskStudent =
    [...data.students].sort((left, right) => right.riskScore - left.riskScore)[0] ?? null;
  const reviewPackReadyCount = data.students.filter(
    (student) => student.status === "submitted" && student.riskLevel === "high"
  ).length;
  const dueRelativeLabel = getDueRelativeLabel(data.exam.endAt, now);

  const signals = [
    {
      id: "progress",
      label: "提交进度",
      value: `${data.summary.submitted}/${data.summary.assigned} · ${submittedRate}%`,
      meta: `${data.exam.status === "closed" ? "已关闭" : "进行中"} · ${dueRelativeLabel}`
    },
    {
      id: "risk",
      label: "异常风险",
      value: `${data.summary.highRiskCount} 高风险 / ${data.summary.mediumRiskCount} 中风险`,
      meta: `离屏 ${data.summary.totalVisibilityHiddenCount} 次 · 切屏 ${data.summary.totalBlurCount} 次`
    },
    {
      id: "next",
      label: "当前最该处理",
      value: topRiskStudent ? topRiskStudent.name : "当前没有明显高风险学生",
      meta: topRiskStudent
        ? topRiskStudent.recommendedAction || "建议优先复盘这名学生的表现"
        : "可以转向题目讲评或考试收尾"
    }
  ];

  const steps = [
    {
      id: "students",
      step: "01",
      kicker: "先盯学生",
      title: topRiskStudent
        ? `先处理 ${topRiskStudent.name} 和其他异常学生`
        : "先确认当前没有遗漏的未提交或高风险学生",
      description: topRiskStudent
        ? "考试详情页首先要解决的是人。先把未提交、异常行为和高风险学生捞出来，后面的复盘包和导出才有意义。"
        : "当学生侧已经比较稳定，考试详情页就可以转向复盘发布和题目讲评。",
      meta: `当前仍有 ${data.summary.pending} 人待提交`,
      href: "#exam-students",
      actionLabel: "查看学生风险"
    },
    {
      id: "review-pack",
      step: "02",
      kicker: "再做干预",
      title: reviewPackReadyCount
        ? `可向 ${reviewPackReadyCount} 名高风险学生发布复盘包`
        : "先预览复盘包覆盖范围，再决定是否发布",
      description:
        "不要把复盘包当成一个单独功能点。它应该建立在风险排序之后，直接接住最需要追的人，而不是面向所有学生一刀切。",
      meta: reviewPackReadyCount
        ? "高风险且已提交的学生最适合直接承接复盘任务"
        : "如果高风险不多，也可以先预览，再决定是否发布",
      href: "#exam-review-pack",
      actionLabel: "去复盘发布区"
    },
    {
      id: "questions",
      step: "03",
      kicker: "最后看卷面",
      title: "回题目清单确认这场考试的卷面结构和讲评重点",
      description:
        "学生风险和异常行为解决后，还要回到题目本身确认讲评重点，避免老师只盯行为信号而忽略题目层面的教学问题。",
      meta: `当前试卷共 ${data.questions.length} 题`,
      href: "#exam-questions",
      actionLabel: "查看题目清单"
    }
  ];

  return (
    <Card title="考试执行闭环" tag="Loop">
      <div className="teacher-exam-execution-loop">
        <div className="feature-card teacher-exam-execution-loop-hero">
          <EduIcon name="rocket" />
          <div>
            <div className="teacher-exam-execution-loop-kicker">别把考试详情只当结果页</div>
            <div className="teacher-exam-execution-loop-title">
              先盯学生风险，再决定复盘干预，最后回到卷面本身确认讲评重点。
            </div>
            <p className="teacher-exam-execution-loop-description">
              考试详情页真正的价值，是把提交进度、异常行为、复盘发布和题目讲评串成一条执行链，而不是把这些信息平铺成几张卡。
            </p>
          </div>
        </div>

        <div className="teacher-exam-execution-loop-signal-grid">
          {signals.map((item) => (
            <div className="teacher-exam-execution-loop-signal-card" key={item.id}>
              <div className="teacher-exam-execution-loop-signal-label">{item.label}</div>
              <div className="teacher-exam-execution-loop-signal-value">{item.value}</div>
              <div className="meta-text">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="teacher-exam-execution-loop-grid">
          {steps.map((item, index) => (
            <div className="teacher-exam-execution-loop-step" key={item.id}>
              <div className="teacher-exam-execution-loop-step-head">
                <span className="teacher-exam-execution-loop-step-index">{item.step}</span>
                <div>
                  <div className="teacher-exam-execution-loop-step-kicker">{item.kicker}</div>
                  <div className="teacher-exam-execution-loop-step-title">{item.title}</div>
                </div>
              </div>
              <p className="teacher-exam-execution-loop-step-description">{item.description}</p>
              <div className="meta-text">{item.meta}</div>
              <div className="cta-row" style={{ marginTop: 10 }}>
                <a className={index === 0 ? "button primary" : "button secondary"} href={item.href}>
                  {item.actionLabel}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
