"use client";

import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";

type ExamCreateLoopCardProps = {
  classLabel: string;
  scopeLabel: string;
  targetLabel: string;
  scheduleLabel: string;
  scheduleMeta: string;
  poolLabel: string;
  poolMeta: string;
};

export default function ExamCreateLoopCard({
  classLabel,
  scopeLabel,
  targetLabel,
  scheduleLabel,
  scheduleMeta,
  poolLabel,
  poolMeta
}: ExamCreateLoopCardProps) {
  const signals = [
    {
      id: "scope",
      label: "当前教学范围",
      value: classLabel,
      meta: scopeLabel
    },
    {
      id: "pool",
      label: "题库收敛风险",
      value: poolLabel,
      meta: poolMeta
    },
    {
      id: "publish",
      label: "发布时间与对象",
      value: scheduleLabel,
      meta: `${scheduleMeta} · ${targetLabel}`
    }
  ];

  const steps = [
    {
      id: "scope",
      step: "01",
      kicker: "先锁范围",
      title: "先确定班级、考试标题和知识点范围",
      description:
        "创建页最先要解决的是考试服务谁、覆盖哪段内容。范围不清，后面所有题量和发布时间决策都会变得不稳定。",
      meta: scopeLabel,
      href: "#exam-create-scope",
      actionLabel: "去设置范围"
    },
    {
      id: "pool",
      step: "02",
      kicker: "再控题库",
      title: "再确认题量、难度、题型，避免筛选过窄",
      description:
        "题库不足不是提交后的意外，而是创建时就该被看见的风险。把可能触发放宽题型、难度、知识点的信号前置，老师才不会来回重试。",
      meta: poolMeta,
      href: "#exam-create-pool",
      actionLabel: "去看题库策略"
    },
    {
      id: "publish",
      step: "03",
      kicker: "最后发布",
      title: "最后复核发布时间、防作弊和目标学生",
      description:
        "发布时间和发布对象决定的是执行质量。确认开始/截止时间、定向学生和监测策略后，再一键发布，避免学生刚收到就遇到时间或名单问题。",
      meta: `${scheduleMeta} · ${targetLabel}`,
      href: "#exam-create-publish",
      actionLabel: "去确认发布"
    }
  ];

  return (
    <Card title="考试创建闭环" tag="Loop">
      <div className="teacher-exam-create-loop">
        <div className="feature-card teacher-exam-create-loop-hero">
          <EduIcon name="rocket" />
          <div>
            <div className="teacher-exam-create-loop-kicker">先锁范围，再控题库，最后发布</div>
            <div className="teacher-exam-create-loop-title">创建页应该把失败挡在提交前。</div>
            <p className="teacher-exam-create-loop-description">
              老师不需要一个单纯的长表单，而是需要一条清楚的发布路径，帮他提前看见题库风险、名单范围和时间冲突。
            </p>
          </div>
        </div>

        <div className="teacher-exam-create-loop-signal-grid">
          {signals.map((item) => (
            <div className="teacher-exam-create-loop-signal-card" key={item.id}>
              <div className="teacher-exam-create-loop-signal-label">{item.label}</div>
              <div className="teacher-exam-create-loop-signal-value">{item.value}</div>
              <div className="meta-text">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="teacher-exam-create-loop-grid">
          {steps.map((item, index) => (
            <div className="teacher-exam-create-loop-step" key={item.id}>
              <div className="teacher-exam-create-loop-step-head">
                <span className="teacher-exam-create-loop-step-index">{item.step}</span>
                <div>
                  <div className="teacher-exam-create-loop-step-kicker">{item.kicker}</div>
                  <div className="teacher-exam-create-loop-step-title">{item.title}</div>
                </div>
              </div>
              <p className="teacher-exam-create-loop-step-description">{item.description}</p>
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
