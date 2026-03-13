"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";
import type {
  AnalysisAlertItem,
  AnalysisClassItem,
  AnalysisHeatItem,
  AnalysisInterventionCausalitySummary,
  AnalysisParentCollaborationSummary,
  AnalysisReportData
} from "../types";

type AnalysisDecisionLoopCardProps = {
  selectedClass: AnalysisClassItem | null;
  alerts: AnalysisAlertItem[];
  heatmap: AnalysisHeatItem[];
  causalitySummary: AnalysisInterventionCausalitySummary | null;
  parentCollaboration: AnalysisParentCollaborationSummary | null;
  report: AnalysisReportData | null;
};

function formatClassLabel(selectedClass: AnalysisClassItem | null) {
  if (!selectedClass) return "当前班级";
  return `${selectedClass.name} · ${SUBJECT_LABELS[selectedClass.subject] ?? selectedClass.subject} · ${selectedClass.grade} 年级`;
}

export default function AnalysisDecisionLoopCard({
  selectedClass,
  alerts,
  heatmap,
  causalitySummary,
  parentCollaboration,
  report
}: AnalysisDecisionLoopCardProps) {
  const activeAlerts = alerts.filter((item) => item.status === "active");
  const topAlert =
    [...activeAlerts].sort((left, right) => {
      if (left.riskScore !== right.riskScore) return right.riskScore - left.riskScore;
      return left.type.localeCompare(right.type);
    })[0] ?? null;
  const weakestKnowledgePoint =
    [...heatmap].sort((left, right) => {
      if (left.ratio !== right.ratio) return left.ratio - right.ratio;
      return right.total - left.total;
    })[0] ?? null;
  const evidenceReadyRate = causalitySummary?.evidenceReadyRate ?? 0;
  const improvedActionCount = causalitySummary?.improvedActionCount ?? 0;
  const classLabel = formatClassLabel(selectedClass);

  const loopSignals = [
    {
      id: "risk",
      label: "当前最先处理",
      value: topAlert ? `${topAlert.type === "student-risk" ? "学生风险" : "知识点风险"} · ${topAlert.riskScore} 分` : "当前没有活跃预警",
      meta: topAlert ? topAlert.riskReason : "可以把时间投到薄弱点复盘和教学前置准备"
    },
    {
      id: "weak",
      label: "当前最弱知识点",
      value: weakestKnowledgePoint ? weakestKnowledgePoint.title : "等待更多练习数据",
      meta: weakestKnowledgePoint
        ? `正确率 ${weakestKnowledgePoint.ratio}% · 练习 ${weakestKnowledgePoint.total} 次`
        : "热力图出现数据后，这里会给出当前最值得先讲评的点"
    },
    {
      id: "evidence",
      label: "干预证据",
      value: causalitySummary ? `${evidenceReadyRate}% 样本已可验证效果` : "还没有干预证据",
      meta: causalitySummary
        ? `已看到 ${improvedActionCount} 个正向动作${parentCollaboration ? ` · 家长回执完成率 ${parentCollaboration.doneRate}%` : ""}`
        : report
          ? "可以先生成班级报告，再结合后续动作验证效果"
          : "先执行预警动作，再回来观察 24h/72h 与因果证据"
    }
  ];

  const loopSteps = [
    {
      id: "risk",
      step: "01",
      kicker: "先判断风险",
      title: topAlert ? `先处理「${topAlert.recommendedAction}」` : "先确认当前没有遗漏的高风险项",
      description: topAlert
        ? `${classLabel} 当前最需要优先处理的是这一条风险信号。先清它，最能减少后续教学动作的无效切换。`
        : `${classLabel} 当前没有显著风险阻塞，可以直接进入薄弱点复盘和任务安排。`,
      meta: topAlert ? `风险原因：${topAlert.riskReason}` : "当前更适合做前置安排而不是救火",
      href: "#analysis-alerts",
      actionLabel: topAlert ? "去处理预警" : "查看预警面板"
    },
    {
      id: "heatmap",
      step: "02",
      kicker: "再确定讲什么",
      title: weakestKnowledgePoint ? `围绕「${weakestKnowledgePoint.title}」安排讲评或修复` : "先等热力图补齐薄弱点",
      description: weakestKnowledgePoint
        ? "预警告诉你先管哪类风险，热力图告诉你课堂上具体该讲什么。把这两者连起来，动作才会落到具体知识点。"
        : "当练习量还不足时，先通过作业和预警积累班级信号，后续热力图会更可靠。",
      meta: weakestKnowledgePoint
        ? `${weakestKnowledgePoint.unit ? `${weakestKnowledgePoint.unit} / ` : ""}${weakestKnowledgePoint.chapter}`
        : "热力图数据越完整，讲评指向越清楚",
      href: "#analysis-heatmap",
      actionLabel: "查看热力图"
    },
    {
      id: "verify",
      step: "03",
      kicker: "最后验证动作",
      title: causalitySummary ? "回看干预证据和学情报告" : "做完动作后回来验证效果",
      description: causalitySummary
        ? "不是做了动作就算闭环，而是要看到执行率、分数变化和家校协同效果有没有真的抬起来。"
        : "如果现在还没有证据样本，先执行预警动作并生成班级报告，后面再回来判断这些动作是否真的有效。",
      meta: causalitySummary
        ? `观察窗口内共有 ${causalitySummary.actionCount} 次动作`
        : report
          ? "报告已可用，后续重点是补齐干预证据"
          : "先生成一版班级报告，便于统一传达与复盘",
      href: causalitySummary ? "#analysis-causality" : "#analysis-report",
      actionLabel: causalitySummary ? "查看干预证据" : "去生成报告"
    }
  ];

  return (
    <Card title="分析决策闭环" tag="Decision">
      <div className="analysis-decision-loop">
        <div className="feature-card analysis-decision-loop-hero">
          <EduIcon name="chart" />
          <div>
            <div className="analysis-decision-loop-kicker">别把分析页只当作看图页</div>
            <div className="analysis-decision-loop-title">
              先判断哪类风险最该先处理，再锁定课堂讲评知识点，最后回到证据和报告看动作有没有真正起效。
            </div>
            <p className="analysis-decision-loop-description">
              这页的价值不是信息更多，而是把今天对这个班最有效的教学判断顺序排出来。
            </p>
          </div>
        </div>

        <div className="analysis-decision-loop-signal-grid">
          {loopSignals.map((item) => (
            <div className="analysis-decision-loop-signal-card" key={item.id}>
              <div className="analysis-decision-loop-signal-label">{item.label}</div>
              <div className="analysis-decision-loop-signal-value">{item.value}</div>
              <div className="meta-text">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="analysis-decision-loop-grid">
          {loopSteps.map((item, index) => (
            <div className="analysis-decision-loop-step" key={item.id}>
              <div className="analysis-decision-loop-step-head">
                <span className="analysis-decision-loop-step-index">{item.step}</span>
                <div>
                  <div className="analysis-decision-loop-step-kicker">{item.kicker}</div>
                  <div className="analysis-decision-loop-step-title">{item.title}</div>
                </div>
              </div>
              <p className="analysis-decision-loop-step-description">{item.description}</p>
              <div className="meta-text">{item.meta}</div>
              <div className="cta-row" style={{ marginTop: 10 }}>
                <a className={index === 0 ? "button primary" : "button secondary"} href={item.href}>
                  {item.actionLabel}
                </a>
                {index === 2 && report ? (
                  <Link className="button ghost" href="/teacher">
                    回教师工作台
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
