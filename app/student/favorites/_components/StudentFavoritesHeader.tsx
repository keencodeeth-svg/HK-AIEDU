import { formatLoadedTime } from "@/lib/client-request";

type StudentFavoritesHeaderProps = {
  favoritesCount: number;
  notedCount: number;
  subjectCount: number;
  lastLoadedAt: string | null;
  refreshing: boolean;
  busy: boolean;
  onRefresh: () => void;
};

export default function StudentFavoritesHeader({
  favoritesCount,
  notedCount,
  subjectCount,
  lastLoadedAt,
  refreshing,
  busy,
  onRefresh
}: StudentFavoritesHeaderProps) {
  return (
    <div className="section-head">
      <div>
        <h2>题目收藏夹</h2>
        <div className="section-sub">收藏题目、补标签、写备注，把零散好题沉淀成真正可复习的个人题库。</div>
      </div>
      <div className="workflow-toolbar">
        <span className="chip">收藏 {favoritesCount}</span>
        <span className="chip">备注 {notedCount}</span>
        <span className="chip">学科 {subjectCount}</span>
        {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
        <button className="button secondary" type="button" onClick={onRefresh} disabled={refreshing || busy}>
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      </div>
    </div>
  );
}
