import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import type { AssignmentStatsData } from "../types";
import { formatDateOnly } from "../utils";

type AssignmentStatsContextCardProps = {
  assignmentId: string;
  assignment: AssignmentStatsData["assignment"];
  error: string | null;
  onRetry: () => void;
};

export default function AssignmentStatsContextCard({
  assignmentId,
  assignment,
  error,
  onRetry
}: AssignmentStatsContextCardProps) {
  return (
    <Card title="作业上下文" tag="Context">
      <div className="feature-card">
        <EduIcon name="board" />
        <div>
          <div className="section-title">{assignment.title}</div>
          <p>{assignment.description || "暂无作业说明。"}</p>
        </div>
      </div>

      <div className="workflow-card-meta">
        <span className="pill">创建于 {formatDateOnly(assignment.createdAt)}</span>
        <span className="pill">截止 {formatDateOnly(assignment.dueDate)}</span>
        {assignment.gradingFocus ? <span className="pill">批改重点：{assignment.gradingFocus}</span> : null}
        {assignment.maxUploads ? <span className="pill">最多上传 {assignment.maxUploads} 个文件</span> : null}
      </div>

      <div className="cta-row" style={{ marginTop: 12 }}>
        <Link className="button ghost" href={`/teacher/assignments/${assignmentId}`}>
          回作业详情
        </Link>
        <Link className="button secondary" href="/teacher/submissions">
          去提交箱
        </Link>
        <Link className="button secondary" href="/teacher/gradebook">
          去成绩册
        </Link>
      </div>

      {error ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${error}`}
          action={
            <button className="button secondary" type="button" onClick={onRetry}>
              再试一次
            </button>
          }
        />
      ) : null}
    </Card>
  );
}
