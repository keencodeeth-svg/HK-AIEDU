"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { trackEvent } from "@/lib/analytics-client";
import type { ScheduleResponse } from "@/lib/class-schedules";
import { buildTutorLaunchHref } from "@/lib/tutor-launch";
import type { TodayTask, TodayTaskEventName, TodayTaskPayload } from "../types";
import { getStudentLessonWindow, getStudentTaskTimingAdvice, getTodayTaskSourceLabel, getTodayTaskStatusLabel } from "../utils";

type StudentNextActionCardProps = {
  schedule: ScheduleResponse["data"] | null;
  todayTasks: TodayTaskPayload | null;
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

function formatLessonRange(startAt: string, endAt: string) {
  return `${new Date(startAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}-${new Date(endAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}


export default function StudentNextActionCard({
  schedule,
  todayTasks,
  recommendedTask,
  mustDoCount,
  totalTaskCount,
  weakPlanCount,
  onTaskEvent
}: StudentNextActionCardProps) {
  const tutorHref = buildTutorLaunchHref({ intent: "image", source: "student-next-action" });
  const lessonTutorHref = buildTutorLaunchHref({ intent: "image", source: "student-next-action-lesson-window" });
  const lessonWindow = getStudentLessonWindow(schedule);
  const { nextLesson, minutesUntilNextLesson, lessonInProgress, lessonWindowActive } = lessonWindow;
  const linkedLessonTask = nextLesson && todayTasks?.tasks?.length
    ? todayTasks.tasks.find((task) => task.source === "lesson" && task.sourceId === nextLesson.id) ?? null
    : null;
  const lessonActionHref = nextLesson?.actionHref ?? linkedLessonTask?.href ?? "/calendar";
  const lessonActionLabel = lessonInProgress
    ? nextLesson?.actionLabel ?? "回到课堂任务"
    : nextLesson?.prestudyAssignmentTitle
      ? nextLesson?.actionLabel ?? "先完成预习"
      : nextLesson?.pendingAssignmentCount
        ? nextLesson?.actionLabel ?? "先做课前准备"
        : nextLesson?.actionLabel ?? "先看下节课";

  function trackAuxiliaryAction(action: "queue" | "tutor" | "practice" | "lesson" | "post_lesson_queue") {
    trackEvent({
      eventName: "student_next_action_clicked",
      page: "/student",
      props: {
        action,
        recommendedTaskId: recommendedTask?.id ?? null,
        mustDoCount,
        totalTaskCount,
        weakPlanCount,
        nextLessonId: nextLesson?.id ?? null,
        nextLessonStatus: nextLesson?.status ?? null
      }
    });
  }

  const canStartRecommendedNow = recommendedTask ? getStudentTaskTimingAdvice(recommendedTask, schedule).canStartNow : false;

  if (lessonWindowActive && nextLesson) {
    const lessonHeadline = lessonInProgress
      ? `${nextLesson.className} 正在进行`
      : `先准备 ${nextLesson.className}`;
    const lessonDescription = lessonInProgress
      ? linkedLessonTask
        ? "当前已进入上课时段，优先处理课堂任务；其他任务留到课后再收口。"
        : "当前已进入上课时段，先聚焦课堂任务和老师要求，别再开新坑。"
      : !canStartRecommendedNow && recommendedTask
        ? `距离上课还有 ${minutesUntilNextLesson} 分钟，而“${recommendedTask.title}”预计需要 ${recommendedTask.effortMinutes} 分钟，现在开新任务大概率会被打断。`
        : nextLesson.prestudyAssignmentTitle
          ? `距离上课还有 ${minutesUntilNextLesson} 分钟，先把“${nextLesson.prestudyAssignmentTitle}”推进掉，进入课堂会更顺。`
          : nextLesson.pendingAssignmentCount > 0
            ? `距离上课还有 ${minutesUntilNextLesson} 分钟，先确认关联作业和课堂焦点，临上课会更从容。`
            : `距离上课还有 ${minutesUntilNextLesson} 分钟，适合做课前准备或快速核对问题，不适合再开长任务。`;
    const postLessonHint = recommendedTask && recommendedTask.source !== "lesson"
      ? `课后第一项仍是“${recommendedTask.title}”，预计 ${recommendedTask.effortMinutes} 分钟。`
      : "课后再回到今日任务队列继续推进，不需要现在重新判断。";

    return (
      <Card title="现在最值得先做" tag="Focus">
        <div className="student-next-action-layout">
          <div className="student-next-action-hero">
            <div className="feature-card" style={{ alignItems: "flex-start" }}>
              <EduIcon name="rocket" />
              <div>
                <div className="student-next-action-kicker">受课表影响</div>
                <div className="student-next-action-title">{lessonHeadline}</div>
                <p className="student-next-action-description">{lessonDescription}</p>
              </div>
            </div>

            <div className="badge-row">
              <span className="badge">{lessonInProgress ? "上课中" : `${minutesUntilNextLesson ?? 0} 分钟后上课`}</span>
              <span className="badge">{nextLesson.subjectLabel}</span>
              <span className="badge">{formatLessonRange(nextLesson.startAt, nextLesson.endAt)}</span>
              {nextLesson.room ? <span className="badge">{nextLesson.room}</span> : null}
              {nextLesson.prestudyAssignmentTitle ? <span className="badge">预习已布置</span> : null}
              {nextLesson.pendingAssignmentCount ? <span className="badge">关联任务 {nextLesson.pendingAssignmentCount} 项</span> : null}
            </div>

            <div className="student-next-action-reason">
              <div className="student-next-action-reason-label">为什么现在先这样做</div>
              <div className="meta-text" style={{ lineHeight: 1.65 }}>
                {nextLesson.focusSummary ? `课堂焦点：${nextLesson.focusSummary}。` : "先围绕课堂准备，能显著减少临近上课时的手忙脚乱。"}
                {nextLesson.prestudyAssignmentTitle ? ` 课前预习是“${nextLesson.prestudyAssignmentTitle}”。` : ""}
                {" "}{postLessonHint}
              </div>
            </div>

            <div className="cta-row">
              <Link
                className="button primary"
                href={lessonActionHref}
                onClick={() => {
                  if (linkedLessonTask) {
                    onTaskEvent(linkedLessonTask, "task_started");
                  }
                  trackAuxiliaryAction("lesson");
                }}
              >
                {lessonActionLabel}
              </Link>
              <Link
                className="button secondary"
                href={lessonTutorHref}
                onClick={() => trackAuxiliaryAction("tutor")}
              >
                课前快问
              </Link>
              <a
                className="button ghost"
                href="#student-task-queue"
                onClick={() => trackAuxiliaryAction("post_lesson_queue")}
              >
                {recommendedTask && recommendedTask.source !== "lesson" ? "看课后第一项" : "查看完整队列"}
              </a>
            </div>
          </div>

          <div className="student-next-action-rail">
            <div className="student-next-action-metric">
              <div className="section-title">当前窗口</div>
              <div className="student-next-action-metric-value">{lessonInProgress ? "课堂中" : `${minutesUntilNextLesson ?? 0} 分钟`}</div>
              <div className="meta-text">{lessonInProgress ? "先聚焦课堂，不再开新任务。" : "只做能快速收口的动作。"}</div>
            </div>
            <div className="student-next-action-metric">
              <div className="section-title">关联待办</div>
              <div className="student-next-action-metric-value">{nextLesson.prestudyAssignmentTitle ? 1 : nextLesson.pendingAssignmentCount}</div>
              <div className="meta-text">{nextLesson.prestudyAssignmentTitle ? "预习先完成，进入课堂更顺手。" : "先清课堂相关事项，切换成本最低。"}</div>
            </div>
            <div className="student-next-action-metric">
              <div className="section-title">课后第一项</div>
              <div className="student-next-action-metric-value">{recommendedTask && recommendedTask.source !== "lesson" ? recommendedTask.effortMinutes : 0}</div>
              <div className="meta-text">{recommendedTask && recommendedTask.source !== "lesson" ? `${recommendedTask.title} · 预计 ${recommendedTask.effortMinutes} 分钟` : "课后回到今日队列继续推进。"}</div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (!recommendedTask) {
    const nextLessonLabel = nextLesson
      ? `${nextLesson.subjectLabel} · ${formatLessonRange(nextLesson.startAt, nextLesson.endAt)}`
      : "今天没有下一节课，按任务队列推进即可。";

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
              <div className="section-title">下一节课</div>
              <div className="meta-text">{nextLessonLabel}</div>
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
              {nextLesson && !lessonWindowActive ? ` 下一节课是 ${nextLesson.subjectLabel}，当前时间仍足够，适合先把这项推进一段。` : ""}
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
                    weakPlanCount,
                    nextLessonId: nextLesson?.id ?? null
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
            <div className="section-title">{nextLesson ? "下一节课" : "薄弱项"}</div>
            <div className="student-next-action-metric-value">{nextLesson ? (minutesUntilNextLesson ?? 0) : weakPlanCount}</div>
            <div className="meta-text">{nextLesson ? `${nextLesson.subjectLabel} · ${formatLessonRange(nextLesson.startAt, nextLesson.endAt)}` : `卡题时优先用拍题即问，别硬耗时间。`}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
