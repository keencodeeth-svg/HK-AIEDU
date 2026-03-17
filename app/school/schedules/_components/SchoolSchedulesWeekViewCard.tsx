import type { RefObject } from "react";
import Card from "@/components/Card";
import type { SchoolClassRecord } from "@/lib/school-admin-types";
import type { ScheduleViewItem } from "../types";
import { WEEKDAY_OPTIONS, formatSubjectLine } from "../utils";

type WeekdayOption = (typeof WEEKDAY_OPTIONS)[number];

type SchoolSchedulesWeekViewCardProps = {
  weekViewRef: RefObject<HTMLDivElement>;
  selectedWeekViewClass: SchoolClassRecord | null;
  selectedWeekdayOption: WeekdayOption | null;
  trimmedKeyword: string;
  filteredSessions: ScheduleViewItem[];
  filteredLockedSessionCount: number;
  activeWeekViewFilterCount: number;
  sessionsByWeekday: Map<string, ScheduleViewItem[]>;
  lockingId: string | null;
  deletingId: string | null;
  keepFocusedClassWeekView: () => void;
  setWeekdayFilter: (value: string) => void;
  setKeyword: (value: string) => void;
  clearWeekViewFilters: () => void;
  handleToggleLock: (item: ScheduleViewItem) => Promise<void>;
  startEdit: (item: ScheduleViewItem) => void;
  handleDelete: (id: string) => Promise<void>;
};

