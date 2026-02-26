"use client";

import Card from "@/components/Card";
import { SUBJECT_LABELS } from "@/lib/constants";
import type {
  KnowledgePoint,
  KnowledgePointFacets,
  KnowledgePointQuery,
  KnowledgePointTreeNode
} from "../types";

type Props = {
  query: KnowledgePointQuery;
  patchQuery: (next: Partial<KnowledgePointQuery>) => void;
  facets: KnowledgePointFacets;
  tree: KnowledgePointTreeNode[];
  loading: boolean;
  list: KnowledgePoint[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  pageSize: number;
  setPageSize: (value: number) => void;
  setPage: (updater: (current: number) => number) => void;
  pageStart: number;
  pageEnd: number;
  onDelete: (id: string) => Promise<void>;
};

export default function KnowledgePointsListPanel({
  query,
  patchQuery,
  facets,
  tree,
  loading,
  list,
  meta,
  pageSize,
  setPageSize,
  setPage,
  pageStart,
  pageEnd,
  onDelete
}: Props) {
  return (
    <Card title="知识点列表（分类筛选）" tag="列表">
      <div className="grid grid-3" style={{ gap: 10, alignItems: "end" }}>
        <label>
          <div className="section-title">搜索</div>
          <input
            value={query.search}
            onChange={(event) => patchQuery({ search: event.target.value })}
            placeholder="知识点 / 章节 / 单元"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          />
        </label>
        <label>
          <div className="section-title">学科</div>
          <select
            value={query.subject}
            onChange={(event) => patchQuery({ subject: event.target.value, grade: "all", unit: "all" })}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            <option value="all">全部学科</option>
            {facets.subjects.map((item) => (
              <option key={item.value} value={item.value}>
                {(SUBJECT_LABELS[item.value] ?? item.value) + ` (${item.count})`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">年级</div>
          <select
            value={query.grade}
            onChange={(event) => patchQuery({ grade: event.target.value, unit: "all" })}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            <option value="all">全部年级</option>
            {facets.grades.map((item) => (
              <option key={item.value} value={item.value}>
                {`${item.value} 年级 (${item.count})`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-3" style={{ gap: 10, alignItems: "end", marginTop: 10 }}>
        <label>
          <div className="section-title">单元</div>
          <select
            value={query.unit}
            onChange={(event) => patchQuery({ unit: event.target.value })}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            <option value="all">全部单元</option>
            {facets.units.map((item) => (
              <option key={item.value} value={item.value}>
                {`${item.value} (${item.count})`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">章节</div>
          <select
            value={query.chapter}
            onChange={(event) => patchQuery({ chapter: event.target.value })}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            <option value="all">全部章节</option>
            {facets.chapters.map((item) => (
              <option key={item.value} value={item.value}>
                {`${item.value} (${item.count})`}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span className="section-title" style={{ marginBottom: 0 }}>
            每页
          </span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(() => 1);
            }}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      <div className="cta-row" style={{ marginTop: 10 }}>
        <button
          className="button ghost"
          type="button"
          onClick={() =>
            patchQuery({
              subject: "all",
              grade: "all",
              unit: "all",
              chapter: "all",
              search: ""
            })
          }
        >
          清空筛选
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12
        }}
      >
        <div className="card" style={{ padding: 14 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            分类树
          </div>
          <button
            className="button ghost"
            type="button"
            onClick={() => patchQuery({ subject: "all", grade: "all", unit: "all" })}
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            全部知识点
            <span>{meta.total}</span>
          </button>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {tree.map((subjectNode) => (
              <div key={subjectNode.subject} className="card" style={{ padding: 10 }}>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => patchQuery({ subject: subjectNode.subject, grade: "all", unit: "all" })}
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  {SUBJECT_LABELS[subjectNode.subject] ?? subjectNode.subject}
                  <span>{subjectNode.count}</span>
                </button>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {subjectNode.grades.map((gradeNode) => (
                    <div key={`${subjectNode.subject}-${gradeNode.grade}`}>
                      <button
                        className="button ghost"
                        type="button"
                        onClick={() =>
                          patchQuery({ subject: subjectNode.subject, grade: gradeNode.grade, unit: "all" })
                        }
                        style={{ width: "100%", justifyContent: "space-between", padding: "8px 12px" }}
                      >
                        {gradeNode.grade} 年级
                        <span>{gradeNode.count}</span>
                      </button>
                      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {gradeNode.units.slice(0, 6).map((unitNode) => (
                          <button
                            key={`${subjectNode.subject}-${gradeNode.grade}-${unitNode.unit}`}
                            className="badge"
                            type="button"
                            onClick={() =>
                              patchQuery({
                                subject: subjectNode.subject,
                                grade: gradeNode.grade,
                                unit: unitNode.unit
                              })
                            }
                            style={{ border: "none", cursor: "pointer" }}
                          >
                            {unitNode.unit} · {unitNode.count}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dense-list">
          {loading ? <p>加载中...</p> : null}
          {!loading && list.length === 0 ? (
            <div className="card">
              <div className="section-title" style={{ marginTop: 0 }}>
                暂无结果
              </div>
              <div style={{ color: "var(--ink-1)", fontSize: 13 }}>请调整筛选条件后重试。</div>
            </div>
          ) : null}
          {list.map((item) => (
            <div className="card" key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div className="section-title">{item.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级 · {item.unit ?? "未分单元"} ·{" "}
                  {item.chapter}
                </div>
              </div>
              <button className="button secondary" onClick={() => onDelete(item.id)}>
                删除
              </button>
            </div>
          ))}

          <div className="card" style={{ padding: 14 }}>
            <div className="cta-row" style={{ marginTop: 0, justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                共 {meta.total} 条，当前 {pageStart}-{pageEnd}
              </div>
              <div className="cta-row" style={{ marginTop: 0 }}>
                <button
                  className="button ghost"
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  上一页
                </button>
                <span className="badge">
                  第 {meta.page}/{Math.max(meta.totalPages, 1)} 页
                </span>
                <button
                  className="button ghost"
                  type="button"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
