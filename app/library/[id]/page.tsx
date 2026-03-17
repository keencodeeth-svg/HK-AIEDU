"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Card from "@/components/Card";
import LibraryReader from "@/components/LibraryReader";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { formatLoadedTime, isAuthError, requestJson } from "@/lib/client-request";
import type {
  LibraryAnnotation,
  LibraryAnnotationListResponse,
  LibraryAuthResponse,
  LibraryDetailAuthUser,
  LibraryDetailItem,
  LibraryDetailResponse,
  LibraryKnowledgePoint,
  LibraryKnowledgePointListResponse,
  LibraryShareResponse
} from "../types";
import {
  getLibraryDetailRequestMessage,
  isMissingLibraryItemError,
  resolveLibrarySelectedKnowledgePointIds
} from "../detail-utils";

type LibraryAnnotationMutationResponse = {
  data?: LibraryAnnotation;
  error?: string;
};

type LibraryLoadResult = {
  errorMessage: string | null;
  hasSuccess: boolean;
  status: "auth" | "error" | "loaded" | "stale";
};

export default function LibraryDetailPage({ params }: { params: { id: string } }) {
  const loadRequestIdRef = useRef(0);
  const hasItemSnapshotRef = useRef(false);
  const hasAnnotationsSnapshotRef = useRef(false);
  const hasUserSnapshotRef = useRef(false);
  const hasKnowledgePointsSnapshotRef = useRef(false);
  const [item, setItem] = useState<LibraryDetailItem | null>(null);
  const [annotations, setAnnotations] = useState<LibraryAnnotation[]>([]);
  const [user, setUser] = useState<LibraryDetailAuthUser>(null);
  const [knowledgePoints, setKnowledgePoints] = useState<LibraryKnowledgePoint[]>([]);
  const [selectedKpIds, setSelectedKpIds] = useState<string[]>([]);
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [savingKnowledgePoints, setSavingKnowledgePoints] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearLibraryItemState = useCallback(() => {
    hasItemSnapshotRef.current = false;
    setItem(null);
    setSelectedKpIds([]);
    setQuote("");
    setNote("");
    setShareUrl("");
  }, []);

  const clearAnnotationsState = useCallback(() => {
    hasAnnotationsSnapshotRef.current = false;
    setAnnotations([]);
  }, []);

  const clearUserState = useCallback(() => {
    hasUserSnapshotRef.current = false;
    setUser(null);
  }, []);

  const clearKnowledgePointsState = useCallback(() => {
    hasKnowledgePointsSnapshotRef.current = false;
    setKnowledgePoints([]);
  }, []);

  const clearLibraryPageState = useCallback(() => {
    clearLibraryItemState();
    clearAnnotationsState();
    clearUserState();
    clearKnowledgePointsState();
    setPageError(null);
    setActionError(null);
    setMessage(null);
    setLastLoadedAt(null);
  }, [clearAnnotationsState, clearKnowledgePointsState, clearLibraryItemState, clearUserState]);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    clearLibraryPageState();
    setLoading(false);
    setRefreshing(false);
    setAuthRequired(true);
  }, [clearLibraryPageState]);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial"): Promise<LibraryLoadResult> => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const [itemResult, annotationsResult, authResult, knowledgePointsResult] = await Promise.allSettled([
        requestJson<LibraryDetailResponse>(`/api/library/${params.id}`),
        requestJson<LibraryAnnotationListResponse>(`/api/library/${params.id}/annotations`),
        requestJson<LibraryAuthResponse>("/api/auth/me"),
        requestJson<LibraryKnowledgePointListResponse>("/api/knowledge-points")
      ]);

      if (loadRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }

      const authFailure = [itemResult, annotationsResult, authResult, knowledgePointsResult].some(
        (result) => result.status === "rejected" && isAuthError(result.reason)
      );

      if (authFailure) {
        handleAuthRequired();
        return { status: "auth", errorMessage: null, hasSuccess: false };
      }

      let hasSuccess = false;
      const nextErrors: string[] = [];

      if (itemResult.status === "fulfilled" && itemResult.value.data) {
        hasItemSnapshotRef.current = true;
        setItem(itemResult.value.data);
        hasSuccess = true;
      } else {
        const itemErrorMessage =
          itemResult.status === "rejected"
            ? getLibraryDetailRequestMessage(itemResult.reason, "加载资料详情失败")
            : itemResult.value.error?.trim() || "加载资料详情失败";

        if (
          (itemResult.status === "rejected" && isMissingLibraryItemError(itemResult.reason)) ||
          !hasItemSnapshotRef.current
        ) {
          clearLibraryPageState();
          setAuthRequired(false);
          setPageError(itemErrorMessage);
          return { status: "error", errorMessage: itemErrorMessage, hasSuccess: false };
        }

        nextErrors.push(`资料详情加载失败：${itemErrorMessage}`);
      }

      if (annotationsResult.status === "fulfilled") {
        hasAnnotationsSnapshotRef.current = true;
        setAnnotations(annotationsResult.value.data ?? []);
        hasSuccess = true;
      } else {
        if (!hasAnnotationsSnapshotRef.current) {
          clearAnnotationsState();
        }
        nextErrors.push(`标注加载失败：${getLibraryDetailRequestMessage(annotationsResult.reason, "加载标注失败")}`);
      }

      if (authResult.status === "fulfilled") {
        hasUserSnapshotRef.current = true;
        setUser(authResult.value.user ?? authResult.value.data ?? null);
        hasSuccess = true;
      } else {
        if (!hasUserSnapshotRef.current) {
          clearUserState();
        }
        nextErrors.push(`登录信息同步失败：${getLibraryDetailRequestMessage(authResult.reason, "同步登录信息失败")}`);
      }

      if (knowledgePointsResult.status === "fulfilled") {
        hasKnowledgePointsSnapshotRef.current = true;
        setKnowledgePoints(knowledgePointsResult.value.data ?? []);
        hasSuccess = true;
      } else {
        if (!hasKnowledgePointsSnapshotRef.current) {
          clearKnowledgePointsState();
        }
        nextErrors.push(
          `知识点列表加载失败：${getLibraryDetailRequestMessage(knowledgePointsResult.reason, "加载知识点列表失败")}`
        );
      }

      setAuthRequired(false);
      if (hasSuccess) {
        setLastLoadedAt(new Date().toISOString());
      }
      if (nextErrors.length) {
        setPageError(nextErrors.join("；"));
      }

      return {
        status: nextErrors.length ? "error" : "loaded",
        errorMessage: nextErrors.length ? nextErrors.join("；") : null,
        hasSuccess
      };
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return { status: "auth", errorMessage: null, hasSuccess: false };
      }
      if (isMissingLibraryItemError(error)) {
        clearLibraryPageState();
        setAuthRequired(false);
        const errorMessage = getLibraryDetailRequestMessage(error, "加载资料详情失败");
        setPageError(errorMessage);
        return { status: "error", errorMessage, hasSuccess: false };
      }

      if (!hasItemSnapshotRef.current) {
        clearLibraryItemState();
      }
      if (!hasAnnotationsSnapshotRef.current) {
        clearAnnotationsState();
      }
      if (!hasUserSnapshotRef.current) {
        clearUserState();
      }
      if (!hasKnowledgePointsSnapshotRef.current) {
        clearKnowledgePointsState();
      }

      const errorMessage = getLibraryDetailRequestMessage(error, "加载资料详情失败");
      setAuthRequired(false);
      setPageError(errorMessage);
      return {
        status: "error",
        errorMessage,
        hasSuccess:
          hasItemSnapshotRef.current ||
          hasAnnotationsSnapshotRef.current ||
          hasUserSnapshotRef.current ||
          hasKnowledgePointsSnapshotRef.current
      };
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    clearAnnotationsState,
    clearKnowledgePointsState,
    clearLibraryItemState,
    clearLibraryPageState,
    clearUserState,
    handleAuthRequired,
    params.id
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedKpIds((current) => resolveLibrarySelectedKnowledgePointIds(item, knowledgePoints, current));
  }, [item, knowledgePoints]);

  const filteredKps = useMemo(() => {
    if (!item) return [];
    return knowledgePoints.filter((kp) => kp.subject === item.subject && kp.grade === item.grade);
  }, [item, knowledgePoints]);

  function tryCaptureSelection() {
    const selected = window.getSelection()?.toString().trim() ?? "";
    if (!selected) return;
    const offset = item?.textContent ? item.textContent.indexOf(selected) : -1;
    setQuote(selected);
    setActionError(null);
    setMessage(offset >= 0 ? `已捕获选中片段（${offset}-${offset + selected.length}）` : "已捕获选中片段");
  }

  async function submitAnnotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setActionError(null);
    if (!quote.trim()) {
      setActionError("请填写或选中标注片段");
      return;
    }
    const start = item?.textContent ? item.textContent.indexOf(quote.trim()) : -1;
    const end = start >= 0 ? start + quote.trim().length : undefined;
    setSavingAnnotation(true);

    try {
      await requestJson<LibraryAnnotationMutationResponse>(`/api/library/${params.id}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote: quote.trim(),
          startOffset: start >= 0 ? start : undefined,
          endOffset: end,
          note: note.trim() || undefined
        })
      });
      setQuote("");
      setNote("");
      const refreshResult = await load("refresh");
      setMessage(refreshResult.status === "error" ? "标注已保存，但最新数据刷新失败，请稍后重试。" : "标注已保存");
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingLibraryItemError(error)) {
        clearLibraryPageState();
        setAuthRequired(false);
        setPageError(getLibraryDetailRequestMessage(error, "资料不存在，或当前账号无权访问。"));
      } else {
        setActionError(getLibraryDetailRequestMessage(error, "保存标注失败"));
      }
    } finally {
      setSavingAnnotation(false);
    }
  }

  async function createShare() {
    setMessage(null);
    setActionError(null);
    setCreatingShare(true);

    try {
      const data = await requestJson<LibraryShareResponse>(`/api/library/${params.id}/share`, { method: "POST" });
      setShareUrl(data?.data?.shareUrl ?? "");
      setMessage("分享链接已生成");
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingLibraryItemError(error)) {
        clearLibraryPageState();
        setAuthRequired(false);
        setPageError(getLibraryDetailRequestMessage(error, "资料不存在，或当前账号无权访问。"));
      } else {
        setActionError(getLibraryDetailRequestMessage(error, "生成分享链接失败"));
      }
    } finally {
      setCreatingShare(false);
    }
  }

  async function saveKnowledgePoints() {
    setMessage(null);
    setActionError(null);
    if (!selectedKpIds.length) {
      setActionError("请至少选择一个知识点");
      return;
    }
    setSavingKnowledgePoints(true);

    try {
      const data = await requestJson<LibraryDetailResponse>(`/api/library/${params.id}/knowledge-points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgePointIds: selectedKpIds
        })
      });
      const nextItem = data.data ?? null;
      if (nextItem) {
        hasItemSnapshotRef.current = true;
        setItem(nextItem);
        setSelectedKpIds(nextItem.knowledgePointIds ?? []);
        setLastLoadedAt(new Date().toISOString());
      }
      setMessage("知识点修正已保存");
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingLibraryItemError(error)) {
        clearLibraryPageState();
        setAuthRequired(false);
        setPageError(getLibraryDetailRequestMessage(error, "资料不存在，或当前账号无权访问。"));
      } else {
        setActionError(getLibraryDetailRequestMessage(error, "更新知识点失败"));
      }
    } finally {
      setSavingKnowledgePoints(false);
    }
  }

  if (loading && !item && !authRequired) {
    return <StatePanel title="资料阅读加载中" description="正在同步资料详情、标注与知识点信息。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录后查看资料"
        description="登录后即可阅读资料、保存标注并管理分享链接。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (pageError && !item) {
    return (
      <StatePanel
        title="资料阅读加载失败"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void load()}>
            重试
          </button>
        }
      />
    );
  }

  if (!item) {
    return (
      <StatePanel
        title="资料阅读暂时不可用"
        description="当前未能读取资料详情，请稍后再试。"
        tone="empty"
        action={
          <button className="button secondary" type="button" onClick={() => void load()}>
            重新加载
          </button>
        }
      />
    );
  }

  const canEditKp = user?.role === "admin" || user?.role === "teacher";

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>{item.title}</h2>
          <div className="section-sub">
            {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级 ·{" "}
            {item.contentType === "textbook" ? "教材" : item.contentType === "courseware" ? "课件" : "教案"}
          </div>
        </div>
        <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="chip">{item.accessScope === "global" ? "全局" : "班级"}</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button className="button secondary" type="button" onClick={() => void load("refresh")} disabled={loading || refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? <StatePanel title="本次刷新存在异常" description={pageError} tone="error" compact /> : null}
      {actionError ? <StatePanel title="本次操作失败" description={actionError} tone="error" compact /> : null}

      <Card title="阅读内容" tag="查看">
        <LibraryReader item={item} onTextSelection={tryCaptureSelection} />
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button ghost" type="button" onClick={createShare} disabled={creatingShare || refreshing}>
            {creatingShare ? "生成中..." : "生成分享链接"}
          </button>
          {shareUrl ? (
            <a className="button secondary" href={shareUrl} target="_blank" rel="noreferrer">
              打开分享页
            </a>
          ) : null}
        </div>
      </Card>

      <Card title="阅读标注" tag="标注">
        <form onSubmit={submitAnnotation} style={{ display: "grid", gap: 10 }}>
          <label>
            <div className="section-title">标注片段</div>
            <textarea
              rows={3}
              value={quote}
              onChange={(event) => setQuote(event.target.value)}
              placeholder="可手动填写，或在上方选中文本自动带入"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">备注</div>
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="写下你的理解或问题"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit" disabled={savingAnnotation || refreshing}>
            {savingAnnotation ? "保存中..." : "保存标注"}
          </button>
        </form>
        <div className="grid" style={{ gap: 8, marginTop: 12 }}>
          {annotations.map((anno) => (
            <div className="card" key={anno.id}>
              <div style={{ fontWeight: 600 }}>{anno.quote}</div>
              {anno.note ? <div style={{ marginTop: 6 }}>{anno.note}</div> : null}
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                {new Date(anno.createdAt).toLocaleString("zh-CN")}
              </div>
            </div>
          ))}
          {!annotations.length ? <p>暂无标注。</p> : null}
        </div>
      </Card>

      <Card title="知识点提取与修正" tag="知识点">
        <div style={{ fontSize: 13, color: "var(--ink-1)" }}>
          AI 提取：{item.extractedKnowledgePoints?.length ? item.extractedKnowledgePoints.join("、") : "暂无"}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-1)" }}>
          当前绑定：{item.knowledgePointIds?.length ? item.knowledgePointIds.join("、") : "暂无"}
        </div>
        {canEditKp ? (
          <div style={{ marginTop: 10 }}>
            <div className="section-title">人工修正（多选）</div>
            <select
              multiple
              value={selectedKpIds}
              onChange={(event) =>
                setSelectedKpIds(Array.from(event.target.selectedOptions).map((opt) => opt.value))
              }
              disabled={savingKnowledgePoints || refreshing}
              style={{ width: "100%", height: 180, padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {filteredKps.map((kp) => (
                <option key={kp.id} value={kp.id}>
                  {kp.chapter} · {kp.title}
                </option>
              ))}
            </select>
            <div className="cta-row" style={{ marginTop: 10 }}>
              <button className="button primary" type="button" onClick={saveKnowledgePoints} disabled={savingKnowledgePoints || refreshing}>
                {savingKnowledgePoints ? "保存中..." : "保存修正"}
              </button>
            </div>
          </div>
        ) : (
          <p style={{ marginTop: 8 }}>当前账号仅可查看提取结果。</p>
        )}
      </Card>

      {message ? <div style={{ color: "#027a48", fontSize: 13 }}>{message}</div> : null}
      {shareUrl ? (
        <div className="card">
          <div className="section-title">分享链接</div>
          <div style={{ wordBreak: "break-all", fontSize: 13 }}>{shareUrl}</div>
        </div>
      ) : null}
    </div>
  );
}
