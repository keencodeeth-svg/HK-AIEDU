import { formatLoadedTime } from "@/lib/client-request";

export function CourseHeader({
  lastLoadedAt,
  refreshing,
  onRefresh
}: {
  lastLoadedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>课程主页 / 大纲</h2>
        <div className="section-sub">课程简介、目标、评分规则与周计划同步。</div>
      </div>
      <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
        {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
        <span className="chip">课程</span>
        <button className="button secondary" type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      </div>
    </div>
  );
}
