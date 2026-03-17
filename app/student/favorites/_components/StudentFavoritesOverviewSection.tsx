import Card from "@/components/Card";
import type { StudentFavoritesStageCopy } from "../types";

type StudentFavoritesOverviewSectionProps = {
  stageCopy: StudentFavoritesStageCopy;
  favoritesCount: number;
  filteredCount: number;
  visibleCount: number;
  viewMode: "compact" | "detailed";
  selectedTag: string;
  notedCount: number;
  subjectCount: number;
};

export default function StudentFavoritesOverviewSection({
  stageCopy,
  favoritesCount,
  filteredCount,
  visibleCount,
  viewMode,
  selectedTag,
  notedCount,
  subjectCount
}: StudentFavoritesOverviewSectionProps) {
  return (
    <>
      <div className="favorites-stage-banner">
        <div className="favorites-stage-kicker">当前阶段</div>
        <div className="favorites-stage-title">{stageCopy.title}</div>
        <p className="favorites-stage-description">{stageCopy.description}</p>
        <div className="pill-list">
          <span className="pill">当前显示 {filteredCount}</span>
          <span className="pill">可见卡片 {visibleCount}</span>
          <span className="pill">{viewMode === "compact" ? "紧凑视图" : "详细视图"}</span>
          {selectedTag ? <span className="pill">标签：{selectedTag}</span> : null}
        </div>
      </div>

      <Card title="收藏概览" tag="概览">
        <div className="grid grid-2">
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">收藏总数</div>
            <div className="workflow-summary-value">{favoritesCount}</div>
            <div className="workflow-summary-helper">沉淀到个人复习清单中的题目数量</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">当前筛选结果</div>
            <div className="workflow-summary-value">{filteredCount}</div>
            <div className="workflow-summary-helper">符合当前关键词、标签与学科条件的题目数</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">已写备注</div>
            <div className="workflow-summary-value">{notedCount}</div>
            <div className="workflow-summary-helper">带有个人复习提醒或错误总结的收藏题</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">学科覆盖</div>
            <div className="workflow-summary-value">{subjectCount}</div>
            <div className="workflow-summary-helper">当前收藏涉及到的学科数量</div>
          </div>
        </div>
      </Card>
    </>
  );
}
