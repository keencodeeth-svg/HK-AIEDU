import Link from "next/link";
import Card from "@/components/Card";
import type { TodayTask, TodayTaskEventName } from "../types";
import { getTodayTaskStatusLabel } from "../utils";

type StudentPriorityTasksCardProps = {
  todayTaskError: string | null;
  visiblePriorityTasks: TodayTask[];
  hiddenTodayTaskCount: number;
  onTaskEvent: (task: TodayTask, eventName: TodayTaskEventName) => void;
};

export default function StudentPriorityTasksCard({
  todayTaskError,
  visiblePriorityTasks,
  hiddenTodayTaskCount,
  onTaskEvent
}: StudentPriorityTasksCardProps) {
  return (
    <Card title="今日高优先任务" tag="队列">
      {todayTaskError ? <div className="status-note error">{todayTaskError}</div> : null}
      {visiblePriorityTasks.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">当前暂无待处理任务</p>
          <p className="meta-text">保持节奏即可，建议先进入学习工具完成一次练习。</p>
        </div>
      ) : (
        <div className="stack-8">
          {visiblePriorityTasks.map((task, index) => (
            <div
              key={task.id}
              style={{
                border: "1px solid var(--stroke)",
                borderRadius: 12,
                background: "rgba(255,255,255,0.72)",
                padding: 10
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}
                >
                  TOP {index + 1} · {task.title}
                </div>
                <span className="card-tag">{getTodayTaskStatusLabel(task.status)}</span>
              </div>
              <p
                className="meta-text"
                style={{
                  marginTop: 6,
                  display: "-webkit-box",
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden"
                }}
              >
                {task.description}
              </p>
              <div className="badge-row" style={{ marginTop: 6 }}>
                {task.tags.slice(0, 2).map((tag) => (
                  <span className="badge" key={`${task.id}-${tag}`}>
                    {tag}
                  </span>
                ))}
                <span className="badge">预计 {task.effortMinutes} 分钟</span>
                <span className="badge">预期收益 {task.expectedGain}</span>
                {task.dueAt ? <span className="badge">截止 {new Date(task.dueAt).toLocaleDateString("zh-CN")}</span> : null}
              </div>
              <div className="cta-row cta-row-tight" style={{ marginTop: 8 }}>
                <Link className="button secondary" href={task.href} onClick={() => onTaskEvent(task, "task_started")}>
                  去完成
                </Link>
                <button className="button ghost" type="button" onClick={() => onTaskEvent(task, "task_skipped")}>
                  暂后处理
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {hiddenTodayTaskCount > 0 ? (
        <div className="cta-row" style={{ alignItems: "center" }}>
          <p className="meta-note" style={{ margin: 0 }}>还有 {hiddenTodayTaskCount} 项任务待处理。</p>
          <a className="button ghost" href="#student-task-queue">
            查看剩余任务
          </a>
        </div>
      ) : null}
    </Card>
  );
}