export function SchoolSchedulesWeekViewCard({
  weekViewRef,
  selectedWeekViewClass,
  selectedWeekdayOption,
  trimmedKeyword,
  filteredSessions,
  filteredLockedSessionCount,
  activeWeekViewFilterCount,
  sessionsByWeekday,
  lockingId,
  deletingId,
  keepFocusedClassWeekView,
  setWeekdayFilter,
  setKeyword,
  clearWeekViewFilters,
  handleToggleLock,
  startEdit,
  handleDelete
}: SchoolSchedulesWeekViewCardProps) {
  return (
    <div ref={weekViewRef}>
      <Card title="当前周视图" tag="周视图">
        <div className="card" style={{ marginBottom: 12, border: "1px solid rgba(105, 65, 198, 0.18)", background: "rgba(105, 65, 198, 0.06)" }}>
          <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginTop: 0 }}>
            <div>
              <div className="section-title">
                当前正在看：{selectedWeekViewClass ? selectedWeekViewClass.name : "全校"} · {selectedWeekdayOption?.label ?? "整周"}
                {trimmedKeyword ? ` · 关键词“${trimmedKeyword}”` : ""}
              </div>
              <div className="meta-text" style={{ marginTop: 6, lineHeight: 1.7 }}>
                当前命中 {filteredSessions.length} 节{filteredLockedSessionCount ? `，其中 ${filteredLockedSessionCount} 节已锁定` : ""}。
                {selectedWeekViewClass
                  ? " 从班级状态或手动排课入口跳转到周视图时，会默认展示该班整周课表。"
                  : " 可先聚焦单个班级，再补充星期或关键词做精查。"}
              </div>
            </div>
            <div className="badge-row" style={{ justifyContent: "flex-end" }}>
              <span className="badge">班级：{selectedWeekViewClass?.name ?? "全校"}</span>
              <span className="badge">星期：{selectedWeekdayOption?.label ?? "整周"}</span>
              {trimmedKeyword ? <span className="badge">关键词：{trimmedKeyword}</span> : null}
              {filteredLockedSessionCount ? <span className="badge">锁定 {filteredLockedSessionCount} 节</span> : null}
            </div>
          </div>
          <div className="cta-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
            {selectedWeekViewClass && (selectedWeekdayOption || trimmedKeyword) ? (
              <button className="button secondary" type="button" onClick={keepFocusedClassWeekView}>
                仅保留该班整周
              </button>
            ) : null}
            {selectedWeekdayOption ? (
              <button className="button ghost" type="button" onClick={() => setWeekdayFilter("all")}>
                查看整周
              </button>
            ) : null}
            {trimmedKeyword ? (
              <button className="button ghost" type="button" onClick={() => setKeyword("")}>
                清空关键词
              </button>
            ) : null}
            {activeWeekViewFilterCount ? (
              <button className="button ghost" type="button" onClick={clearWeekViewFilters}>
                恢复全校周视图
              </button>
            ) : null}
            {filteredLockedSessionCount ? (
              <span className="meta-text" style={{ color: "#6941c6" }}>
                锁定节次需先解锁，才能编辑、删除或重新调整。
              </span>
            ) : null}
          </div>
        </div>

        {activeWeekViewFilterCount && !filteredSessions.length ? (
          <div className="card" style={{ marginBottom: 12, borderStyle: "dashed" }}>
            <div className="section-title">当前筛选没有命中节次</div>
            <div className="meta-text" style={{ marginTop: 6, lineHeight: 1.7 }}>
              建议先恢复全校周视图，或仅保留班级整周，再逐步加上星期与关键词定位问题课节。
            </div>
          </div>
        ) : null}

        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(180px, 1fr))", gap: 12, minWidth: 1280 }}>
            {WEEKDAY_OPTIONS.map((weekday) => {
              const list = sessionsByWeekday.get(weekday.value) ?? [];
              return (
                <div className="card" key={weekday.value} style={{ minHeight: 220 }}>
                  <div className="section-title">{weekday.label}</div>
                  <div className="grid" style={{ gap: 8, marginTop: 10 }}>
                    {list.length ? (
                      list.map((item) => (
                        <div key={item.id} style={{ border: "1px solid var(--stroke)", borderRadius: 14, padding: 10, background: "rgba(255,255,255,0.72)" }}>
                          <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginTop: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{item.className}</div>
                            {item.locked ? <span className="pill">已锁定</span> : null}
                          </div>
                          <div className="section-sub" style={{ marginTop: 4 }}>
                            {item.startTime}-{item.endTime}
                            {item.slotLabel ? ` · ${item.slotLabel}` : ""}
                          </div>
                          <div className="meta-text" style={{ marginTop: 6 }}>
                            {formatSubjectLine(item)}
                            {item.room ? ` · ${item.room}` : ""}
                          </div>
                          {item.focusSummary ? <div className="meta-text" style={{ marginTop: 6 }}>课堂焦点：{item.focusSummary}</div> : null}
                          {item.note ? <div className="meta-text" style={{ marginTop: 6 }}>备注：{item.note}</div> : null}
                          {item.locked ? (
                            <div className="meta-text" style={{ marginTop: 6, color: "#6941c6" }}>
                              已锁定：AI 重排、编辑与删除都会跳过该节次；如需调整，请先解锁再修改。
                            </div>
                          ) : null}
                          <div className="cta-row cta-row-tight" style={{ marginTop: 10 }}>
                            <button
                              className="button ghost"
                              type="button"
                              onClick={() => void handleToggleLock(item)}
                              disabled={lockingId === item.id || deletingId === item.id}
                            >
                              {lockingId === item.id ? "处理中..." : item.locked ? "解锁" : "锁定"}
                            </button>
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => startEdit(item)}
                              disabled={item.locked || lockingId === item.id}
                              title={item.locked ? "请先解锁该节次后再编辑" : undefined}
                            >
                              {item.locked ? "先解锁再编辑" : "编辑"}
                            </button>
                            <button
                              className="button ghost"
                              type="button"
                              onClick={() => void handleDelete(item.id)}
                              disabled={item.locked || deletingId === item.id || lockingId === item.id}
                              title={item.locked ? "请先解锁该节次后再删除" : undefined}
                            >
                              {item.locked ? "先解锁再删除" : deletingId === item.id ? "删除中..." : "删除"}
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="section-sub">{activeWeekViewFilterCount ? "当前筛选下暂无节次" : "暂无节次"}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
