"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { useChallengePage } from "./useChallengePage";

export default function ChallengePage() {
  const challengePage = useChallengePage();

  if (challengePage.loading && !challengePage.tasks.length && !challengePage.authRequired) {
    return <StatePanel title="挑战任务加载中" description="正在同步当前积分、挑战任务与奖励状态。" tone="loading" />;
  }

  if (challengePage.authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可查看挑战任务、积分与奖励领取状态。"
        tone="info"
      />
    );
  }

  if (challengePage.pageError && !challengePage.tasks.length) {
    return (
      <StatePanel
        title="挑战任务暂时不可用"
        description={challengePage.pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void challengePage.load()}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>闯关式任务</h2>
          <div className="section-sub">挑战目标驱动学习节奏，获取奖励积分。</div>
        </div>
        <span className="chip">挑战系统</span>
      </div>

      {challengePage.pageError ? (
        <StatePanel
          compact
          tone="error"
          title="本次刷新存在异常"
          description={challengePage.pageError}
          action={
            <button className="button secondary" type="button" onClick={() => void challengePage.load()}>
              再试一次
            </button>
          }
        />
      ) : null}

      <Card title="闯关式任务系统" tag="激励">
        <div className="feature-card">
          <EduIcon name="trophy" />
          <p>完成挑战获取奖励积分，用于激励学习。</p>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="section-title">当前积分</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{challengePage.points}</div>
          {challengePage.experiment ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
              实验分组：{challengePage.experiment.variant === "treatment" ? "实验组" : "对照组"} · 灰度{" "}
              {challengePage.experiment.rollout}%
            </div>
          ) : null}
        </div>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <Link className="button secondary" href="/practice?mode=challenge">
            进入闯关练习
          </Link>
        </div>
      </Card>

      <Card title="挑战任务" tag="清单">
        {challengePage.actionMessage ? <div style={{ marginBottom: 10 }}>{challengePage.actionMessage}</div> : null}
        {challengePage.actionError ? (
          <div style={{ marginBottom: 10, color: "#b42318" }}>{challengePage.actionError}</div>
        ) : null}
        <div className="grid" style={{ gap: 12 }}>
          {challengePage.tasks.map((task) => (
            <div className="card" key={task.id}>
              <div className="section-title">{task.title}</div>
              <p>{task.description}</p>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                进度：
                {task.type === "accuracy" || task.type === "mastery"
                  ? `${task.progress}%`
                  : `${task.progress}/${task.goal}`}{" "}
                · 奖励 {task.points} 积分
              </div>
              {task.linkedKnowledgePoints?.length ? (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {task.linkedKnowledgePoints.map((item) => (
                    <span className="badge" key={`${task.id}-${item.id}`}>
                      {item.title}
                    </span>
                  ))}
                </div>
              ) : null}
              <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 8 }}>
                解锁规则：{task.unlockRule}
              </div>
              {task.learningProof ? (
                <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 6 }}>
                  学习证明：近 {task.learningProof.windowDays} 天练习 {task.learningProof.linkedAttempts} 题，
                  正确率 {task.learningProof.linkedAccuracy}% ，错题复练答对 {task.learningProof.linkedReviewCorrect} 次，
                  掌握度均分 {task.learningProof.masteryAverage}。
                </div>
              ) : null}
              {!task.completed && task.learningProof?.missingActions?.length ? (
                <div style={{ marginTop: 6, color: "#b42318", fontSize: 12 }}>
                  未达成：{task.learningProof.missingActions[0]}
                </div>
              ) : null}
              <div className="cta-row" style={{ marginTop: 8 }}>
                <button
                  className="button primary"
                  onClick={() => void challengePage.claim(task.id)}
                  disabled={!task.completed || task.claimed || challengePage.loadingId === task.id}
                >
                  {task.claimed ? "已领取" : task.completed ? "领取奖励" : "未完成"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
