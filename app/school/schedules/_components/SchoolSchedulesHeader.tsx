"use client";

import { formatLoadedTime } from "@/lib/client-request";

type SchoolSchedulesHeaderProps = {
  lastLoadedAt: string | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
};

export function SchoolSchedulesHeader({
  lastLoadedAt,
  loading,
  refreshing,
  onRefresh
}: SchoolSchedulesHeaderProps) {
  return (
    <div className="section-head">
      <div>
        <h2>课程表管理</h2>
        <div className="section-sub">由学校统一维护班级固定节次，把课程安排与作业、课程模块和学生日程联动起来。</div>
      </div>
      <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
        {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
        <span className="chip">School Schedule</span>
        <button className="button secondary" type="button" onClick={onRefresh} disabled={loading || refreshing}>
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      </div>
    </div>
  );
}
