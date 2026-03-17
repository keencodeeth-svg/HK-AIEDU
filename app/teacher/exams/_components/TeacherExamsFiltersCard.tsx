import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS, getGradeLabel } from "@/lib/constants";
import type { TeacherExamClassOption, TeacherExamStatusFilter } from "../types";
import { STATUS_LABELS } from "../utils";

type TeacherExamsFiltersCardProps = {
  classFilter: string;
  status: TeacherExamStatusFilter;
  keyword: string;
  classOptions: TeacherExamClassOption[];
  selectedClass?: TeacherExamClassOption;
  hasActiveFilters: boolean;
  error: string | null;
  showRefreshError: boolean;
  onClassFilterChange: (value: string) => void;
  onStatusChange: (value: TeacherExamStatusFilter) => void;
  onKeywordChange: (value: string) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
};

export default function TeacherExamsFiltersCard({
  classFilter,
  status,
  keyword,
  classOptions,
  selectedClass,
  hasActiveFilters,
  error,
  showRefreshError,
  onClassFilterChange,
  onStatusChange,
  onKeywordChange,
  onClearFilters,
  onRefresh
}: TeacherExamsFiltersCardProps) {
  return (
    <Card title="筛选与视角" tag="Filter">
      <div className="teacher-exams-filter-grid">
        <label>
          <div className="section-title">班级</div>
          <select value={classFilter} onChange={(event) => onClassFilterChange(event.target.value)} style={{ width: "100%" }}>
            <option value="">全部班级</option>
            {classOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {getGradeLabel(item.grade)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div className="section-title">状态</div>
          <select value={status} onChange={(event) => onStatusChange(event.target.value as TeacherExamStatusFilter)} style={{ width: "100%" }}>
            <option value="all">全部</option>
            <option value="published">进行中</option>
            <option value="closed">已关闭</option>
          </select>
        </label>

        <label>
          <div className="section-title">关键字</div>
          <input
            className="workflow-search-input"
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="考试标题 / 班级 / 学科"
          />
        </label>

        <div className="cta-row cta-row-tight no-margin">
          <button className="button ghost" type="button" onClick={onClearFilters} disabled={!hasActiveFilters}>
            清空筛选
          </button>
          <Link className="button primary" href="/teacher/exams/create">
            发布新考试
          </Link>
        </div>
      </div>

      <div className="workflow-card-meta">
        <span className="pill">班级：{selectedClass ? selectedClass.name : "全部班级"}</span>
        <span className="pill">状态：{STATUS_LABELS[status]}</span>
        <span className="pill">关键字：{keyword.trim() || "未设置"}</span>
      </div>

      <div className="meta-text" style={{ marginTop: 12 }}>
        筛选只影响当前视图，不改变整体优先级逻辑。先用总盘面判断今天先盯哪场，再缩到具体班级或状态。
      </div>

      {showRefreshError && error ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${error}`}
          action={
            <button className="button secondary" type="button" onClick={onRefresh}>
              再试一次
            </button>
          }
        />
      ) : null}
    </Card>
  );
}
