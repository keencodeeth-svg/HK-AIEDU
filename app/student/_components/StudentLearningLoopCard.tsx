"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { trackEvent } from "@/lib/analytics-client";
import { buildTutorLaunchHref } from "@/lib/tutor-launch";
import type { StudentRadarSnapshot, TodayTask, TodayTaskEventName, TodayTaskPayload } from "../types";
import { getTodayTaskSourceLabel } from "../utils";

type StudentLearningLoopCardProps = {
  recommendedTask: TodayTask | null;
  todayTasks: TodayTaskPayload | null;
  radarSnapshot: StudentRadarSnapshot | null;
  onTaskEvent: (task: TodayTask, eventName: TodayTaskEventName) => void;
};

function buildPracticeHref(input?: { subject?: string; knowledgePointId?: string }) {
  const searchParams = new URLSearchParams();
  if (input?.subject?.trim()) {
    searchParams.set("subject", input.subject.trim());
  }
  if (input?.knowledgePointId?.trim()) {
    searchParams.set("knowledgePointId", input.knowledgePointId.trim());
  }
  const query = searchParams.toString();
  return query ? `/practice?${query}` : "/practice";
}

export default function StudentLearningLoopCard({
  recommendedTask,
  todayTasks,
  radarSnapshot,
  onTaskEvent
}: StudentLearningLoopCardProps) {
  const recentTutorMomentum = todayTasks?.recentStudyVariantActivity ?? null;
  const weakFocus = radarSnapshot?.weakKnowledgePoint ?? null;
  const tutorSubject = recentTutorMomentum?.latestSubject ?? weakFocus?.subject;
  const tutorHref = buildTutorLaunchHref({
    intent: "image",
    source: "student-learning-loop",
    subject: tutorSubject
  });
  const loopSignals = [
    {
      id: "task",
      label: "当前第一项",
      value: recommendedTask ? recommendedTask.title : "先用一轮正式练习起步",
      meta: recommendedTask
        ? `${getTodayTaskSourceLabel(recommendedTask.source)} · 预计 ${recommendedTask.effortMinutes} 分钟`
        : "当前没有单点风险时，先练习最容易进入状态"
    },
    {
      id: "tutor",
      label: "Tutor 动量",
      value: recentTutorMomentum ? recentTutorMomentum.latestKnowledgePointTitle : "卡题时直接打开 Tutor",
      meta: recentTutorMomentum
        ? `最近 24 小时巩固 ${recentTutorMomentum.recentAttemptCount} 题`
        : "支持图片识题、文字追问、学习模式与历史回放"
    },
    {
      id: "portrait",
      label: "画像盯点",
      value: weakFocus ? weakFocus.title : "做完后回看学习画像",
      meta: weakFocus
        ? `掌握 ${weakFocus.masteryScore} 分${typeof weakFocus.weaknessRank === "number" ? ` · 优先级 #${weakFocus.weaknessRank}` : ""}`
        : "系统会随着练习和 Tutor 结果继续补全画像"
    }
  ];

  const loopSteps = [
    {
      id: "now",
      step: "01",
      kicker: "现在先做",
      title: recommendedTask ? recommendedTask.title : "先进入一轮正式练习",
      description: recommendedTask
        ? recommendedTask.recommendedReason
        : "当前没有单个任务压住你，先做一轮练习最容易保持今天的学习节奏。",
      meta: recommendedTask
        ? `${getTodayTaskSourceLabel(recommendedTask.source)} · 预计 ${recommendedTask.effortMinutes} 分钟`
        : "系统会继续根据表现更新今日优先级",
      actionLabel: recommendedTask ? "开始第一项" : "开始练习",
      href:
        recommendedTask?.href ??
        buildPracticeHref({
          subject: weakFocus?.subject,
          knowledgePointId: weakFocus?.knowledgePointId
        }),
      primary: true,
      onClick: () => {
        if (recommendedTask) {
          onTaskEvent(recommendedTask, "task_started");
        }
        trackEvent({
          eventName: "student_learning_loop_clicked",
          page: "/student",
          props: {
            step: "now",
            taskId: recommendedTask?.id ?? null,
            taskSource: recommendedTask?.source ?? "practice"
          }
        });
      }
    },
    {
      id: "stuck",
      step: "02",
      kicker: "卡住时别停",
      title: recentTutorMomentum
        ? `继续追问「${recentTutorMomentum.latestKnowledgePointTitle}」`
        : "不会的题直接拍下来问",
      description: recentTutorMomentum
        ? recentTutorMomentum.latestCorrect
          ? "你刚在 Tutor 已经把这类题做通一轮了，卡住时继续拍题追问，最容易把“会做”变成“稳定会做”。"
          : "你刚在 Tutor 暴露过这个知识点的薄弱处，再问同类题能更快查出真正卡点。"
        : "不要退出当前节奏回首页重新找入口，拍题即问能把卡点压缩在当下解决。",
      meta: recentTutorMomentum
        ? `最近 24 小时 Tutor 巩固 ${recentTutorMomentum.recentAttemptCount} 题`
        : "支持图片识题、文字追问、学习模式与历史回放",
      actionLabel: recentTutorMomentum ? "继续问同类题" : "打开 Tutor",
      href: tutorHref,
      primary: false,
      onClick: () => {
        trackEvent({
          eventName: "student_learning_loop_clicked",
          page: "/student",
          props: {
            step: "stuck",
            taskId: recommendedTask?.id ?? null,
            tutorSubject: tutorSubject ?? null,
            momentumKnowledgePointId: recentTutorMomentum?.latestKnowledgePointId ?? null
          }
        });
      }
    },
    {
      id: "close",
      step: "03",
      kicker: "做完后收口",
      title: weakFocus ? `回看画像里的「${weakFocus.title}」` : "去学习画像确认进展",
      description: weakFocus
        ? `当前最值得持续盯住的是这个薄弱点。做完当前任务后，回画像页确认它的掌握分和优先级有没有松动。`
        : "做完后别只看是否完成，顺手回画像页确认能力和掌握度有没有变化，才算形成闭环。",
      meta: weakFocus
        ? `掌握 ${weakFocus.masteryScore} 分${typeof weakFocus.weaknessRank === "number" ? ` · 当前优先级 #${weakFocus.weaknessRank}` : ""}`
        : "画像会持续沉淀能力雷达、薄弱知识点和 Tutor 巩固变化",
      actionLabel: "查看学习画像",
      href: "/student/portrait",
      primary: false,
      onClick: () => {
        trackEvent({
          eventName: "student_learning_loop_clicked",
          page: "/student",
          props: {
            step: "close",
            weakKnowledgePointId: weakFocus?.knowledgePointId ?? null
          }
        });
      }
    }
  ];

  return (
    <Card title="今日学习路线" tag="闭环">
      <div className="student-learning-loop">
        <div className="feature-card student-learning-loop-hero">
          <EduIcon name="rocket" />
          <div>
            <div className="student-learning-loop-kicker">别在首页反复判断</div>
            <div className="student-learning-loop-title">
              系统已经帮你排好今天最短的学习闭环：先做任务，卡住就问，做完回看画像。
            </div>
            <p className="student-learning-loop-description">
              目标不是把入口都看一遍，而是用最少决策成本把今天真正有效的一轮学习推进完。
            </p>
          </div>
        </div>

        <div className="student-learning-loop-signal-grid">
          {loopSignals.map((item) => (
            <div className="student-learning-loop-signal-card" key={item.id}>
              <div className="student-learning-loop-signal-label">{item.label}</div>
              <div className="student-learning-loop-signal-value">{item.value}</div>
              <div className="meta-text">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="student-learning-loop-grid">
          {loopSteps.map((item) => (
            <div className="student-learning-loop-step" key={item.id}>
              <div className="student-learning-loop-step-head">
                <span className="student-learning-loop-step-index">{item.step}</span>
                <div>
                  <div className="student-learning-loop-step-kicker">{item.kicker}</div>
                  <div className="student-learning-loop-step-title">{item.title}</div>
                </div>
              </div>
              <p className="student-learning-loop-step-description">{item.description}</p>
              <div className="meta-text">{item.meta}</div>
              <div className="cta-row" style={{ marginTop: 10 }}>
                <Link className={item.primary ? "button primary" : "button secondary"} href={item.href} onClick={item.onClick}>
                  {item.actionLabel}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
