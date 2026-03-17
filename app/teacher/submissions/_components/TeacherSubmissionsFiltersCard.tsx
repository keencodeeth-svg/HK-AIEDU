import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { SubmissionClassItem, SubmissionStatusFilter } from "../types";
import { STATUS_LABELS } from "../utils";

type TeacherSubmissionsFiltersCardProps = {
  classId: string;
  status: SubmissionStatusFilter;
  keyword: string;
  classes: SubmissionClassItem[];
  selectedClass?: SubmissionClassItem;
  hasActiveFilters: boolean;
  error: string | null;
  showRefreshError: boolean;
  onClassChange: (value: string) => void;
  onStatusChange: (value: SubmissionStatusFilter) => void;
  onKeywordChange: (value: string) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
};

export default function TeacherSubmissionsFiltersCard({
  classId,
  status,
  keyword,
  classes,
  selectedClass,
  hasActiveFilters,
  error,
  showRefreshError,
  onClassChange,
  onStatusChange,
  onKeywordChange,
  onClearFilters,
  onRefresh
}: TeacherSubmissionsFiltersCardProps) {
  return (
    <Card title="筛选条件" tag="筛选">
      <div className="grid grid-2" style={{ alignItems: "end" }}>
        <label>
          <div className="section-title">班级</div>
          <select value={classId} onChange={(event) => onClassChange(event.target.value)} style={{ width: "100%" }}>
            <option value="">全部班级</option>
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name} · {SUBJECT_LABELS[klass.subject] ?? klass.subject} · {klass.grade} 年级
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">状态</div>
          <select value={status} onChange={(event) => onStatusChange(event.target.value as SubmissionStatusFilter)} style={{ width: "100%" }}>
            <option value="all">全部</option>
            <option value="completed">已提交</option>
            <option value="pending">待提交</option>
            <option value="overdue">已逾期</option>
          </select>
        </label>
        <label>
          <div className="section-title">关键字</div>
          <input
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="学生/作业/班级/学科"
            style={{ width: "100%" }}
          />
        </label>
        <div className="cta-row cta-row-tight no-margin">
          <button className="button ghost" type="button" onClick={onClearFilters} disabled={!hasActiveFilters}>
            清空筛选
          </button>
          <Link className="button secondary" href="/teacher/gradebook">
            去成绩册
          </Link>
        </div>
      </div>

      <div className="workflow-card-meta">
        <span className="pill">班级：{selectedClass ? selectedClass.name : "全部班级"}</span>
        <span className="pill">状态：{STATUS_LABELS[status]}</span>
        <span className="pill">关键词：{keyword.trim() || "未设置"}</span>
      </div>
      <div className="meta-text" style={{ marginTop: 12 }}>
        状态筛选现在只影响当前视图，不会再改变整体盘面数据。先看全局，再缩到今天真正需要跟进的人和作业。
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
