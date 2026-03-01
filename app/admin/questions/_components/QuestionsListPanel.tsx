"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import MathText from "@/components/MathText";
import { SUBJECT_LABELS } from "@/lib/constants";
import {
  difficultyLabel,
  questionTypeLabel,
  riskLabel,
  type Question,
  type QuestionFacets,
  type QuestionQualitySummary,
  type QuestionQuery,
  type QuestionTreeNode
} from "../types";

type Props = {
  query: QuestionQuery;
  patchQuery: (next: Partial<QuestionQuery>) => void;
  facets: QuestionFacets;
  tree: QuestionTreeNode[];
  qualitySummary: QuestionQualitySummary | null;
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
  recheckLoading: boolean;
  recheckMessage: string | null;
  recheckError: string | null;
  onRecheckQuality: () => Promise<void>;
};

type ResultRiskKey = "high" | "medium" | "low" | "unknown";

type ResultGroup = {
  id: string;
  subject: string;
  grade: string;
  risk: ResultRiskKey;
  label: string;
  items: Question[];
  isolatedCount: number;
  conflictCount: number;
};

function toResultRisk(item: Question): ResultRiskKey {
  if (item.riskLevel === "high") return "high";
  if (item.riskLevel === "medium") return "medium";
  if (item.riskLevel === "low") return "low";
  return "unknown";
}

function riskText(risk: ResultRiskKey) {
  if (risk === "high") return "高风险";
  if (risk === "medium") return "中风险";
  if (risk === "low") return "低风险";
  return "未评估";
}

function buildQuestionBadges(item: Question) {
  const badges: Array<{ key: string; text: string }> = [];
  if (typeof item.qualityScore === "number") {
    badges.push({ key: `${item.id}-quality`, text: `质量分 ${item.qualityScore}` });
  }
  if (item.riskLevel) {
    badges.push({ key: `${item.id}-risk`, text: `风险等级 ${riskLabel[item.riskLevel]}` });
  }
  if (item.duplicateRisk) {
    badges.push({ key: `${item.id}-dup-risk`, text: `重复风险 ${riskLabel[item.duplicateRisk]}` });
  }
  if (item.ambiguityRisk) {
    badges.push({ key: `${item.id}-amb-risk`, text: `歧义风险 ${riskLabel[item.ambiguityRisk]}` });
  }
  if (typeof item.answerConsistency === "number") {
    badges.push({ key: `${item.id}-consistency`, text: `答案一致性 ${item.answerConsistency}` });
  }
  if (item.answerConflict) {
    badges.push({ key: `${item.id}-conflict`, text: "答案冲突" });
  }
  if (item.duplicateClusterId) {
    badges.push({ key: `${item.id}-cluster`, text: `重复簇 ${item.duplicateClusterId}` });
  }
  if (item.isolated) {
    badges.push({ key: `${item.id}-isolated`, text: "隔离池" });
  }
  return badges;
}

