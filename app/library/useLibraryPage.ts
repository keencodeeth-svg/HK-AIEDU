"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import {
  getRequestErrorMessage,
  getRequestStatus,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import type {
  BatchImportSummary,
  ClassItem,
  LibraryAiFormState,
  LibraryAiGenerateResponse,
  LibraryAuthResponse,
  LibraryBatchImportFailedItem,
  LibraryBatchImportResponse,
  LibraryBatchPreview,
  LibraryContentFilter,
  LibraryDeleteResponse,
  LibraryDetailResponse,
  LibraryFacets,
  LibraryImportFormState,
  LibraryItem,
  LibraryMeta,
  LibrarySubjectGroup,
  LibrarySummary,
  LibraryUser,
  LibraryViewMode
} from "./types";
import {
  DEFAULT_FACETS,
  DEFAULT_META,
  DEFAULT_SUMMARY,
  buildBatchImportTemplate,
  contentTypeLabel,
  contentTypeRank,
  toBase64
} from "./utils";

type LibraryListResponse = {
  data?: LibraryItem[];
  meta?: Partial<LibraryMeta>;
  facets?: Partial<LibraryFacets>;
  summary?: Partial<LibrarySummary>;
};

type TeacherClassesResponse = {
  data?: ClassItem[];
};

function getLibraryPageBaseRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续管理资料库。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "资料不存在，可能已被删除或你已失去访问权限。";
  }
  return getRequestErrorMessage(error, fallback);
}

function getLibraryImportRequestMessage(error: unknown, fallback: string) {
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (requestMessage === "missing fields") {
    return "请补全标题、学科和年级后再提交。";
  }
  if (requestMessage === "textbook requires file source") {
    return "教材资源仅支持文件导入，请切换为文件上传。";
  }
  if (requestMessage === "file content required" || requestMessage === "missing file content") {
    return "请先上传文件内容后再提交。";
  }
  if (requestMessage === "link required" || requestMessage === "missing link") {
    return "请填写有效链接后再提交。";
  }
  if (requestMessage === "text content required" || requestMessage === "missing text content") {
    return "请填写资料正文后再提交。";
  }
  return getLibraryPageBaseRequestMessage(error, fallback);
}

function getLibraryBatchImportRequestMessage(error: unknown, fallback: string) {
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (requestMessage === "textbooks or questions required") {
    return "批量导入至少需要提供教材或习题数据。";
  }
  return getLibraryPageBaseRequestMessage(error, fallback);
}

function getLibraryAiGenerateRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (requestMessage === "missing fields") {
    return "请先选择班级并填写主题后再生成。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "当前班级不存在，或你无权向该班级生成资料。";
  }
  return getLibraryPageBaseRequestMessage(error, fallback);
}

function normalizeLibraryBatchFailedReason(reason: string) {
  const normalized = reason.trim().toLowerCase();

  if (normalized === "missing fields") return "缺少必填字段";
  if (normalized === "invalid subject") return "学科不合法";
  if (normalized === "textbook requires file source") return "教材仅支持文件来源";
  if (normalized === "missing file content") return "缺少文件内容";
  if (normalized === "missing link") return "缺少链接";
  if (normalized === "missing text content") return "缺少正文内容";
  if (normalized === "duplicate stem skipped") return "题干重复，已跳过";
  if (normalized === "knowledge point id mismatch") return "知识点与题目学科或年级不匹配";
  if (normalized === "knowledge point missing") return "未找到可用知识点";
  if (normalized === "create question failed") return "题目录入失败";
  return reason;
}

function isMissingLibraryItemError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}

function removeFacetCount(
  facets: Array<{ value: string; count: number }>,
  value: string
) {
  return facets.reduce<Array<{ value: string; count: number }>>((acc, item) => {
    if (item.value !== value) {
      acc.push(item);
      return acc;
    }

    if (item.count > 1) {
      acc.push({ ...item, count: item.count - 1 });
    }
    return acc;
  }, []);
}

