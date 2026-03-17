import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { getGradeLabel, SUBJECT_LABELS } from "@/lib/constants";
import type { ClassItem } from "../types";

type DiscussionsFiltersCardProps = {
  classes: ClassItem[];
  classId: string;
  keyword: string;
  pinnedOnly: boolean;
  filteredTopicCount: number;
  totalTopicCount: number;
  teacherMode: boolean;
  hasTopicFilters: boolean;
  onClassChange: (classId: string) => void;
  onKeywordChange: (value: string) => void;
  onTogglePinnedOnly: () => void;
  onClearFilters: () => void;
};

export default function DiscussionsFiltersCard({
  classes,
  classId,
  keyword,
  pinnedOnly,
  filteredTopicCount,
  totalTopicCount,
  teacherMode,
  hasTopicFilters,
  onClassChange,
  onKeywordChange,
  onTogglePinnedOnly,
  onClearFilters
}: DiscussionsFiltersCardProps) {
  return (
    <Card title="班级与筛选" tag="筛选">
      {!classes.length ? (
        <StatePanel
          compact
          tone="info"
          title="当前没有可进入的班级讨论"
          description={teacherMode ? "先建立授课班级后，再来这里发布讨论话题。" : "加入班级后，这里会自动显示你可参与的话题。"}
        />
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          <label>
            <div className="section-title">选择班级</div>
            <select value={classId} onChange={(event) => onClassChange(event.target.value)} className="select-control" style={{ width: "100%" }}>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {getGradeLabel(item.grade)}
                </option>
              ))}
            </select>
          </label>

          <div className="workflow-toolbar" style={{ justifyContent: "flex-start" }}>
            <input
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
              className="workflow-search-input"
              placeholder="搜索话题标题、正文或发起人"
            />
            <button className={pinnedOnly ? "button secondary" : "button ghost"} type="button" onClick={onTogglePinnedOnly}>
              {pinnedOnly ? "只看置顶中" : "只看置顶"}
            </button>
            {hasTopicFilters ? (
              <button className="button ghost" type="button" onClick={onClearFilters}>
                清空筛选
              </button>
            ) : null}
            <span className="chip">
              显示 {filteredTopicCount} / {totalTopicCount}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
