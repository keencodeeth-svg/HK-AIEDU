"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { trackEvent } from "@/lib/analytics-client";
import { buildTutorLaunchHref } from "@/lib/tutor-launch";
import type { TodayTask, TodayTaskEventName } from "../types";
import { getTodayTaskSourceLabel, getTodayTaskStatusLabel } from "../utils";

type StudentNextActionCardProps = {
  recommendedTask: TodayTask | null;
  mustDoCount: number;
  totalTaskCount: number;
  weakPlanCount: number;
  onTaskEvent: (task: TodayTask, eventName: TodayTaskEventName) => void;
};

function formatDueAt(value: string | null) {
  if (!value) return "时间相对宽松";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function StudentNextActionCard({
  recommendedTask,
  mustDoCount,
  totalTaskCount,
  weakPlanCount,
  onTaskEvent
}: StudentNextActionCardProps) {
  const tutorHref = buildTutorLaunchHref({ intent: "image", source: "student-next-action" });

  function trackAuxiliaryAction(action: "queue" | "tutor" | "practice") {
    trackEvent({
      eventName: "student_next_action_clicked",
      page: "/student",
      props: {
        action,
        recommendedTaskId: recommendedTask?.id ?? null,
        mustDoCount,
        totalTaskCount,
        weakPlanCount
      }
    });
  }

  if (!recommendedTask) {
    return (
      <Card title="现在最值得先做" tag="Focus">
        <div className="student-next-action-layout">
          <div className="student-next-action-hero">
            <div className="feature-card" style={{ alignItems: "flex-start" }}>
              <EduIcon name="rocket" />
              <div>
                <div className="student-next-action-kicker">今日建议</div>
                <div className="student-next-action-title">当前没有卡住你的必做任务</div>
                <p className="student-next-action-description">
                  适合进入一轮智能练习或拍题即问，保持学习节奏，不用在首页来回判断下一步做什么。
                </p>
              </div>
            </div>

            <div className="badge-row">
              <span className="badge">必做 {mustDoCount}</span>
              <span className="badge">总任务 {totalTaskCount}</span>
              <span className="badge">薄弱项 {weakPlanCount}</span>
            </div>

            <div className="student-next-action-reason">
              <div className="student-next-action-reason-label">为什么这样安排</div>
              <div className="meta-text" style={{ lineHeight: 1.65 }}>
                当高优先任务清空时，最好的动作是用短平快练习保持手感，或者把不会的题直接拍下来问，减少重新进入状态的成本。
              </div>
            </div>

            <div className="cta-row">
              <Link
                className="button primary"
                href="/practice"
                onClick={() => trackAuxiliaryAction("practice")}
              >
                去做一轮练习
              </Link>
              <Link
                className="button secondary"
                href={tutorHref}
                onClick={() => trackAuxiliaryAction("tutor")}
              >
                卡住就拍题
              </Link>
              <a className="button ghost" href="#student-task-queue" onClick={() => trackAuxiliaryAction("queue")}>
                查看完整队列
              </a>
            </div>
          </div>

          <div className="student-next-action-rail">
            <div className="student-next-action-summary">
              <div className="section-title">低决策成本</div>
              <div className="meta-text">先给你一个明确动作，避免在首页停留太久。</div>
            </div>
            <div className="student-next-action-summary">
              <div className="section-title">不中断节奏</div>
              <div className="meta-text">练习、拍题、完整队列三个入口覆盖大多数真实学习场景。</div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="现在最值得先做" tag="Focus">
      <div className="student-next-action-layout">
        <div className="student-next-action-hero">
          <div className="feature-card" style={{ alignItems: "flex-start" }}>
            <EduIcon name="rocket" />
            <div>
              <div className="student-next-action-kicker">推荐下一步</div>
              <div className="student-next-action-title">{recommendedTask.title}</div>
              <p className="student-next-action-description">{recommendedTask.description}</p>
            </div>
          </div>

          <div className="badge-row">
            <span className="badge">{getTodayTaskSourceLabel(recommendedTask.source)}</span>
            <span className="badge">{getTodayTaskStatusLabel(recommendedTask.status)}</span>
            <span className="badge">预计 {recommendedTask.effortMinutes} 分钟</span>
            <span className="badge">收益 {recommendedTask.expectedGain}</span>
            <span className="badge">{formatDueAt(recommendedTask.dueAt)}</span>
          </div>

          <div className="student-next-action-reason">
            <div className="student-next-action-reason-label">为什么先做</div>
            <div className="meta-text" style={{ lineHeight: 1.65 }}>
              {recommendedTask.recommendedReason}
            </div>
          </div>

          <div className="cta-row">
            <Link
              className="button primary"
              href={recommendedTask.href}
              onClick={() => {
                onTaskEvent(recommendedTask, "task_started");
                trackEvent({
                  eventName: "student_next_action_started",
                  page: "/student",
                  props: {
                    taskId: recommendedTask.id,
                    source: recommendedTask.source,
                    status: recommendedTask.status,
                    mustDoCount,
                    totalTaskCount,
                    weakPlanCount
                  }
                });
              }}
            >
              立即开始
            </Link>
            <Link
              className="button secondary"
              href={tutorHref}
              onClick={() => trackAuxiliaryAction("tutor")}
            >
              卡住就拍题
            </Link>
            <a className="button ghost" href="#student-task-queue" onClick={() => trackAuxiliaryAction("queue")}>
              查看完整队列
            </a>
          </div>
        </div>

        <div className="student-next-action-rail">
          <div className="student-next-action-metric">
            <div className="section-title">必做剩余</div>
            <div className="student-next-action-metric-value">{mustDoCount}</div>
            <div className="meta-text">先清空这一组，今天会轻松很多。</div>
          </div>
          <div className="student-next-action-metric">
            <div className="section-title">总任务</div>
            <div className="student-next-action-metric-value">{totalTaskCount}</div>
            <div className="meta-text">看清今天任务量，避免一开始就焦虑。</div>
          </div>
          <div className="student-next-action-metric">
            <div className="section-title">薄弱项</div>
            <div className="student-next-action-metric-value">{weakPlanCount}</div>
            <div className="meta-text">卡题时优先用拍题即问，别硬耗时间。</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
