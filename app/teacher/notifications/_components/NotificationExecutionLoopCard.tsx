"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { ClassItem, HistoryItem, PreviewData, RuleItem } from "../types";

type NotificationExecutionLoopCardProps = {
  selectedClass: ClassItem | null;
  draftRule: RuleItem;
  preview: PreviewData | null;
  latestHistory: HistoryItem | null;
  hasUnsavedChanges: boolean;
};

function getRuleSummary(rule: RuleItem) {
  return `截止前 ${rule.dueDays} 天 · 逾期 ${rule.overdueDays} 天 · 家长抄送 ${rule.includeParents ? "开启" : "关闭"}`;
}

function getCurrentPriority(preview: PreviewData | null, rule: RuleItem) {
  if (!rule.enabled) {
    return {
      value: "规则当前关闭",
      meta: "先决定今天是否真的需要发提醒，再进入预览和执行"
    };
  }
  if (!preview) {
    return {
      value: "先生成当前班级预览",
      meta: "预览会告诉你今天究竟该催谁，而不是凭感觉发"
    };
  }
  if (preview.summary.overdueAssignments > 0) {
    return {
      value: `${preview.summary.overdueAssignments} 份作业已逾期`,
      meta: `优先覆盖 ${preview.summary.uniqueStudents} 名学生的逾期催交`
    };
  }
  if (preview.summary.dueSoonAssignments > 0) {
    return {
      value: `${preview.summary.dueSoonAssignments} 份作业即将到期`,
      meta: "今天更适合做截止前提醒，减少明天的逾期堆积"
    };
  }
  return {
    value: "当前没有待发提醒",
    meta: "可以把注意力转到提交箱、成绩册或下一轮规则校准"
  };
}

export default function NotificationExecutionLoopCard({
  selectedClass,
  draftRule,
  preview,
  latestHistory,
  hasUnsavedChanges
}: NotificationExecutionLoopCardProps) {
  const priority = getCurrentPriority(preview, draftRule);
  const classLabel = selectedClass
    ? `${selectedClass.name} · ${SUBJECT_LABELS[selectedClass.subject] ?? selectedClass.subject} · ${selectedClass.grade} 年级`
    : "未选择班级";
  const latestRunLabel = latestHistory
    ? `最近于 ${new Date(latestHistory.executedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : "当前班级还没有执行历史";

  const signals = [
    {
      id: "priority",
      label: "当前最该做",
      value: priority.value,
      meta: priority.meta
    },
    {
      id: "draft",
      label: "规则草稿状态",
      value: hasUnsavedChanges ? "草稿待保存" : draftRule.enabled ? "默认规则已稳定" : "默认规则已关闭",
      meta: hasUnsavedChanges ? getRuleSummary(draftRule) : "保存后，班级后续提醒会默认沿用这套规则"
    },
    {
      id: "history",
      label: "最近执行结果",
      value: latestHistory
        ? `学生 ${latestHistory.totals.studentTargets} 条 · 家长 ${latestHistory.totals.parentTargets} 条`
        : "还没有发送记录",
      meta: latestRunLabel
    }
  ];

  const steps = [
    {
      id: "preview",
      step: "01",
      kicker: "先定今天要不要发",
      title: draftRule.enabled
        ? preview?.summary.overdueAssignments
          ? "先看逾期队列，优先处理已经掉队的作业"
          : preview?.summary.dueSoonAssignments
            ? "先看即将到期队列，减少下一轮逾期"
            : "先确认当前班级今天是否真的需要发送提醒"
        : "先决定今天是否开启提醒",
      description:
        "通知页的第一步不是点击发送，而是判断今天到底该催什么。只有先看清逾期和临期作业，提醒才不会沦为机械群发。",
      meta: classLabel,
      href: "#teacher-notification-preview",
      actionLabel: "去看提醒队列"
    },
    {
      id: "commit",
      step: "02",
      kicker: "再决定执行方式",
      title: hasUnsavedChanges ? "草稿有改动，先决定保存默认还是仅执行这一次" : "规则已稳定，按当前预览决定是否立即发送",
      description:
        "保存规则解决的是“以后怎么发”，立即发送解决的是“今天先催谁”。这两个动作不该混在一个模糊按钮里。",
      meta: hasUnsavedChanges ? getRuleSummary(draftRule) : "如果只是一次性临时调整，也可以不保存直接执行",
      href: "#teacher-notification-config",
      actionLabel: "去规则与执行区"
    },
    {
      id: "verify",
      step: "03",
      kicker: "最后看效果",
      title: "发送后回提交箱和成绩册确认催交通路是否真的动起来",
      description:
        "通知不是终点。发完之后要去提交箱看是否出现新增提交，再回成绩册或学情盘面确认这轮触达有没有带来变化。",
      meta: latestHistory ? "历史记录会保留触达规模，但实际效果仍要回业务页验证" : "第一次发送后就能开始形成效果对照",
      href: "/teacher/submissions",
      actionLabel: "去提交箱"
    }
  ];

  return (
    <Card title="通知执行闭环" tag="Loop">
      <div className="teacher-notification-loop">
        <div className="feature-card teacher-notification-loop-hero">
          <EduIcon name="rocket" />
          <div>
            <div className="teacher-notification-loop-kicker">别把通知页只当配置页</div>
            <div className="teacher-notification-loop-title">
              先判断今天该催什么，再决定保存还是发送，最后回业务页看效果。
            </div>
            <p className="teacher-notification-loop-description">
              通知页真正的价值，不是堆几个阈值开关，而是帮老师把“谁该被提醒、现在该不该发、发完去哪验证”排成一条连续动作链。
            </p>
          </div>
        </div>

        <div className="teacher-notification-loop-signal-grid">
          {signals.map((item) => (
            <div className="teacher-notification-loop-signal-card" key={item.id}>
              <div className="teacher-notification-loop-signal-label">{item.label}</div>
              <div className="teacher-notification-loop-signal-value">{item.value}</div>
              <div className="meta-text">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="teacher-notification-loop-grid">
          {steps.map((item, index) => (
            <div className="teacher-notification-loop-step" key={item.id}>
              <div className="teacher-notification-loop-step-head">
                <span className="teacher-notification-loop-step-index">{item.step}</span>
                <div>
                  <div className="teacher-notification-loop-step-kicker">{item.kicker}</div>
                  <div className="teacher-notification-loop-step-title">{item.title}</div>
                </div>
              </div>
              <p className="teacher-notification-loop-step-description">{item.description}</p>
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
