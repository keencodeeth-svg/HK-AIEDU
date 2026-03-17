import Card from "@/components/Card";
import type { SchoolClassRecord } from "@/lib/school-admin-types";
import { WEEKDAY_OPTIONS, fieldStyle } from "../utils";

type SchoolSchedulesFiltersCardProps = {
  classes: SchoolClassRecord[];
  classFilter: string;
  weekdayFilter: string;
  keyword: string;
  setClassFilter: (value: string) => void;
  setWeekdayFilter: (value: string) => void;
  setKeyword: (value: string) => void;
  clearWeekViewFilters: () => void;
};

export function SchoolSchedulesFiltersCard({
  classes,
  classFilter,
  weekdayFilter,
  keyword,
  setClassFilter,
  setWeekdayFilter,
  setKeyword,
  clearWeekViewFilters
}: SchoolSchedulesFiltersCardProps) {
  return (
    <Card title="筛选与检索" tag="筛选">
      <div className="grid grid-3" style={{ alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="section-sub">班级</span>
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} style={fieldStyle}>
            <option value="all">全部班级</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="section-sub">星期</span>
          <select value={weekdayFilter} onChange={(event) => setWeekdayFilter(event.target.value)} style={fieldStyle}>
            <option value="all">全部星期</option>
            {WEEKDAY_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="section-sub">搜索节次</span>
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索班级、教室、校区或课堂焦点" style={fieldStyle} />
        </label>
      </div>
      <div className="cta-row" style={{ marginTop: 12 }}>
        <button className="button ghost" type="button" onClick={clearWeekViewFilters}>
          清空筛选
        </button>
      </div>
    </Card>
  );
}
