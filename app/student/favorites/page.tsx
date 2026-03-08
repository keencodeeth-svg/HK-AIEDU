"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { pushAppToast } from "@/components/AppToastHub";
import MathText from "@/components/MathText";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import { getGradeLabel, SUBJECT_LABELS } from "@/lib/constants";

type FavoriteItem = {
  id: string;
  questionId: string;
  tags: string[];
  note?: string;
  updatedAt: string;
  question?: {
    id: string;
    stem: string;
    subject: string;
    grade: string;
    knowledgePointTitle: string;
  } | null;
};

type FavoritesResponse = {
  data?: FavoriteItem[];
};

function normalizeTagInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[，,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 12);
}

function buildSearchText(item: FavoriteItem) {
  return [
    item.question?.stem ?? "",
    item.question?.knowledgePointTitle ?? "",
    SUBJECT_LABELS[item.question?.subject ?? ""] ?? item.question?.subject ?? "",
    item.note ?? "",
    ...(item.tags ?? [])
  ]
    .join(" ")
    .toLowerCase();
}

async function copyToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  throw new Error("clipboard unavailable");
}

export default function StudentFavoritesPage() {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("compact");
  const [showAll, setShowAll] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [savingQuestionId, setSavingQuestionId] = useState("");
  const [removingQuestionId, setRemovingQuestionId] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const loadFavorites = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setPageError(null);

    try {
      const data = await requestJson<FavoritesResponse>("/api/favorites?includeQuestion=1");
      setFavorites(data.data ?? []);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      if (isAuthError(error)) {
        setAuthRequired(true);
        setFavorites([]);
      } else {
        setPageError(getRequestErrorMessage(error, "加载收藏夹失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFavorites("initial");
  }, [loadFavorites]);

  const subjectOptions = useMemo(() => {
    const subjects = Array.from(new Set(favorites.map((item) => item.question?.subject).filter((value): value is string => Boolean(value))));
    return subjects.sort((a, b) => (SUBJECT_LABELS[a] ?? a).localeCompare(SUBJECT_LABELS[b] ?? b, "zh-CN"));
  }, [favorites]);

  const topTags = useMemo(() => {
    const counter = new Map<string, number>();
    favorites.forEach((item) => {
      item.tags.forEach((tag) => counter.set(tag, (counter.get(tag) ?? 0) + 1));
    });
    return Array.from(counter.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
      .slice(0, 10);
  }, [favorites]);

  const filteredFavorites = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return favorites
      .filter((item) => {
        if (selectedTag && !item.tags.includes(selectedTag)) {
          return false;
        }
        if (subjectFilter !== "all" && item.question?.subject !== subjectFilter) {
          return false;
        }
        if (!needle) {
          return true;
        }
        return buildSearchText(item).includes(needle);
      })
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }, [favorites, keyword, selectedTag, subjectFilter]);

  const visibleFavorites = showAll ? filteredFavorites : filteredFavorites.slice(0, 12);
  const hasActiveFilters = Boolean(keyword.trim() || selectedTag || subjectFilter !== "all");
  const notedCount = useMemo(() => favorites.filter((item) => item.note?.trim()).length, [favorites]);
  const stageCopy = (() => {
    if (loading) {
      return {
        title: "正在整理你的收藏题目",
        description: "系统正在同步题目、标签与复习备注，请稍等。"
      };
    }

    if (editingQuestionId) {
      return {
        title: "正在整理这道收藏题的复习信息",
        description: "可以补充标签和备注，把这道题变成后续复习时更好用的学习资产。"
      };
    }

    if (!favorites.length) {
      return {
        title: "当前还没有收藏题目",
        description: "先在练习、考试或 AI 辅导中收藏题目，这里会自动沉淀成你的复习清单。"
      };
    }

    if (hasActiveFilters) {
      return {
        title: `当前筛出 ${filteredFavorites.length} 道重点收藏题`,
        description: "你可以继续按关键词、标签和学科收窄范围，快速找到要复习的那一组题。"
      };
    }

    return {
      title: `你已沉淀 ${favorites.length} 道收藏题`,
      description: "建议给重点题补上标签和备注，后续做阶段复习时会更快回忆解题思路。"
    };
  })();

  function clearFilters() {
    setKeyword("");
    setSelectedTag("");
    setSubjectFilter("all");
    setShowAll(false);
  }

  function openEditor(item: FavoriteItem) {
    setEditingQuestionId(item.questionId);
    setDraftTags(item.tags.join("，"));
    setDraftNote(item.note ?? "");
    setActionError(null);
    setActionMessage(null);
    requestAnimationFrame(() => editorRef.current?.focus());
  }

  function closeEditor() {
    setEditingQuestionId("");
    setDraftTags("");
    setDraftNote("");
  }

  async function handleSave(item: FavoriteItem) {
    setSavingQuestionId(item.questionId);
    setActionError(null);
    setActionMessage(null);

    try {
      const tags = normalizeTagInput(draftTags);
      await requestJson(`/api/favorites/${item.questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags, note: draftNote.trim() || undefined })
      });

      setFavorites((prev) =>
        prev.map((favorite) =>
          favorite.questionId === item.questionId
            ? {
                ...favorite,
                tags,
                note: draftNote.trim() || undefined,
                updatedAt: new Date().toISOString()
              }
            : favorite
        )
      );
      setLastLoadedAt(new Date().toISOString());
      setActionMessage(tags.length || draftNote.trim() ? "收藏信息已更新，复习时更容易快速定位。" : "已清空标签和备注。");
      pushAppToast("收藏信息已保存");
      closeEditor();
    } catch (error) {
      const message = getRequestErrorMessage(error, "保存收藏信息失败");
      setActionError(message);
      pushAppToast(message, "error");
    } finally {
      setSavingQuestionId("");
    }
  }

  async function handleRemove(item: FavoriteItem) {
    setRemovingQuestionId(item.questionId);
    setActionError(null);
    setActionMessage(null);

    try {
      await requestJson(`/api/favorites/${item.questionId}`, { method: "DELETE" });
      setFavorites((prev) => prev.filter((favorite) => favorite.questionId !== item.questionId));
      setLastLoadedAt(new Date().toISOString());
      if (editingQuestionId === item.questionId) {
        closeEditor();
      }
      setActionMessage("已从收藏夹移除这道题。");
      pushAppToast("已取消收藏");
    } catch (error) {
      const message = getRequestErrorMessage(error, "取消收藏失败");
      setActionError(message);
      pushAppToast(message, "error");
    } finally {
      setRemovingQuestionId("");
    }
  }

  async function handleCopyQuestion(item: FavoriteItem) {
    const stem = item.question?.stem?.trim() ?? "";
    if (!stem) {
      pushAppToast("当前题目内容为空", "error");
      return;
    }
    try {
      await copyToClipboard(stem);
      pushAppToast("已复制题目");
    } catch {
      pushAppToast("复制失败，请稍后重试", "error");
    }
  }

  function renderEditor(item: FavoriteItem) {
    if (editingQuestionId !== item.questionId) {
      return null;
    }

    return (
      <div className="card favorites-editor-card" style={{ marginTop: 10 }}>
        <div className="section-title">编辑标签与备注</div>
        <label className="grid" style={{ gap: 6 }}>
          <div className="form-note">标签可用逗号或换行分隔，例如：易错、分数、应用题</div>
          <textarea
            value={draftTags}
            onChange={(event) => setDraftTags(event.target.value)}
            rows={2}
            className="inbox-textarea"
            placeholder="输入标签"
          />
        </label>
        <label className="grid" style={{ gap: 6, marginTop: 10 }}>
          <div className="form-note">补一句复习备注，帮助未来快速回忆这题为什么重要。</div>
          <textarea
            ref={editorRef}
            value={draftNote}
            onChange={(event) => setDraftNote(event.target.value)}
            rows={3}
            className="inbox-textarea"
            placeholder="例如：这题容易把单位换算漏掉；下次先列已知条件。"
          />
        </label>
        <div className="cta-row favorites-editor-actions">
          <button className="button primary" type="button" onClick={() => void handleSave(item)} disabled={savingQuestionId === item.questionId}>
            {savingQuestionId === item.questionId ? "保存中..." : "保存信息"}
          </button>
          <button className="button ghost" type="button" onClick={closeEditor} disabled={savingQuestionId === item.questionId}>
            取消编辑
          </button>
        </div>
      </div>
    );
  }

  function renderCompactFavorite(item: FavoriteItem) {
    return (
      <div className="card favorites-item-card" key={item.id}>
        <div style={{ minWidth: 0 }}>
          <div className="section-title" style={{ fontSize: 14 }}>
            <MathText text={item.question?.stem ?? "题目"} />
          </div>
          <div className="workflow-card-meta" style={{ marginTop: 8 }}>
            <span className="pill">{SUBJECT_LABELS[item.question?.subject ?? ""] ?? item.question?.subject ?? "未分类"}</span>
            <span className="pill">{getGradeLabel(item.question?.grade)}</span>
            <span className="pill">{item.question?.knowledgePointTitle ?? "未关联知识点"}</span>
            <span className="pill">更新于 {formatLoadedTime(item.updatedAt)}</span>
          </div>
          <div className="favorites-tags-line">
            标签：{item.tags.length ? item.tags.join("、") : "未设置"}
            {item.note?.trim() ? ` · 备注：${item.note.trim()}` : ""}
          </div>
        </div>
        <div className="cta-row favorites-item-actions">
          <button className="button secondary" type="button" onClick={() => openEditor(item)}>
            {editingQuestionId === item.questionId ? "继续编辑" : "编辑"}
          </button>
          <button className="button ghost" type="button" onClick={() => void handleCopyQuestion(item)}>
            复制题目
          </button>
          <button className="button ghost" type="button" onClick={() => void handleRemove(item)} disabled={removingQuestionId === item.questionId}>
            {removingQuestionId === item.questionId ? "移除中..." : "删除"}
          </button>
        </div>
        {renderEditor(item)}
      </div>
    );
  }

  if (loading && !authRequired) {
    return (
      <StatePanel
        tone="loading"
        title="正在加载题目收藏夹"
        description="正在同步你的收藏题、标签和复习备注，请稍等。"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录后查看收藏夹"
        description="登录学生账号后，才能查看和整理你的个人题目收藏记录。"
      />
    );
  }

  if (pageError && !favorites.length) {
    return (
      <StatePanel
        tone="error"
        title="收藏夹加载失败"
        description={pageError}
        action={
          <button className="button secondary" type="button" onClick={() => void loadFavorites("refresh")}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>题目收藏夹</h2>
          <div className="section-sub">收藏题目、补标签、写备注，把零散好题沉淀成真正可复习的个人题库。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">收藏 {favorites.length}</span>
          <span className="chip">备注 {notedCount}</span>
          <span className="chip">学科 {subjectOptions.length}</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button className="button secondary" type="button" onClick={() => void loadFavorites("refresh")} disabled={refreshing || Boolean(savingQuestionId) || Boolean(removingQuestionId)}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${pageError}`}
          action={
            <button className="button secondary" type="button" onClick={() => void loadFavorites("refresh")}>
              再试一次
            </button>
          }
        />
      ) : null}

      {actionError ? <div className="status-note error">{actionError}</div> : null}
      {actionMessage ? <div className="status-note success">{actionMessage}</div> : null}

      <div className="favorites-stage-banner">
        <div className="favorites-stage-kicker">当前阶段</div>
        <div className="favorites-stage-title">{stageCopy.title}</div>
        <p className="favorites-stage-description">{stageCopy.description}</p>
        <div className="pill-list">
          <span className="pill">当前显示 {filteredFavorites.length}</span>
          <span className="pill">可见卡片 {visibleFavorites.length}</span>
          <span className="pill">{viewMode === "compact" ? "紧凑视图" : "详细视图"}</span>
          {selectedTag ? <span className="pill">标签：{selectedTag}</span> : null}
        </div>
      </div>

      <Card title="收藏概览" tag="概览">
        <div className="grid grid-2">
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">收藏总数</div>
            <div className="workflow-summary-value">{favorites.length}</div>
            <div className="workflow-summary-helper">沉淀到个人复习清单中的题目数量</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">当前筛选结果</div>
            <div className="workflow-summary-value">{filteredFavorites.length}</div>
            <div className="workflow-summary-helper">符合当前关键词、标签与学科条件的题目数</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">已写备注</div>
            <div className="workflow-summary-value">{notedCount}</div>
            <div className="workflow-summary-helper">带有个人复习提醒或错误总结的收藏题</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">学科覆盖</div>
            <div className="workflow-summary-value">{subjectOptions.length}</div>
            <div className="workflow-summary-helper">当前收藏涉及到的学科数量</div>
          </div>
        </div>
      </Card>

      <Card title="筛选与视图" tag="筛选">
        <div className="grid grid-3">
          <label>
            <div className="section-title">搜索收藏</div>
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setShowAll(false);
              }}
              placeholder="搜索题干、知识点、标签或备注"
              className="workflow-search-input"
              style={{ width: "100%" }}
            />
          </label>
          <label>
            <div className="section-title">学科筛选</div>
            <select
              className="select-control"
              value={subjectFilter}
              onChange={(event) => {
                setSubjectFilter(event.target.value);
                setShowAll(false);
              }}
              style={{ width: "100%" }}
            >
              <option value="all">全部学科</option>
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>
                  {SUBJECT_LABELS[subject] ?? subject}
                </option>
              ))}
            </select>
          </label>
          <div className="card favorites-filter-card">
            <div className="section-title">当前状态</div>
            <div className="favorites-filter-meta">{hasActiveFilters ? `已启用筛选，显示 ${filteredFavorites.length} 条结果` : "当前展示全部收藏记录"}</div>
          </div>
        </div>

        {topTags.length ? (
          <div className="pill-list" style={{ marginTop: 12 }}>
            {topTags.map(([tag, count]) => {
              const active = selectedTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  className={active ? "button secondary" : "button ghost"}
                  onClick={() => {
                    setSelectedTag((prev) => (prev === tag ? "" : tag));
                    setShowAll(false);
                  }}
                >
                  {tag} · {count}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="toolbar-wrap" style={{ marginTop: 12 }}>
          <button className={viewMode === "compact" ? "button secondary" : "button ghost"} type="button" onClick={() => setViewMode("compact")}>
            紧凑视图
          </button>
          <button className={viewMode === "detailed" ? "button secondary" : "button ghost"} type="button" onClick={() => setViewMode("detailed")}>
            详细视图
          </button>
          {hasActiveFilters ? (
            <button className="button ghost" type="button" onClick={clearFilters}>
              清空筛选
            </button>
          ) : null}
        </div>
      </Card>

      <Card title="我的收藏" tag="清单">
        {!filteredFavorites.length ? (
          <StatePanel
            compact
            tone="empty"
            title={hasActiveFilters ? "当前筛选条件下暂无收藏" : "还没有收藏题目"}
            description={hasActiveFilters ? "可以清空筛选后查看全部收藏。" : "先在练习、考试或 AI 辅导中收藏题目，这里会自动沉淀。"}
            action={
              hasActiveFilters ? (
                <button className="button secondary" type="button" onClick={clearFilters}>
                  清空筛选
                </button>
              ) : null
            }
          />
        ) : viewMode === "compact" ? (
          <div className="grid" style={{ gap: 10 }}>
            {visibleFavorites.map((item) => renderCompactFavorite(item))}
          </div>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {visibleFavorites.map((item) => (
              <div className="card favorites-item-card" key={item.id}>
                <div className="feature-card">
                  <EduIcon name="book" />
                  <div style={{ minWidth: 0 }}>
                    <div className="section-title">
                      <MathText text={item.question?.stem ?? "题目"} />
                    </div>
                    <div className="workflow-card-meta" style={{ marginTop: 8 }}>
                      <span className="pill">{item.question?.knowledgePointTitle ?? "未关联知识点"}</span>
                      <span className="pill">{getGradeLabel(item.question?.grade)}</span>
                      <span className="pill">{SUBJECT_LABELS[item.question?.subject ?? ""] ?? item.question?.subject ?? "未分类"}</span>
                      <span className="pill">更新于 {formatLoadedTime(item.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="favorites-detail-block">
                  <div className="badge">标签</div>
                  <div>{item.tags.length ? item.tags.join("、") : "暂未设置标签"}</div>
                </div>

                <div className="favorites-detail-block">
                  <div className="badge">复习备注</div>
                  <div>{item.note?.trim() ? item.note.trim() : "暂未填写复习备注"}</div>
                </div>

                <div className="cta-row favorites-item-actions">
                  <button className="button secondary" type="button" onClick={() => openEditor(item)}>
                    {editingQuestionId === item.questionId ? "继续编辑" : "编辑标签 / 备注"}
                  </button>
                  <button className="button ghost" type="button" onClick={() => void handleCopyQuestion(item)}>
                    复制题目
                  </button>
                  <button className="button ghost" type="button" onClick={() => void handleRemove(item)} disabled={removingQuestionId === item.questionId}>
                    {removingQuestionId === item.questionId ? "移除中..." : "取消收藏"}
                  </button>
                </div>
                {renderEditor(item)}
              </div>
            ))}
          </div>
        )}

        {filteredFavorites.length > 12 ? (
          <div className="cta-row favorites-load-more">
            <button className="button ghost" type="button" onClick={() => setShowAll((prev) => !prev)}>
              {showAll ? "收起结果" : `展开全部（${filteredFavorites.length}）`}
            </button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
