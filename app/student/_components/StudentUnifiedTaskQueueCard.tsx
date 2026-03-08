import Link from "next/link";
import Card from "@/components/Card";
import type { TodayTask, TodayTaskEventName, TodayTaskPayload } from "../types";
import { getTodayTaskSourceLabel, getTodayTaskStatusLabel } from "../utils";

type StudentUnifiedTaskQueueCardProps = {
  todayTasks: TodayTaskPayload | null;
  todayTaskError: string | null;
  onTaskEvent: (task: TodayTask, eventName: TodayTaskEventName) => void;
};

const GROUP_CONFIG: Array<{
  key: keyof TodayTaskPayload["groups"];
  title: string;
  description: string;
}> = [
  {
    key: "mustDo",
    title: "先做这些",
    description: "逾期、今日到期、进行中的任务优先推进。"
  },
  {
    key: "continueLearning",
    title: "继续推进",
    description: "按收益顺序把练习、计划和复练接着做掉。"
  },
  {
    key: "growth",
    title: "成长加分",
    description: "奖励、挑战和长期成长任务可穿插完成。"
  }
];

function formatDueAt(value: string | null) {
  if (!value) return "时间待定";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function StudentUnifiedTaskQueueCard({
  todayTasks,
  todayTaskError,
  onTaskEvent
}: StudentUnifiedTaskQueueCardProps) {
  return (
    <Card title="统一任务队列" tag={`${todayTasks?.summary?.total ?? 0} 项`}>
      {todayTaskError ? <div className="status-note error">{todayTaskError}</div> : null}
      {!todayTasks ? <div className="status-note info">正在整理跨模块学习任务…</div> : null}

      <div className="grid" style={{ gap: 14 }}>
        {GROUP_CONFIG.map((group) => {
          const items = todayTasks?.groups?.[group.key] ?? [];
          const visibleItems = items.slice(0, 3);

          return (
            <div key={group.key} className="card" style={{ gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap"
                }}
              >
                <div>
                  <div className="section-title">{group.title}</div>
                  <div className="meta-text" style={{ marginTop: 4 }}>
                    {group.description}
                  </div>
                </div>
                <span className="badge">{items.length} 项</span>
              </div>

              {!visibleItems.length ? (
                <div className="meta-text">当前这一组暂无任务。</div>
              ) : (
                <div className="grid" style={{ gap: 10 }}>
                  {visibleItems.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        border: "1px solid var(--stroke)",
                        borderRadius: 12,
                        padding: 12,
                        background: "rgba(255,255,255,0.72)"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 10,
                          flexWrap: "wrap"
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{task.title}</div>
                          <div className="meta-text" style={{ marginTop: 6, lineHeight: 1.6 }}>
                            {task.description}
                          </div>
                        </div>
                        <span className="card-tag">{getTodayTaskStatusLabel(task.status)}</span>
                      </div>

                      <div className="badge-row" style={{ marginTop: 8 }}>
                        <span className="badge">{getTodayTaskSourceLabel(task.source)}</span>
                        <span className="badge">预计 {task.effortMinutes} 分钟</span>
                        <span className="badge">收益 {task.expectedGain}</span>
                        <span className="badge">{formatDueAt(task.dueAt)}</span>
                      </div>

                      <div className="meta-text" style={{ marginTop: 8, lineHeight: 1.6 }}>
                        推荐理由：{task.recommendedReason}
                      </div>

                      <div className="cta-row cta-row-tight" style={{ marginTop: 10 }}>
                        <Link className="button secondary" href={task.href} onClick={() => onTaskEvent(task, "task_started")}>
                          去完成
                        </Link>
                        <button className="button ghost" type="button" onClick={() => onTaskEvent(task, "task_skipped")}>
                          稍后处理
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {items.length > visibleItems.length ? (
                <div className="meta-text">还有 {items.length - visibleItems.length} 项同组任务待推进。</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
