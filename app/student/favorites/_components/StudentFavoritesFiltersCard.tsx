import Card from "@/components/Card";
import { SUBJECT_LABELS } from "@/lib/constants";

type StudentFavoritesFiltersCardProps = {
  keyword: string;
  subjectFilter: string;
  subjectOptions: string[];
  hasActiveFilters: boolean;
  filteredCount: number;
  viewMode: "compact" | "detailed";
  topTags: Array<[string, number]>;
  selectedTag: string;
  onKeywordChange: (value: string) => void;
  onSubjectFilterChange: (value: string) => void;
  onToggleTag: (tag: string) => void;
  onViewModeChange: (mode: "compact" | "detailed") => void;
  onClearFilters: () => void;
};

export default function StudentFavoritesFiltersCard({
  keyword,
  subjectFilter,
  subjectOptions,
  hasActiveFilters,
  filteredCount,
  viewMode,
  topTags,
  selectedTag,
  onKeywordChange,
  onSubjectFilterChange,
  onToggleTag,
  onViewModeChange,
  onClearFilters
}: StudentFavoritesFiltersCardProps) {
  return (
    <Card title="筛选与视图" tag="筛选">
      <div className="grid grid-3">
        <label>
          <div className="section-title">搜索收藏</div>
          <input
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="搜索题干、知识点、标签或备注"
            className="workflow-search-input"
            style={{ width: "100%" }}
          />
        </label>
        <label>
          <div className="section-title">学科筛选</div>
          <select className="select-control" value={subjectFilter} onChange={(event) => onSubjectFilterChange(event.target.value)} style={{ width: "100%" }}>
            <option value="all">全部学科</option>
            {subjectOptions.map((subject) => (
              <option key={subject} value={subject}>
                {SUBJECT_LABELS[subject] ?? subject}
              </option>
            ))}
          </select>
        </label>
        <div className="card favorites-filter-card">
          <div className="section-title">当前状态</div>
          <div className="favorites-filter-meta">{hasActiveFilters ? `已启用筛选，显示 ${filteredCount} 条结果` : "当前展示全部收藏记录"}</div>
        </div>
      </div>

      {topTags.length ? (
        <div className="pill-list" style={{ marginTop: 12 }}>
          {topTags.map(([tag, count]) => {
            const active = selectedTag === tag;
            return (
              <button key={tag} type="button" className={active ? "button secondary" : "button ghost"} onClick={() => onToggleTag(tag)}>
                {tag} · {count}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="toolbar-wrap" style={{ marginTop: 12 }}>
        <button className={viewMode === "compact" ? "button secondary" : "button ghost"} type="button" onClick={() => onViewModeChange("compact")}>
          紧凑视图
        </button>
        <button className={viewMode === "detailed" ? "button secondary" : "button ghost"} type="button" onClick={() => onViewModeChange("detailed")}>
          详细视图
        </button>
        {hasActiveFilters ? (
          <button className="button ghost" type="button" onClick={onClearFilters}>
            清空筛选
          </button>
        ) : null}
      </div>
    </Card>
  );
}
