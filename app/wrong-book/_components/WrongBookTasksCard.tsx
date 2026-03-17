import Card from "@/components/Card";
import MathText from "@/components/MathText";
import type { CorrectionTask, Summary } from "../types";
import { formatDate } from "../utils";

type WrongBookTasksCardProps = {
  summary: Summary | null;
  tasks: CorrectionTask[];
  completingTaskIds: Record<string, boolean>;
  onCompleteTask: (id: string) => void | Promise<void>;
};

export default function WrongBookTasksCard({ summary, tasks, completingTaskIds, onCompleteTask }: WrongBookTasksCardProps) {
  return (
    <Card title="订正任务" tag="订正">
      <div className="grid grid-2">
        <div className="card">
          <div className="section-title">待订正</div>
          <p>{summary?.pending ?? 0} 题</p>
        </div>
        <div className="card">
          <div className="section-title">逾期</div>
          <p>{summary?.overdue ?? 0} 题</p>
        </div>
        <div className="card">
          <div className="section-title">2 天内到期</div>
          <p>{summary?.dueSoon ?? 0} 题</p>
        </div>
        <div className="card">
          <div className="section-title">已完成</div>
          <p>{summary?.completed ?? 0} 题</p>
        </div>
      </div>
      <div className="grid" style={{ gap: 12, marginTop: 12 }}>
        {tasks.length === 0 ? <p>暂无订正任务。</p> : null}
        {tasks.map((task) => {
          const overdue = task.status === "pending" && new Date(task.dueDate).getTime() < Date.now();
          return (
            <div className="card" key={task.id} style={{ borderColor: overdue ? "#d92d20" : "var(--stroke)" }}>
              <div className="section-title">
                <MathText text={task.question?.stem ?? "题目已删除"} />
              </div>
              <p style={{ color: "var(--ink-1)" }}>截止：{formatDate(task.dueDate)}</p>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div className="badge">状态：{task.status === "completed" ? "已完成" : overdue ? "逾期" : "待订正"}</div>
                {task.status === "completed" ? (
                  <div className="badge">完成时间：{formatDate(task.completedAt)}</div>
                ) : (
                  <button className="button secondary" onClick={() => onCompleteTask(task.id)} disabled={Boolean(completingTaskIds[task.id])}>
                    {completingTaskIds[task.id] ? "处理中..." : "标记完成"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
