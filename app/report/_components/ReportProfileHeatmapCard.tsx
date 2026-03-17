import Card from "@/components/Card";
import type { ReportProfileKnowledgeItem, ReportProfileSubjectGroup, ReportSortMode } from "../types";
import { getRatioColor } from "../utils";

type ReportProfileGroupView = ReportProfileSubjectGroup & {
  filteredItems: ReportProfileKnowledgeItem[];
};

export function ReportProfileHeatmapCard({
  profileLoading,
  hasProfileError,
  subjectGroups,
  subjectOptions,
  chapterOptions,
  subjectFilter,
  chapterFilter,
  sortMode,
  onSubjectFilterChange,
  onChapterFilterChange,
  onSortModeChange
}: {
  profileLoading: boolean;
  hasProfileError: boolean;
  subjectGroups: ReportProfileGroupView[];
  subjectOptions: ReportProfileSubjectGroup[];
  chapterOptions: string[];
  subjectFilter: string;
  chapterFilter: string;
  sortMode: ReportSortMode;
  onSubjectFilterChange: (value: string) => void;
  onChapterFilterChange: (value: string) => void;
  onSortModeChange: (value: ReportSortMode) => void;
}) {
  return (
    <Card title="学习画像 · 知识点掌握热力图" tag="画像">
      {profileLoading ? <p>加载中...</p> : null}
      {hasProfileError ? <p>学习画像加载失败。</p> : null}
      {subjectGroups.length ? (
        <div className="grid" style={{ gap: 16 }}>
          <div className="card" style={{ display: "grid", gap: 10 }}>
            <div className="section-title">筛选</div>
            <div className="grid grid-3">
              <label>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>学科</div>
                <select
                  value={subjectFilter}
                  onChange={(event) => onSubjectFilterChange(event.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  <option value="all">全部</option>
                  {subjectOptions.map((group) => (
                    <option key={group.subject} value={group.subject}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>章节</div>
                <select
                  value={chapterFilter}
                  onChange={(event) => onChapterFilterChange(event.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  <option value="all">全部</option>
                  {chapterOptions.map((chapter) => (
                    <option key={chapter} value={chapter}>
                      {chapter}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>排序</div>
                <select
                  value={sortMode}
                  onChange={(event) => onSortModeChange(event.target.value as ReportSortMode)}
                  style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  <option value="ratio-asc">正确率从低到高</option>
                  <option value="ratio-desc">正确率从高到低</option>
                  <option value="total-desc">练习次数从多到少</option>
                </select>
              </label>
            </div>
          </div>
          {subjectGroups.map((group) => (
            <div key={group.subject}>
              <div className="section-title">
                {group.label}（{group.practiced}/{group.total} 已练习，均值 {group.avgRatio}%）
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {group.filteredItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border: "1px solid var(--stroke)",
                      background: getRatioColor(item.ratio),
                      minWidth: 140
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                      {item.ratio}% · {item.total} 题
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>暂无知识点掌握数据。</p>
      )}
    </Card>
  );
}