export function useLibraryPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const [user, setUser] = useState<LibraryUser>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageReady, setPageReady] = useState(false);
  const [bootstrapNotice, setBootstrapNotice] = useState<string | null>(null);
  const [classesNotice, setClassesNotice] = useState<string | null>(null);
  const [listNotice, setListNotice] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [importForm, setImportForm] = useState<LibraryImportFormState>({
    title: "",
    description: "",
    subject: "math",
    grade: "4",
    contentType: "textbook",
    sourceType: "file",
    textContent: "",
    linkUrl: ""
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchPreview, setBatchPreview] = useState<LibraryBatchPreview | null>(null);
  const [batchSummary, setBatchSummary] = useState<BatchImportSummary | null>(null);
  const [batchFailedPreview, setBatchFailedPreview] = useState<string[]>([]);

  const [aiForm, setAiForm] = useState<LibraryAiFormState>({
    classId: "",
    topic: "",
    contentType: "lesson_plan"
  });
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [contentFilter, setContentFilter] =
    useState<LibraryContentFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);
  const [meta, setMeta] = useState<LibraryMeta>(DEFAULT_META);
  const [facets, setFacets] = useState<LibraryFacets>(DEFAULT_FACETS);
  const [summary, setSummary] = useState<LibrarySummary>(DEFAULT_SUMMARY);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const [expandedTypeKeys, setExpandedTypeKeys] = useState<string[]>([]);
  const [libraryViewMode, setLibraryViewMode] =
    useState<LibraryViewMode>("compact");
  const hasListSnapshotRef = useRef(false);
  const listRequestIdRef = useRef(0);

  const applyListPayload = useCallback(
    (payload: LibraryListResponse) => {
      setItems(Array.isArray(payload.data) ? payload.data : []);
      const nextMeta: LibraryMeta = {
        total: Number(payload.meta?.total ?? 0),
        page: Number(payload.meta?.page ?? 1),
        pageSize: Number(payload.meta?.pageSize ?? pageSize),
        totalPages: Number(payload.meta?.totalPages ?? 0),
        hasPrev: Boolean(payload.meta?.hasPrev),
        hasNext: Boolean(payload.meta?.hasNext)
      };
      setMeta(nextMeta);
      setFacets({
        subjects: Array.isArray(payload.facets?.subjects)
          ? payload.facets.subjects
          : [],
        grades: Array.isArray(payload.facets?.grades)
          ? payload.facets.grades
          : [],
        contentTypes: Array.isArray(payload.facets?.contentTypes)
          ? payload.facets.contentTypes
          : []
      });
      setSummary({
        textbookCount: Number(payload.summary?.textbookCount ?? 0),
        coursewareCount: Number(payload.summary?.coursewareCount ?? 0),
        lessonPlanCount: Number(payload.summary?.lessonPlanCount ?? 0)
      });
      if (nextMeta.page !== page) {
        setPage(nextMeta.page);
      }
    },
    [page, pageSize]
  );

  const loadUser = useCallback(async () => {
    try {
      const payload = await requestJson<LibraryAuthResponse>("/api/auth/me");
      setUser(payload.user ?? payload.data ?? null);
      setAuthRequired(false);
      setBootstrapNotice(null);
      return true;
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        return false;
      }

      setUser(null);
      setBootstrapNotice(
        `用户身份同步失败：${getLibraryPageBaseRequestMessage(
          nextError,
          "教师和管理操作面板可能暂时不可用。"
        )}`
      );
      return false;
    }
  }, []);

  const removeItemFromSnapshot = useCallback((item: LibraryItem) => {
    const nextTotal = Math.max(0, meta.total - 1);
    const nextTotalPages =
      nextTotal === 0 ? 0 : Math.ceil(nextTotal / Math.max(meta.pageSize, 1));
    const nextPage =
      nextTotalPages === 0 ? 1 : Math.min(meta.page, nextTotalPages);

    setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    setMeta((prev) => ({
      ...prev,
      total: nextTotal,
      page: nextPage,
      totalPages: nextTotalPages,
      hasPrev: nextTotalPages > 0 && nextPage > 1,
      hasNext: nextTotalPages > 0 && nextPage < nextTotalPages
    }));
    setFacets((prev) => ({
      subjects: removeFacetCount(prev.subjects, item.subject),
      grades: removeFacetCount(prev.grades, item.grade),
      contentTypes: removeFacetCount(prev.contentTypes, item.contentType)
    }));
    setSummary((prev) => ({
      textbookCount: Math.max(
        0,
        prev.textbookCount - (item.contentType === "textbook" ? 1 : 0)
      ),
      coursewareCount: Math.max(
        0,
        prev.coursewareCount - (item.contentType === "courseware" ? 1 : 0)
      ),
      lessonPlanCount: Math.max(
        0,
        prev.lessonPlanCount - (item.contentType === "lesson_plan" ? 1 : 0)
      )
    }));
    if (nextPage !== page) {
      setPage(nextPage);
    }
  }, [meta.page, meta.pageSize, meta.total, page]);

  const loadItems = useCallback(
    async (options?: { noticePrefix?: string }) => {
      const requestId = listRequestIdRef.current + 1;
      listRequestIdRef.current = requestId;
      setLoading(true);
      setPageError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        if (subjectFilter !== "all") {
          params.set("subject", subjectFilter);
        }
        if (contentFilter !== "all") {
          params.set("contentType", contentFilter);
        }
        if (keyword.trim()) {
          params.set("keyword", keyword.trim());
        }

        const payload = await requestJson<LibraryListResponse>(
          `/api/library?${params.toString()}`,
          { cache: "no-store" }
        );

        if (listRequestIdRef.current !== requestId) {
          return false;
        }

        applyListPayload(payload);
        hasListSnapshotRef.current = true;
        setPageReady(true);
        setAuthRequired(false);
        setListNotice(null);
        return true;
      } catch (nextError) {
        if (listRequestIdRef.current !== requestId) {
          return false;
        }

        if (isAuthError(nextError)) {
          setAuthRequired(true);
          return false;
        }

        const nextMessage = getLibraryPageBaseRequestMessage(nextError, "资料加载失败");
        if (hasListSnapshotRef.current) {
          setListNotice(
            options?.noticePrefix
              ? `${options.noticePrefix}：${nextMessage}`
              : `最新资料刷新失败：${nextMessage}`
          );
          return false;
        }

        setPageError(nextMessage);
        return false;
      } finally {
        if (listRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [applyListPayload, contentFilter, keyword, page, pageSize, subjectFilter]
  );

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    let active = true;

    async function loadTeacherClasses() {
      if (user?.role !== "teacher") {
        setClasses([]);
        setClassesNotice(null);
        setAiForm((prev) =>
          prev.classId ? { ...prev, classId: "" } : prev
        );
        return;
      }

      try {
        const payload =
          await requestJson<TeacherClassesResponse>("/api/teacher/classes");
        if (!active) {
          return;
        }
        const nextClasses = Array.isArray(payload.data) ? payload.data : [];
        setClasses(nextClasses);
        setClassesNotice(null);
        setAiForm((prev) => {
          const nextClassId =
            prev.classId &&
            nextClasses.some((item) => item.id === prev.classId)
              ? prev.classId
              : nextClasses[0]?.id ?? "";
          return nextClassId === prev.classId
            ? prev
            : { ...prev, classId: nextClassId };
        });
      } catch (nextError) {
        if (!active) {
          return;
        }
        if (isAuthError(nextError)) {
          setAuthRequired(true);
          return;
        }
        setClasses([]);
        setClassesNotice(
          `班级列表同步失败：${getLibraryPageBaseRequestMessage(
            nextError,
            "暂时无法拉取教师班级。"
          )}`
        );
        setAiForm((prev) =>
          prev.classId ? { ...prev, classId: "" } : prev
        );
      }
    }

    void loadTeacherClasses();
    return () => {
      active = false;
    };
  }, [user?.role]);

  useEffect(() => {
    if (
      importForm.contentType === "textbook" &&
      importForm.sourceType !== "file"
    ) {
      setImportForm((prev) => ({
        ...prev,
        sourceType: "file",
        textContent: "",
        linkUrl: ""
      }));
    }
  }, [importForm.contentType, importForm.sourceType]);

  useEffect(() => {
    setPage(1);
  }, [subjectFilter, contentFilter, keyword, pageSize]);

  const subjectList = useMemo(() => {
    const keys = facets.subjects.map((item) => item.value);
    return keys.slice().sort((left, right) => {
      const leftLabel = SUBJECT_LABELS[left] ?? left;
      const rightLabel = SUBJECT_LABELS[right] ?? right;
      return leftLabel.localeCompare(rightLabel, "zh-CN");
    });
  }, [facets.subjects]);

  const groupedBySubject = useMemo<LibrarySubjectGroup[]>(() => {
    const bucket = new Map<string, LibraryItem[]>();
    items.forEach((item) => {
      const list = bucket.get(item.subject) ?? [];
      list.push(item);
      bucket.set(item.subject, list);
    });

    return Array.from(bucket.entries())
      .map(([subject, list]) => ({
        subject,
        label: SUBJECT_LABELS[subject] ?? subject,
        list: list.sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt)
        ),
        contentGroups: (
          ["textbook", "courseware", "lesson_plan"] as LibraryItem["contentType"][]
        )
          .map((itemContentType) => ({
            contentType: itemContentType,
            label: contentTypeLabel(itemContentType),
            list: list.filter((item) => item.contentType === itemContentType)
          }))
          .filter((group) => group.list.length)
          .sort(
            (left, right) =>
              contentTypeRank(left.contentType) -
              contentTypeRank(right.contentType)
          )
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
  }, [items]);

  useEffect(() => {
    setExpandedSubjects((prev) => {
      const visibleSubjects = new Set(
        groupedBySubject.map((item) => item.subject)
      );
      return prev.filter((item) => visibleSubjects.has(item));
    });
  }, [groupedBySubject]);

  useEffect(() => {
    setExpandedTypeKeys((prev) => {
      const visibleKeys = new Set(
        groupedBySubject.flatMap((group) =>
          group.contentGroups.map(
            (contentGroup) => `${group.subject}:${contentGroup.contentType}`
          )
        )
      );
      return prev.filter((item) => visibleKeys.has(item));
    });
  }, [groupedBySubject]);

  function toggleExpandedSubject(subject: string) {
    setExpandedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((item) => item !== subject)
        : [...prev, subject]
    );
  }

  function toggleExpandedType(typeKey: string) {
    setExpandedTypeKeys((prev) =>
      prev.includes(typeKey)
        ? prev.filter((item) => item !== typeKey)
        : [...prev, typeKey]
    );
  }

  function setAllSubjectsExpanded(expanded: boolean) {
    if (!expanded) {
      setExpandedSubjects([]);
      return;
    }
    setExpandedSubjects(groupedBySubject.map((group) => group.subject));
  }

  function setAllTypesExpanded(expanded: boolean) {
    if (!expanded) {
      setExpandedTypeKeys([]);
      return;
    }
    setExpandedTypeKeys(
      groupedBySubject.flatMap((group) =>
        group.contentGroups.map(
          (contentGroup) => `${group.subject}:${contentGroup.contentType}`
        )
      )
    );
  }

  async function submitImport(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (user?.role !== "admin") return;

    if (
      importForm.contentType === "textbook" &&
      importForm.sourceType !== "file"
    ) {
      setError("教材资源仅支持文件导入");
      return;
    }

    const payload: Record<string, unknown> = { ...importForm };

    if (importForm.sourceType === "file") {
      if (!importFile) {
        setError("请先选择文件");
        return;
      }
      const file = await toBase64(importFile);
      payload.fileName = file.fileName;
      payload.mimeType = file.mimeType;
      payload.size = file.size;
      payload.contentBase64 = file.base64;
      payload.textContent = "";
      payload.linkUrl = "";
    } else if (importForm.sourceType === "link") {
      if (!importForm.linkUrl.trim()) {
        setError("请填写链接");
        return;
      }
      payload.textContent = "";
    } else {
      if (!importForm.textContent.trim()) {
        setError("请填写教材内容");
        return;
      }
      payload.linkUrl = "";
    }

    await runWithStepUp(
      async () => {
        await requestJson("/api/admin/library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setMessage("教材导入成功");
        setImportForm((prev) => ({
          ...prev,
          title: "",
          description: "",
          textContent: "",
          linkUrl: ""
        }));
        setImportFile(null);
        await loadItems({ noticePrefix: "教材已导入，但资料列表刷新失败" });
      },
      (nextError) => {
        if (isAuthError(nextError)) {
          setAuthRequired(true);
          return;
        }
        setError(getLibraryImportRequestMessage(nextError, "导入失败"));
      }
    );
  }

  function downloadBatchTemplate() {
    const blob = new Blob([JSON.stringify(buildBatchImportTemplate(), null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "full-curriculum-batch-template.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function handleBatchFileChange(file?: File | null) {
    setBatchFile(file ?? null);
    setBatchSummary(null);
    setBatchFailedPreview([]);
    if (!file) {
      setBatchPreview(null);
      return;
    }
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setBatchPreview({
        textbooks: Array.isArray(json?.textbooks) ? json.textbooks.length : 0,
        questions: Array.isArray(json?.questions) ? json.questions.length : 0
      });
    } catch {
      setBatchPreview(null);
      setError("批量文件不是合法 JSON");
    }
  }

  async function submitBatchImport(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setBatchSummary(null);
    setBatchFailedPreview([]);
    if (user?.role !== "admin") return;
    if (!batchFile) {
      setError("请先上传批量 JSON 文件");
      return;
    }

    let payload: unknown = null;
    try {
      payload = JSON.parse(await batchFile.text());
    } catch {
      setError("批量文件解析失败，请检查 JSON 格式");
      return;
    }

    await runWithStepUp(
      async () => {
        const data = await requestJson<LibraryBatchImportResponse>(
          "/api/admin/library/batch-import",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }
        );

        const toFailedPreview = (
          items: LibraryBatchImportFailedItem[],
          label: string
        ) =>
          items.map(
            (item) => `${label}#${Number(item.index) + 1}: ${normalizeLibraryBatchFailedReason(item.reason)}`
          );

        const nextSummary = data.data?.summary ?? null;
        const textbookFailed = toFailedPreview(
          data.data?.textbooks?.failed ?? [],
          "教材"
        );
        const questionFailed = toFailedPreview(
          data.data?.questions?.failed ?? [],
          "习题"
        );
        setBatchSummary(nextSummary);
        setBatchFailedPreview(
          [...textbookFailed, ...questionFailed].slice(0, 20)
        );
        setMessage("批量导入完成");
        await loadItems({ noticePrefix: "批量导入已完成，但资料列表刷新失败" });
      },
      (nextError) => {
        if (isAuthError(nextError)) {
          setAuthRequired(true);
          return;
        }
        setError(getLibraryBatchImportRequestMessage(nextError, "批量导入失败"));
      }
    );
  }

  async function submitAiGenerate(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (user?.role !== "teacher") return;
    if (!aiForm.classId || !aiForm.topic.trim()) {
      setError("请先选择班级并填写主题");
      return;
    }

    try {
      const data = await requestJson<LibraryAiGenerateResponse>(
        "/api/teacher/library/ai-generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(aiForm)
        }
      );
      const citationCount = Array.isArray(data.data?.citations)
        ? data.data.citations.length
        : 0;
      const governance = data.data?.citationGovernance;
      const needsManualReview = Boolean(governance?.needsManualReview);
      const reviewHint = needsManualReview
        ? `，建议复核（${String(
            governance?.manualReviewReason ?? "引用可信度风险"
          )}）`
        : "";
      setMessage(
        citationCount
          ? `AI 资料已生成并发布（引用教材片段 ${citationCount} 条${reviewHint}）`
          : `AI 资料已生成并发布${reviewHint}`
      );
      setAiForm((prev) => ({ ...prev, topic: "" }));
      await loadItems({ noticePrefix: "AI 资料已生成，但资料列表刷新失败" });
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        return;
      }
      setError(getLibraryAiGenerateRequestMessage(nextError, "生成失败"));
    }
  }

  async function fetchLibraryItemDetail(item: LibraryItem) {
    try {
      const payload = await requestJson<LibraryDetailResponse>(
        `/api/library/${item.id}`,
        { cache: "no-store" }
      );
      return payload.data ?? null;
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
      } else if (isMissingLibraryItemError(nextError)) {
        removeItemFromSnapshot(item);
        setMessage("资料不存在或已删除");
        await loadItems({ noticePrefix: "资料已从列表移除，但资料列表刷新失败" });
      } else {
        setError(getLibraryPageBaseRequestMessage(nextError, "获取资料详情失败"));
      }
      return null;
    }
  }

  function downloadText(item: LibraryItem) {
    const text = item.textContent ?? "";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${item.title || "资料"}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function downloadItem(item: LibraryItem) {
    if (item.contentType === "textbook" && item.sourceType === "link") {
      setError("教材资源只支持文件，当前外链已禁用");
      return;
    }
    setError(null);
    let detail = item;

    if (item.sourceType === "text" || item.sourceType === "file") {
      const loaded = await fetchLibraryItemDetail(item);
      if (!loaded) return;
      detail = loaded;
    }

    if (detail.sourceType === "text") {
      if (!detail.textContent) {
        setError("文本内容为空或不可用");
        return;
      }
      downloadText(detail);
      return;
    }

    if (detail.sourceType === "file") {
      if (!detail.contentBase64) {
        setError("文件内容不可用，请稍后重试");
        return;
      }
      const href = `data:${detail.mimeType || "application/octet-stream"};base64,${detail.contentBase64}`;
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = detail.fileName || detail.title || "资料";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      return;
    }

    if (detail.linkUrl) {
      window.open(detail.linkUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setError("资料缺少可下载内容");
  }

  async function removeItem(item: LibraryItem) {
    if (user?.role !== "admin") return;
    const confirmed = window.confirm(
      `确认删除「${item.title}」吗？删除后不可恢复。`
    );
    if (!confirmed) return;

    setMessage(null);
    setError(null);
    setDeletingId(item.id);
    try {
      await requestJson<LibraryDeleteResponse>(`/api/library/${item.id}`, {
        method: "DELETE"
      });
      removeItemFromSnapshot(item);
      setMessage("资料已删除");
      await loadItems({ noticePrefix: "资料已删除，但资料列表刷新失败" });
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        return;
      }

      if (getRequestStatus(nextError) === 404) {
        removeItemFromSnapshot(item);
        setMessage("资料不存在或已删除");
        await loadItems({ noticePrefix: "资料已从列表移除，但资料列表刷新失败" });
        return;
      }

      setError(getLibraryPageBaseRequestMessage(nextError, "删除失败"));
    } finally {
      setDeletingId(null);
    }
  }

  const reload = useCallback(async () => {
    setPageError(null);
    setError(null);
    await Promise.allSettled([loadUser(), loadItems()]);
  }, [loadItems, loadUser]);

  return {
    user,
    classes,
    items,
    loading,
    authRequired,
    pageError,
    pageReady,
    bootstrapNotice,
    classesNotice,
    listNotice,
    message,
    error,
    importForm,
    setImportForm,
    setImportFile,
    batchPreview,
    batchSummary,
    batchFailedPreview,
    aiForm,
    setAiForm,
    subjectList,
    facets,
    subjectFilter,
    setSubjectFilter,
    contentFilter,
    setContentFilter,
    keyword,
    setKeyword,
    pageSize,
    setPageSize,
    meta,
    summary,
    deletingId,
    expandedSubjects,
    expandedTypeKeys,
    libraryViewMode,
    setLibraryViewMode,
    groupedBySubject,
    stepUpDialog,
    reload,
    setPage,
    toggleExpandedSubject,
    toggleExpandedType,
    setAllSubjectsExpanded,
    setAllTypesExpanded,
    submitImport,
    downloadBatchTemplate,
    handleBatchFileChange,
    submitBatchImport,
    submitAiGenerate,
    downloadItem,
    removeItem
  };
}
