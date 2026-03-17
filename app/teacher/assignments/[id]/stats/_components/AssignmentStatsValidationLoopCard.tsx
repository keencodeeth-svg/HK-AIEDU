"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { ASSIGNMENT_TYPE_LABELS } from "@/lib/constants";
import type { AssignmentStatsData } from "../types";
import { getDueRelativeLabel } from "../utils";

type AssignmentStatsValidationLoopCardProps = {
  assignmentId: string;
  assignment: AssignmentStatsData["assignment"];
  summary: AssignmentStatsData["summary"];
  distribution: AssignmentStatsData["distribution"];
  questionStats: AssignmentStatsData["questionStats"];
  now: number;
};

export default function AssignmentStatsValidationLoopCard({
  assignmentId,
  assignment,
  summary,
  distribution,
  questionStats,
  now
}: AssignmentStatsValidationLoopCardProps) {
  const completionRate = summary.students ? Math.round((summary.completed / summary.students) * 100) : 0;
  const lowScoreBucket = distribution.find((item) => item.label === "<60");
  const strongestBucket =
    [...distribution].sort((left, right) => right.count - left.count)[0] ?? null;
  const weakestQuestion =
    [...questionStats].sort((left, right) => left.ratio - right.ratio)[0] ?? null;
  const watchQuestions = questionStats.filter((item) => item.ratio < 80);
  const dueRelativeLabel = getDueRelativeLabel(assignment.dueDate, now);
  const needsClosure = summary.pending > 0 || summary.overdue > 0;
  const shouldReturnToDetail = needsClosure || (lowScoreBucket?.count ?? 0) > 0 || watchQuestions.length > 0;

  const signals = [
    {
      id: "closure",
      label: "收口状态",
      value: `${summary.completed}/${summary.students} · ${completionRate}%`,
      meta: `${ASSIGNMENT_TYPE_LABELS[assignment.submissionType ?? "quiz"]} · ${dueRelativeLabel}`
    },
    {
      id: "distribution",
      label: "低分堆积",
      value: lowScoreBucket?.count ? `<60 分 ${lowScoreBucket.count} 人` : "当前没有明显低分堆积",
      meta: strongestBucket ? `当前人数最多的分段：${strongestBucket.label}` : "等待更多统计样本"
    },
    {
      id: "risk",
      label: "题目风险",
      value: weakestQuestion ? `最低正确率 ${weakestQuestion.ratio}%` : "当前没有题目统计",
      meta: weakestQuestion
        ? `需要优先看最弱题的讲评和复盘`
        : "非在线作答时，这里会退化为成绩分布判断"
    }
  ];

  const steps = [
    {
      id: "closure",
      step: "01",
      kicker: "先看收口",
      title: needsClosure ? `先确认 ${summary.pending} 名未完成学生是否已经处理` : "先确认这轮作业已经收口稳定",
      description: needsClosure
        ? "如果还有待交或逾期学生，统计页里的分布和题目正确率都只是局部真相。先回作业详情把收口动作做完。"
        : "当提交盘面已经稳定，统计页的数据才适合拿来做教学判断和下一步动作。",
      meta: summary.overdue ? `当前仍有 ${summary.overdue} 名逾期学生` : "当前没有明显提交阻塞",
      href: `/teacher/assignments/${assignmentId}`,
      actionLabel: "回作业详情"
    },
    {
      id: "risk",
      step: "02",
      kicker: "再看风险",
      title: weakestQuestion
        ? `优先关注正确率最低的题目`
        : "先看成绩分布有没有出现低分堆积",
      description: weakestQuestion
        ? "看均分不够，最有价值的是找到哪道题正在拖住全班。先把最弱题定位清楚，再决定是重讲、复练还是补反馈。"
        : "当没有题目级数据时，分布本身就是风险图。先判断低分是否集中在某一段，再决定后续动作。",
      meta: weakestQuestion
        ? `当前共有 ${watchQuestions.length} 道题低于 80% 正确率`
        : `低于 60 分的学生 ${lowScoreBucket?.count ?? 0} 人`,
      href: weakestQuestion ? "#assignment-stats-questions" : "#assignment-stats-distribution",
      actionLabel: weakestQuestion ? "看题目风险" : "看成绩分布"
    },
    {
      id: "action",
      step: "03",
      kicker: "最后转动作",
      title: shouldReturnToDetail ? "带着统计结论回执行页做动作" : "再去成绩册确认这份作业放到全班是否也成立",
      description: shouldReturnToDetail
        ? "统计页不是终点。确认风险后，要回作业详情、批改页或提醒链路把动作做出去，数据才会真的变化。"
        : "如果当前分布和题目风险都比较稳定，可以再回成绩册看看这份作业放到整班、整周尺度是否仍然成立。",
      meta: shouldReturnToDetail ? "统计页负责判断，执行页负责改变结果" : "成绩册负责放到更高层做验证",
      href: shouldReturnToDetail ? `/teacher/assignments/${assignmentId}` : "/teacher/gradebook",
      actionLabel: shouldReturnToDetail ? "回执行页" : "去成绩册"
    }
  ];

  return (
    <Card title="统计验证闭环" tag="Loop">
      <div className="assignment-stats-validation-loop">
        <div className="feature-card assignment-stats-validation-loop-hero">
          <EduIcon name="rocket" />
          <div>
            <div className="assignment-stats-validation-loop-kicker">别把统计页只当结果页</div>
            <div className="assignment-stats-validation-loop-title">
              先判断收口是否完成，再定位真正的风险点，最后把统计结论带回执行链路。
            </div>
            <p className="assignment-stats-validation-loop-description">
              统计页的价值不是展示更多数字，而是帮老师快速判断这份作业是否已经稳定、问题集中在哪，以及下一步应该回哪里做动作。
            </p>
          </div>
        </div>

        <div className="assignment-stats-validation-loop-signal-grid">
          {signals.map((item) => (
            <div className="assignment-stats-validation-loop-signal-card" key={item.id}>
              <div className="assignment-stats-validation-loop-signal-label">{item.label}</div>
              <div className="assignment-stats-validation-loop-signal-value">{item.value}</div>
              <div className="meta-text">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="assignment-stats-validation-loop-grid">
          {steps.map((item, index) => (
            <div className="assignment-stats-validation-loop-step" key={item.id}>
              <div className="assignment-stats-validation-loop-step-head">
                <span className="assignment-stats-validation-loop-step-index">{item.step}</span>
                <div>
                  <div className="assignment-stats-validation-loop-step-kicker">{item.kicker}</div>
                  <div className="assignment-stats-validation-loop-step-title">{item.title}</div>
                </div>
              </div>
              <p className="assignment-stats-validation-loop-step-description">{item.description}</p>
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
