"use client";

import Card from "@/components/Card";
import { SUBJECT_LABELS } from "@/lib/constants";
import {
  difficultyLabel,
  questionTypeLabel,
  riskLabel,
  type Question,
  type QuestionFacets,
  type QuestionQuery,
  type QuestionTreeNode
} from "../types";

type Props = {
  query: QuestionQuery;
  patchQuery: (next: Partial<QuestionQuery>) => void;
  facets: QuestionFacets;
  tree: QuestionTreeNode[];
  loading: boolean;
  list: Question[];
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
  onToggleIsolation: (id: string, isolated: boolean) => Promise<void>;
};

export default function QuestionsListPanel({
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
  onDelete,
  onToggleIsolation
}: Props) {
  const controlStyle = {
    width: "100%",
    padding: 9,
    borderRadius: 10,
    border: "1px solid var(--stroke)"
  } as const;

  const activeFilters = [
    query.subject !== "all" ? `学科：${SUBJECT_LABELS[query.subject] ?? query.subject}` : null,
    query.grade !== "all" ? `年级：${query.grade}` : null,
    query.chapter !== "all" ? `章节：${query.chapter}` : null,
    query.difficulty !== "all" ? `难度：${difficultyLabel[query.difficulty] ?? query.difficulty}` : null,
    query.questionType !== "all"
      ? `题型：${questionTypeLabel[query.questionType] ?? query.questionType}`
      : null,
    query.search.trim() ? `关键词：${query.search.trim()}` : null
  ].filter(Boolean) as string[];

  return (
    <Card title="题目列表（分类筛选）" tag="列表">
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
            共 {meta.total} 题，当前 {pageStart}-{pageEnd}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {activeFilters.length ? (
              activeFilters.map((item) => (
                <span className="badge" key={item}>
                  {item}
                </span>
              ))
            ) : (
              <span className="badge">当前为全部题目</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <label>
          <div className="section-title">搜索</div>
          <input
            value={query.search}
            onChange={(event) => patchQuery({ search: event.target.value })}
            placeholder="题干 / 标签 / 章节 / 答案"
            style={controlStyle}
          />
        </label>
        <label>
          <div className="section-title">学科</div>
          <select
            value={query.subject}
            onChange={(event) => patchQuery({ subject: event.target.value, grade: "all", chapter: "all" })}
            style={controlStyle}
          >
            <option value="all">全部学科</option>
            {facets.subjects.map((item) => (
              <option value={item.value} key={item.value}>
                {(SUBJECT_LABELS[item.value] ?? item.value) + ` (${item.count})`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">年级</div>
          <select
            value={query.grade}
            onChange={(event) => patchQuery({ grade: event.target.value, chapter: "all" })}
            style={controlStyle}
          >
            <option value="all">全部年级</option>
            {facets.grades.map((item) => (
              <option value={item.value} key={item.value}>
                {`${item.value} 年级 (${item.count})`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">章节</div>
          <select
            value={query.chapter}
            onChange={(event) => patchQuery({ chapter: event.target.value })}
            style={controlStyle}
          >
            <option value="all">全部章节</option>
            {facets.chapters.map((item) => (
              <option value={item.value} key={item.value}>
                {`${item.value} (${item.count})`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">难度</div>
          <select
            value={query.difficulty}
            onChange={(event) => patchQuery({ difficulty: event.target.value })}
            style={controlStyle}
          >
            <option value="all">全部难度</option>
            {facets.difficulties.map((item) => (
              <option value={item.value} key={item.value}>
                {(difficultyLabel[item.value] ?? item.value) + ` (${item.count})`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">题型</div>
          <select
            value={query.questionType}
            onChange={(event) => patchQuery({ questionType: event.target.value })}
            style={controlStyle}
          >
            <option value="all">全部题型</option>
            {facets.questionTypes.map((item) => (
              <option value={item.value} key={item.value}>
                {(questionTypeLabel[item.value] ?? item.value) + ` (${item.count})`}
              </option>
            ))}
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
              chapter: "all",
              difficulty: "all",
              questionType: "all",
              search: ""
            })
          }
        >
          清空筛选
        </button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--ink-1)" }}>每页</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(() => 1);
            }}
            style={{ padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button
            className={query.subject === "all" ? "button secondary" : "button ghost"}
            type="button"
            onClick={() => patchQuery({ subject: "all", grade: "all", chapter: "all" })}
          >
            全部
          </button>
          {tree.slice(0, 6).map((subjectNode) => (
            <button
              key={subjectNode.subject}
              className={query.subject === subjectNode.subject ? "button secondary" : "button ghost"}
              type="button"
              onClick={() => patchQuery({ subject: subjectNode.subject, grade: "all", chapter: "all" })}
            >
              {SUBJECT_LABELS[subjectNode.subject] ?? subjectNode.subject}({subjectNode.count})
            </button>
          ))}
        </div>
      </div>

      <div className="split-rail-layout" style={{ marginTop: 12 }}>
        <div className="side-rail card" style={{ padding: 12 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            分类导航
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {tree.map((subjectNode, index) => (
              <details
                key={subjectNode.subject}
                open={
                  query.subject === subjectNode.subject || (query.subject === "all" && index === 0)
                }
                style={{
                  border: "1px solid var(--stroke)",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.6)",
                  padding: 8
                }}
              >
                <summary
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    listStyle: "none",
                    fontSize: 13,
                    fontWeight: 700
                  }}
                >
                  <span>{SUBJECT_LABELS[subjectNode.subject] ?? subjectNode.subject}</span>
                  <span className="badge">{subjectNode.count}</span>
                </summary>
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  {subjectNode.grades.map((gradeNode) => (
                    <div key={`${subjectNode.subject}-${gradeNode.grade}`} className="card" style={{ padding: 8 }}>
                      <button
                        className={query.grade === gradeNode.grade ? "button secondary" : "button ghost"}
                        type="button"
                        onClick={() =>
                          patchQuery({
                            subject: subjectNode.subject,
                            grade: gradeNode.grade,
                            chapter: "all"
                          })
                        }
                        style={{ width: "100%", justifyContent: "space-between" }}
                      >
                        <span>{gradeNode.grade} 年级</span>
                        <span>{gradeNode.count}</span>
                      </button>
                      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {gradeNode.chapters.slice(0, 8).map((chapterNode) => (
                          <button
                            key={`${subjectNode.subject}-${gradeNode.grade}-${chapterNode.chapter}`}
                            className="badge"
                            type="button"
                            onClick={() =>
                              patchQuery({
                                subject: subjectNode.subject,
                                grade: gradeNode.grade,
                                chapter: chapterNode.chapter
                              })
                            }
                            style={{ border: "none", cursor: "pointer" }}
                          >
                            {chapterNode.chapter} · {chapterNode.count}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="masonry-list">
          {loading ? <p>加载中...</p> : null}
          {!loading && list.length === 0 ? (
            <div className="card full-span">
              <div className="section-title" style={{ marginTop: 0 }}>
                暂无结果
              </div>
              <div style={{ color: "var(--ink-1)", fontSize: 13 }}>请调整筛选条件后重试。</div>
            </div>
          ) : null}
          {list.map((item) => (
            <div className="card" key={item.id}>
              {typeof item.qualityScore === "number" ? (
                <div style={{ marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <span className="badge">质量分 {item.qualityScore}</span>
                  {item.riskLevel ? <span className="badge">风险等级 {riskLabel[item.riskLevel]}</span> : null}
                  {item.duplicateRisk ? <span className="badge">重复风险 {riskLabel[item.duplicateRisk]}</span> : null}
                  {item.ambiguityRisk ? <span className="badge">歧义风险 {riskLabel[item.ambiguityRisk]}</span> : null}
                  {typeof item.answerConsistency === "number" ? (
                    <span className="badge">答案一致性 {item.answerConsistency}</span>
                  ) : null}
                  {item.answerConflict ? <span className="badge">答案冲突</span> : null}
                  {item.isolated ? <span className="badge">隔离池</span> : null}
                </div>
              ) : null}
              <div
                className="section-title"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden"
                }}
              >
                {item.stem}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-1)", lineHeight: 1.5 }}>
                {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级 · 难度{" "}
                {difficultyLabel[item.difficulty ?? "medium"] ?? item.difficulty ?? "中"} · 题型{" "}
                {questionTypeLabel[item.questionType ?? "choice"] ?? item.questionType ?? "选择题"} · 选项{" "}
                {item.options.length} 个
              </div>
              {item.tags?.length ? (
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {item.tags.slice(0, 8).map((tag) => (
                    <span className="badge" key={`${item.id}-${tag}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div className="badge">答案：{item.answer}</div>
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => onToggleIsolation(item.id, !item.isolated)}
                >
                  {item.isolated ? "移出隔离池" : "加入隔离池"}
                </button>
                <button className="button secondary" type="button" onClick={() => onDelete(item.id)}>
                  删除
                </button>
              </div>
            </div>
          ))}

          <div className="card full-span" style={{ padding: 14 }}>
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