export default function QuestionsListPanel({
  query,
  patchQuery,
  facets,
  tree,
  qualitySummary,
  loading,
  list,
  meta,
  pageSize,
  setPageSize,
  setPage,
  pageStart,
  pageEnd,
  onDelete,
  onToggleIsolation,
  recheckLoading,
  recheckMessage,
  recheckError,
  onRecheckQuality
}: Props) {
  const [resultView, setResultView] = useState<"compact" | "detailed">("compact");
  const [openResultGroups, setOpenResultGroups] = useState<Record<string, boolean>>({});
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

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
    query.search.trim() ? `关键词：${query.search.trim()}` : null,
    query.pool === "isolated" ? "题目池：仅隔离池" : null,
    query.pool === "active" ? "题目池：排除隔离池" : null,
    query.riskLevel !== "all" ? `风险：${riskLabel[query.riskLevel]}` : null,
    query.answerConflict === "yes"
      ? "答案冲突：仅冲突"
      : query.answerConflict === "no"
        ? "答案冲突：排除冲突"
        : null,
    query.duplicateClusterId.trim() ? `重复簇：${query.duplicateClusterId.trim()}` : null
  ].filter(Boolean) as string[];

  const groupedResults = useMemo(() => {
    const buckets = new Map<string, ResultGroup>();
    list.forEach((item) => {
      const risk = toResultRisk(item);
      const id = `${item.subject}|${item.grade}|${risk}`;
      const current = buckets.get(id) ?? {
        id,
        subject: item.subject,
        grade: item.grade,
        risk,
        label: `${SUBJECT_LABELS[item.subject] ?? item.subject} · ${item.grade} 年级 · ${riskText(risk)}`,
        items: [],
        isolatedCount: 0,
        conflictCount: 0
      };
      current.items.push(item);
      current.isolatedCount += item.isolated ? 1 : 0;
      current.conflictCount += item.answerConflict ? 1 : 0;
      buckets.set(id, current);
    });

    const riskOrder: Record<ResultRiskKey, number> = {
      high: 0,
      medium: 1,
      low: 2,
      unknown: 3
    };

    return Array.from(buckets.values())
      .map((group) => ({
        ...group,
        items: group.items.slice().sort((a, b) => {
          const left = (a.qualityScore ?? -1);
          const right = (b.qualityScore ?? -1);
          if (left !== right) return right - left;
          return a.id.localeCompare(b.id);
        })
      }))
      .sort((a, b) => {
        if (riskOrder[a.risk] !== riskOrder[b.risk]) return riskOrder[a.risk] - riskOrder[b.risk];
        const subjectOrder = (SUBJECT_LABELS[a.subject] ?? a.subject).localeCompare(
          SUBJECT_LABELS[b.subject] ?? b.subject,
          "zh-CN"
        );
        if (subjectOrder !== 0) return subjectOrder;
        return a.grade.localeCompare(b.grade, "zh-CN");
      });
  }, [list]);

  useEffect(() => {
    setOpenResultGroups((prev) => {
      const next: Record<string, boolean> = {};
      groupedResults.forEach((group) => {
        if (typeof prev[group.id] === "boolean") {
          next[group.id] = prev[group.id];
          return;
        }
        if (query.riskLevel !== "all" && query.riskLevel === group.risk) {
          next[group.id] = true;
          return;
        }
        next[group.id] = true;
      });
      return next;
    });
  }, [groupedResults, query.riskLevel]);

  useEffect(() => {
    if (!selectedQuestion) return;
    const stillExists = list.some((item) => item.id === selectedQuestion.id);
    if (!stillExists) {
      setSelectedQuestion(null);
    }
  }, [list, selectedQuestion]);

  function setAllResultGroups(open: boolean) {
    const next: Record<string, boolean> = {};
    groupedResults.forEach((group) => {
      next[group.id] = open;
    });
    setOpenResultGroups(next);
  }

  function patchGroupOpen(groupId: string, open: boolean) {
    setOpenResultGroups((prev) => ({ ...prev, [groupId]: open }));
  }

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

      {qualitySummary ? (
        <div className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            质量治理概览
          </div>
          <div className="pill-list">
            <span className="pill">已质检 {qualitySummary.trackedCount}</span>
            <span className="pill">高风险 {qualitySummary.highRiskCount}</span>
            <span className="pill">中风险 {qualitySummary.mediumRiskCount}</span>
            <span className="pill">答案冲突 {qualitySummary.answerConflictCount}</span>
            <span className="pill">隔离池 {qualitySummary.isolatedCount}</span>
            <span className="pill">重复簇 {qualitySummary.duplicateClusterCount}</span>
          </div>
          {qualitySummary.topDuplicateClusters?.length ? (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {qualitySummary.topDuplicateClusters.map((cluster) => (
                <button
                  className="badge"
                  key={cluster.id}
                  type="button"
                  onClick={() =>
                    patchQuery({
                      duplicateClusterId: cluster.id,
                      pool: "all"
                    })
                  }
                  style={{ border: "none", cursor: "pointer" }}
                >
                  簇 {cluster.id} · {cluster.count} 题 · 高风险 {cluster.highRiskCount}
                </button>
              ))}
            </div>
          ) : null}
          <div className="cta-row" style={{ marginTop: 10 }}>
            <button className="button secondary" type="button" onClick={onRecheckQuality} disabled={recheckLoading}>
              {recheckLoading ? "重算中..." : "一键重算质检"}
            </button>
            {recheckMessage ? <span className="status-note success">{recheckMessage}</span> : null}
            {recheckError ? <span className="status-note error">{recheckError}</span> : null}
          </div>
        </div>
      ) : null}

      <div className="grid" style={{ gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
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
          <div className="section-title">题目池</div>
          <select
            value={query.pool}
            onChange={(event) =>
              patchQuery({ pool: event.target.value as "all" | "isolated" | "active" })
            }
            style={controlStyle}
          >
            <option value="all">全部题目</option>
            <option value="isolated">仅隔离池</option>
            <option value="active">排除隔离池</option>
          </select>
        </label>
      </div>

      <details
        style={{ marginTop: 8 }}
        open={Boolean(
          query.riskLevel !== "all" ||
            query.answerConflict !== "all" ||
            query.duplicateClusterId.trim() ||
            query.difficulty !== "all" ||
            query.questionType !== "all"
        )}
      >
        <summary
          style={{
            cursor: "pointer",
            listStyle: "none",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ink-1)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8
          }}
        >
          高级筛选（质检/风险）
        </summary>
        <div
          className="grid"
          style={{ gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", marginTop: 8 }}
        >
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
          <label>
            <div className="section-title">质量风险</div>
            <select
              value={query.riskLevel}
              onChange={(event) =>
                patchQuery({ riskLevel: event.target.value as "all" | "low" | "medium" | "high" })
              }
              style={controlStyle}
            >
              <option value="all">全部风险</option>
              <option value="high">高风险</option>
              <option value="medium">中风险</option>
              <option value="low">低风险</option>
            </select>
          </label>
          <label>
            <div className="section-title">答案冲突</div>
            <select
              value={query.answerConflict}
              onChange={(event) =>
                patchQuery({ answerConflict: event.target.value as "all" | "yes" | "no" })
              }
              style={controlStyle}
            >
              <option value="all">全部</option>
              <option value="yes">仅冲突</option>
              <option value="no">排除冲突</option>
            </select>
          </label>
          <label>
            <div className="section-title">重复簇 ID</div>
            <input
              value={query.duplicateClusterId}
              onChange={(event) => patchQuery({ duplicateClusterId: event.target.value })}
              placeholder="输入簇 ID（支持包含匹配）"
              style={controlStyle}
            />
          </label>
        </div>
      </details>

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
              search: "",
              pool: "all",
              riskLevel: "all",
              answerConflict: "all",
              duplicateClusterId: ""
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
            onClick={() =>
              patchQuery({
                subject: "all",
                grade: "all",
                chapter: "all",
                pool: "all",
                riskLevel: "all",
                answerConflict: "all",
                duplicateClusterId: ""
              })
            }
          >
            全部
          </button>
          <button
            className={query.pool === "isolated" ? "button secondary" : "button ghost"}
            type="button"
            onClick={() => patchQuery({ pool: "isolated" })}
          >
            隔离池
          </button>
          <button
            className={query.riskLevel === "high" ? "button secondary" : "button ghost"}
            type="button"
            onClick={() => patchQuery({ riskLevel: "high" })}
          >
            高风险
          </button>
          <button
            className={query.answerConflict === "yes" ? "button secondary" : "button ghost"}
            type="button"
            onClick={() => patchQuery({ answerConflict: "yes" })}
          >
            答案冲突
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

      <div className="cta-row" style={{ marginTop: 8 }}>
        <span className="badge">结果视图</span>
        <button
          className={resultView === "compact" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => setResultView("compact")}
        >
          紧凑模式
        </button>
        <button
          className={resultView === "detailed" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => setResultView("detailed")}
        >
          详细模式
        </button>
        <button className="button ghost" type="button" onClick={() => setAllResultGroups(false)}>
          收起全部分组
        </button>
        <button className="button ghost" type="button" onClick={() => setAllResultGroups(true)}>
          展开全部分组
        </button>
      </div>

      <div className="split-rail-layout" style={{ marginTop: 12 }}>
        <div className="side-rail card" style={{ padding: 12 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            分类导航（默认收起）
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {tree.map((subjectNode) => (
              <details
                key={subjectNode.subject}
                open={query.subject === subjectNode.subject}
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

        <div className="masonry-list" style={{ gridTemplateColumns: "1fr" }}>
          {selectedQuestion ? (
            <div className="card full-span" style={{ padding: 12, background: "rgba(255, 255, 255, 0.88)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div className="section-title" style={{ marginTop: 0 }}>
                  题目详情
                </div>
                <button className="button ghost" type="button" onClick={() => setSelectedQuestion(null)}>
                  关闭
                </button>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-1)" }}>
                {SUBJECT_LABELS[selectedQuestion.subject] ?? selectedQuestion.subject} · {selectedQuestion.grade} 年级 ·
                难度 {difficultyLabel[selectedQuestion.difficulty ?? "medium"] ?? selectedQuestion.difficulty ?? "中"} ·
                题型 {questionTypeLabel[selectedQuestion.questionType ?? "choice"] ?? selectedQuestion.questionType ?? "选择题"} ·
                ID {selectedQuestion.id}
              </div>
              <div style={{ marginTop: 10 }}>
                <MathText as="div" text={selectedQuestion.stem} />
              </div>
              {selectedQuestion.options.length ? (
                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  {selectedQuestion.options.map((option) => (
                    <div key={`${selectedQuestion.id}-opt-${option}`} className="card" style={{ padding: 8 }}>
                      <MathText text={option} />
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span className="badge">
                  正确答案：<MathText text={selectedQuestion.answer} />
                </span>
                <span className="badge">知识点ID：{selectedQuestion.knowledgePointId}</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <div className="section-title" style={{ marginTop: 0 }}>
                  解析
                </div>
                <MathText as="div" text={selectedQuestion.explanation?.trim() || "暂无解析"} />
              </div>
              {selectedQuestion.tags?.length ? (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedQuestion.tags.map((tag) => (
                    <span className="badge" key={`${selectedQuestion.id}-tag-${tag}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {loading ? (
            <div className="empty-state full-span">
              <p className="empty-state-title">加载中</p>
              <p style={{ margin: 0 }}>正在读取题目与质量信息。</p>
            </div>
          ) : null}
          {!loading && list.length === 0 ? (
            <div className="empty-state full-span">
              <p className="empty-state-title">暂无结果</p>
              <p style={{ margin: 0 }}>请调整筛选条件后重试。</p>
            </div>
          ) : null}

          {!loading &&
            groupedResults.map((group) => (
              <details
                key={group.id}
                className="card full-span"
                open={openResultGroups[group.id] ?? false}
                onToggle={(event) => patchGroupOpen(group.id, event.currentTarget.open)}
                style={{ padding: 12 }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    listStyle: "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 700
                  }}
                >
                  <span>{group.label}</span>
                  <span className="badge">{group.items.length} 题</span>
                </summary>
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <span className="pill">隔离池 {group.isolatedCount}</span>
                  <span className="pill">答案冲突 {group.conflictCount}</span>
                </div>

                {resultView === "compact" ? (
                  <div className="grid" style={{ gap: 8, marginTop: 10 }}>
                    {group.items.map((item) => {
                      const badges = buildQuestionBadges(item).slice(0, 4);
                      return (
                        <div
                          key={item.id}
                          style={{
                            border: "1px solid var(--stroke)",
                            borderRadius: 12,
                            background: "rgba(255,255,255,0.72)",
                            padding: 10
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 1,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden"
                                }}
                              >
                                <MathText text={item.stem} />
                              </div>
                              <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-1)" }}>
                                {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级 · 难度{" "}
                                {difficultyLabel[item.difficulty ?? "medium"] ?? item.difficulty ?? "中"} · 题型{" "}
                                {questionTypeLabel[item.questionType ?? "choice"] ?? item.questionType ?? "选择题"} ·
                                选项 {item.options.length} 个
                              </div>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
                              <span className="badge">
                                答案：<MathText text={item.answer} />
                              </span>
                              <button
                                className="button secondary"
                                type="button"
                                onClick={() => setSelectedQuestion(item)}
                              >
                                查看详情
                              </button>
                              <button
                                className="button ghost"
                                type="button"
                                onClick={() => onToggleIsolation(item.id, !item.isolated)}
                              >
                                {item.isolated ? "移出隔离池" : "加入隔离池"}
                              </button>
                              <button className="button danger" type="button" onClick={() => onDelete(item.id)}>
                                删除
                              </button>
                            </div>
                          </div>
                          {badges.length ? (
                            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {badges.map((badge) => (
                                <span className="badge" key={badge.key}>
                                  {badge.text}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="grid"
                    style={{ gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", marginTop: 10 }}
                  >
                    {group.items.map((item) => (
                      <div className="card" key={item.id}>
                        {buildQuestionBadges(item).length ? (
                          <div style={{ marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {buildQuestionBadges(item).map((badge) => (
                              <span className="badge" key={badge.key}>
                                {badge.text}
                              </span>
                            ))}
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
                          <MathText text={item.stem} />
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
                        {item.isolationReason?.length ? (
                          <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                            隔离原因：{item.isolationReason.join("；")}
                          </div>
                        ) : null}
                        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <button className="button secondary" type="button" onClick={() => setSelectedQuestion(item)}>
                            查看详情
                          </button>
                          <div className="badge">
                            答案：<MathText text={item.answer} />
                          </div>
                          <button
                            className="button ghost"
                            type="button"
                            onClick={() => onToggleIsolation(item.id, !item.isolated)}
                          >
                            {item.isolated ? "移出隔离池" : "加入隔离池"}
                          </button>
                          <button className="button danger" type="button" onClick={() => onDelete(item.id)}>
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </details>
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
