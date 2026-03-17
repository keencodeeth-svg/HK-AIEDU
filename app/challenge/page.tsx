"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { isAuthError, requestJson } from "@/lib/client-request";
import { getChallengeClaimRequestMessage, getChallengeLoadRequestMessage } from "./utils";

type ChallengeTask = {
  id: string;
  title: string;
  description: string;
  goal: number;
  points: number;
  type: "count" | "streak" | "accuracy" | "mastery";
  progress: number;
  completed: boolean;
  claimed: boolean;
  linkedKnowledgePoints: Array<{
    id: string;
    title: string;
    subject: string;
    grade: string;
  }>;
  unlockRule: string;
  learningProof?: {
    windowDays: number;
    linkedAttempts: number;
    linkedCorrect: number;
    linkedAccuracy: number;
    linkedReviewCorrect: number;
    masteryAverage: number;
    missingActions: string[];
  };
};

type ChallengeExperiment = {
  key: string;
  variant: "control" | "treatment";
  enabled: boolean;
  rollout: number;
};

type ChallengesPayload = {
  data?: {
    tasks?: ChallengeTask[];
    points?: number;
    experiment?: ChallengeExperiment | null;
    result?: {
      ok?: boolean;
      message?: string;
    };
  };
};

export default function ChallengePage() {
  const loadRequestIdRef = useRef(0);
  const hasChallengeSnapshotRef = useRef(false);
  const [tasks, setTasks] = useState<ChallengeTask[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [experiment, setExperiment] = useState<ChallengeExperiment | null>(null);

  const clearChallengeState = useCallback(() => {
    hasChallengeSnapshotRef.current = false;
    setTasks([]);
    setPoints(0);
    setExperiment(null);
    setPageError(null);
    setActionError(null);
    setActionMessage(null);
    setLoadingId(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearChallengeState();
    setAuthRequired(true);
  }, [clearChallengeState]);

  const load = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setLoading(true);
    setPageError(null);

    try {
      const payload = await requestJson<ChallengesPayload>("/api/challenges");
      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      hasChallengeSnapshotRef.current = true;
      setTasks(payload.data?.tasks ?? []);
      setPoints(payload.data?.points ?? 0);
      setExperiment(payload.data?.experiment ?? null);
      setAuthRequired(false);
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        if (!hasChallengeSnapshotRef.current) {
          clearChallengeState();
        }
        setAuthRequired(false);
        setPageError(getChallengeLoadRequestMessage(error, "加载挑战任务失败"));
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [clearChallengeState, handleAuthRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  async function claim(taskId: string) {
    setLoadingId(taskId);
    setActionMessage(null);
    setActionError(null);
    try {
      const payload = await requestJson<ChallengesPayload>("/api/challenges/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId })
      });
      hasChallengeSnapshotRef.current = true;
      setTasks(payload.data?.tasks ?? []);
      setPoints(payload.data?.points ?? 0);
      setExperiment(payload.data?.experiment ?? null);
      setAuthRequired(false);
      setPageError(null);
      if (payload.data?.result?.ok === false) {
        setActionError(payload.data.result.message ?? "领取失败");
      } else if (payload.data?.result?.ok === true) {
        setActionMessage(payload.data.result.message ?? "奖励领取成功");
      }
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        setActionError(getChallengeClaimRequestMessage(error, "领取奖励失败"));
      }
    } finally {
      setLoadingId(null);
    }
  }

  if (loading && !tasks.length && !authRequired) {
    return <StatePanel title="挑战任务加载中" description="正在同步当前积分、挑战任务与奖励状态。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可查看挑战任务、积分与奖励领取状态。"
        tone="info"
      />
    );
  }

  if (pageError && !tasks.length) {
    return (
      <StatePanel
        title="挑战任务暂时不可用"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void load()}>
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

      {pageError ? (
        <StatePanel
          compact
          tone="error"
          title="本次刷新存在异常"
          description={pageError}
          action={
            <button className="button secondary" type="button" onClick={() => void load()}>
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
          <div style={{ fontSize: 24, fontWeight: 700 }}>{points}</div>
          {experiment ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
              实验分组：{experiment.variant === "treatment" ? "实验组" : "对照组"} · 灰度 {experiment.rollout}%
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
        {actionMessage ? <div style={{ marginBottom: 10 }}>{actionMessage}</div> : null}
        {actionError ? <div style={{ marginBottom: 10, color: "#b42318" }}>{actionError}</div> : null}
        <div className="grid" style={{ gap: 12 }}>
          {tasks.map((task) => (
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
                  onClick={() => claim(task.id)}
                  disabled={!task.completed || task.claimed || loadingId === task.id}
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
