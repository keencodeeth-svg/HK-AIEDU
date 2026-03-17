import Card from "@/components/Card";
import { getGradeLabel, SUBJECT_LABELS } from "@/lib/constants";
import type { ClassItem, DiscussionStageCopy, Topic } from "../types";
import { getDiscussionPerspectiveLabel } from "../utils";

type DiscussionsOverviewCardProps = {
  stageCopy: DiscussionStageCopy;
  currentClass: ClassItem | null;
  role?: string;
  topicsCount: number;
  pinnedTopicCount: number;
  activeTopic: Topic | null;
  repliesCount: number;
};

export default function DiscussionsOverviewCard({
  stageCopy,
  currentClass,
  role,
  topicsCount,
  pinnedTopicCount,
  activeTopic,
  repliesCount
}: DiscussionsOverviewCardProps) {
  return (
    <>
      <div className="discussion-stage-banner">
        <div className="discussion-stage-kicker">当前阶段</div>
        <div className="discussion-stage-title">{stageCopy.title}</div>
        <p className="discussion-stage-description">{stageCopy.description}</p>
        <div className="pill-list">
          <span className="pill">{currentClass?.name ?? "未选择班级"}</span>
          <span className="pill">{currentClass ? SUBJECT_LABELS[currentClass.subject] ?? currentClass.subject : "待同步学科"}</span>
          <span className="pill">{currentClass ? getGradeLabel(currentClass.grade) : "待同步年级"}</span>
          <span className="pill">{getDiscussionPerspectiveLabel(role)}</span>
          <span className="pill">当前回复 {activeTopic ? repliesCount : 0}</span>
        </div>
      </div>

      <Card title="讨论概览" tag="概览">
        <div className="grid grid-2">
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">当前班级</div>
            <div className="workflow-summary-value">{currentClass ? 1 : 0}</div>
            <div className="workflow-summary-helper">{currentClass ? `${currentClass.name} · ${getGradeLabel(currentClass.grade)}` : "尚未加入可讨论班级"}</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">班级话题</div>
            <div className="workflow-summary-value">{topicsCount}</div>
            <div className="workflow-summary-helper">可浏览、筛选并继续参与的讨论话题数</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">置顶话题</div>
            <div className="workflow-summary-value">{pinnedTopicCount}</div>
            <div className="workflow-summary-helper">老师优先希望同学查看和回复的重点讨论</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">当前回复</div>
            <div className="workflow-summary-value">{activeTopic ? repliesCount : 0}</div>
            <div className="workflow-summary-helper">{activeTopic ? `围绕「${activeTopic.title}」的讨论进展` : "选择一个话题后查看完整回复"}</div>
          </div>
        </div>
      </Card>
    </>
  );
}
