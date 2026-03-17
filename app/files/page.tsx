"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { formatLoadedTime, isAuthError, requestJson } from "@/lib/client-request";
import {
  getFilesBootstrapRequestMessage,
  getFilesListRequestMessage,
  getFilesSubmitRequestMessage,
  isMissingFilesClassError,
  resolveFilesClassId
} from "./utils";

type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

type CourseFile = {
  id: string;
  classId: string;
  folder?: string;
  title: string;
  resourceType: "file" | "link";
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
  linkUrl?: string;
  createdAt: string;
};

type AuthMeResponse = {
  user?: {
    role?: string | null;
  } | null;
};

type ClassListResponse = {
  data?: ClassItem[];
};

type FilesListResponse = {
  data?: CourseFile[];
};

type FileMutationResponse = {
  data?: CourseFile | CourseFile[];
};

type FilesLoadResult = {
  errorMessage: string | null;
  hasSuccess: boolean;
  status: "auth" | "empty" | "error" | "loaded" | "stale";
};

export default function FilesPage() {
  const bootstrapRequestIdRef = useRef(0);
  const filesRequestIdRef = useRef(0);
  const classIdRef = useRef("");
  const classesRef = useRef<ClassItem[]>([]);
  const hasRoleSnapshotRef = useRef(false);
  const hasClassesSnapshotRef = useRef(false);
  const hasFilesSnapshotRef = useRef(false);
  const filesSnapshotClassIdRef = useRef("");
  const previousClassIdRef = useRef("");
  const [role, setRole] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [folder, setFolder] = useState("");
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [resourceType, setResourceType] = useState<"file" | "link">("file");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    classIdRef.current = classId;
  }, [classId]);

  useEffect(() => {
    classesRef.current = classes;
  }, [classes]);

  const applyClasses = useCallback((nextClasses: ClassItem[], preferredClassId = classIdRef.current) => {
    classesRef.current = nextClasses;
    setClasses(nextClasses);
    const nextClassId = resolveFilesClassId(nextClasses, preferredClassId);
    classIdRef.current = nextClassId;
    setClassId(nextClassId);
    return nextClassId;
  }, []);

  const clearFilesState = useCallback(() => {
    hasFilesSnapshotRef.current = false;
    filesSnapshotClassIdRef.current = "";
    setFiles([]);
  }, []);

  const clearClassesState = useCallback(() => {
    hasClassesSnapshotRef.current = false;
    applyClasses([], "");
  }, [applyClasses]);

  const clearBootstrapState = useCallback(() => {
    hasRoleSnapshotRef.current = false;
    setRole(null);
    clearClassesState();
  }, [clearClassesState]);

  const clearFilesPageState = useCallback(() => {
    clearBootstrapState();
    clearFilesState();
    setMessage(null);
    setError(null);
    setPageError(null);
    setLastLoadedAt(null);
  }, [clearBootstrapState, clearFilesState]);

  const handleAuthRequired = useCallback(() => {
    bootstrapRequestIdRef.current += 1;
    filesRequestIdRef.current += 1;
    clearFilesPageState();
    setLoading(false);
    setFilesLoading(false);
    setAuthRequired(true);
  }, [clearFilesPageState]);

  const loadBootstrap = useCallback(async (): Promise<FilesLoadResult> => {
    const requestId = bootstrapRequestIdRef.current + 1;
    bootstrapRequestIdRef.current = requestId;
    setLoading(true);
    setPageError(null);

    try {
      const [authResult, classesResult] = await Promise.allSettled([
        requestJson<AuthMeResponse>("/api/auth/me"),
        requestJson<ClassListResponse>("/api/classes")
      ]);

      if (bootstrapRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }

      const authFailure = [authResult, classesResult].some(
        (result) => result.status === "rejected" && isAuthError(result.reason)
      );

      if (authFailure) {
        handleAuthRequired();
        return { status: "auth", errorMessage: null, hasSuccess: false };
      }

      let hasSuccess = false;
      const nextErrors: string[] = [];

      if (authResult.status === "fulfilled") {
        hasRoleSnapshotRef.current = true;
        setRole(authResult.value.user?.role ?? null);
        hasSuccess = true;
      } else {
        if (!hasRoleSnapshotRef.current) {
          setRole(null);
        }
        nextErrors.push(
          `账号信息加载失败：${getFilesBootstrapRequestMessage(authResult.reason, "加载账号信息失败")}`
        );
      }

      if (classesResult.status === "fulfilled") {
        hasClassesSnapshotRef.current = true;
        const nextClassId = applyClasses(classesResult.value.data ?? []);
        if (!nextClassId) {
          clearFilesState();
        }
        hasSuccess = true;
      } else {
        if (!hasClassesSnapshotRef.current) {
          clearClassesState();
          clearFilesState();
        }
        nextErrors.push(
          `班级列表加载失败：${getFilesBootstrapRequestMessage(classesResult.reason, "加载班级列表失败")}`
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
    } catch (nextError) {
      if (bootstrapRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return { status: "auth", errorMessage: null, hasSuccess: false };
      }

      if (!hasRoleSnapshotRef.current) {
        setRole(null);
      }
      if (!hasClassesSnapshotRef.current) {
        clearClassesState();
        clearFilesState();
      }

      const errorMessage = getFilesBootstrapRequestMessage(nextError, "加载课程文件中心失败");
      setAuthRequired(false);
      setPageError(errorMessage);
      return {
        status: "error",
        errorMessage,
        hasSuccess: hasRoleSnapshotRef.current || hasClassesSnapshotRef.current
      };
    } finally {
      if (bootstrapRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [applyClasses, clearClassesState, clearFilesState, handleAuthRequired]);

  const loadFiles = useCallback(async (
    selectedClassId: string,
    options?: { clearBeforeLoad?: boolean; clearError?: boolean; preserveSnapshot?: boolean }
  ): Promise<FilesLoadResult> => {
    if (!selectedClassId) {
      clearFilesState();
      setFilesLoading(false);
      return { status: "empty", errorMessage: null, hasSuccess: false };
    }

    const requestId = filesRequestIdRef.current + 1;
    filesRequestIdRef.current = requestId;
    setFilesLoading(true);
    if (options?.clearBeforeLoad) {
      setFiles([]);
    }
    if (options?.clearError !== false) {
      setPageError(null);
    }

    try {
      const payload = await requestJson<FilesListResponse>(`/api/files?classId=${encodeURIComponent(selectedClassId)}`);
      if (filesRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }
      hasFilesSnapshotRef.current = true;
      filesSnapshotClassIdRef.current = selectedClassId;
      setFiles(payload.data ?? []);
      setPageError(null);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
      return { status: "loaded", errorMessage: null, hasSuccess: true };
    } catch (nextError) {
      if (filesRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return { status: "auth", errorMessage: null, hasSuccess: false };
      }

      const preserveSnapshot =
        options?.preserveSnapshot === true && filesSnapshotClassIdRef.current === selectedClassId;

      if (isMissingFilesClassError(nextError)) {
        const nextClasses = classesRef.current.filter((item) => item.id !== selectedClassId);
        const nextPreferredClassId = classIdRef.current === selectedClassId ? "" : classIdRef.current;
        const nextClassId = applyClasses(nextClasses, nextPreferredClassId);
        if (!nextClassId) {
          clearFilesState();
        } else {
          hasFilesSnapshotRef.current = false;
          filesSnapshotClassIdRef.current = "";
          setFiles([]);
        }
      } else if (!preserveSnapshot || !hasFilesSnapshotRef.current) {
        clearFilesState();
      }

      const errorMessage = getFilesListRequestMessage(nextError, "加载课程资料失败");
      setAuthRequired(false);
      setPageError(errorMessage);
      return {
        status: "error",
        errorMessage,
        hasSuccess: preserveSnapshot && hasFilesSnapshotRef.current
      };
    } finally {
      if (filesRequestIdRef.current === requestId) {
        setFilesLoading(false);
      }
    }
  }, [applyClasses, clearFilesState, handleAuthRequired]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    const previousClassId = previousClassIdRef.current;
    previousClassIdRef.current = classId;

    if (!classId) {
      clearFilesState();
      setFilesLoading(false);
      return;
    }

    const switchingClass = previousClassId.length > 0 && previousClassId !== classId;
    setMessage(null);
    setError(null);
    void loadFiles(classId, {
      clearBeforeLoad: switchingClass,
      preserveSnapshot: !switchingClass
    });
  }, [classId, clearFilesState, loadFiles]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId) {
      setError("请先选择班级后再上传资料。");
      return;
    }
    const uploadMode = resourceType;
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      if (uploadMode === "link") {
        await requestJson<FileMutationResponse>("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId, folder, title, resourceType: "link", linkUrl })
        });
        setMessage("链接已添加");
        setTitle("");
        setLinkUrl("");
        setFolder("");
      } else {
        const formData = new FormData();
        formData.append("classId", classId);
        if (folder) formData.append("folder", folder);
        if (title) formData.append("title", title);

        const input = fileInputRef.current;
        if (!input?.files?.length) {
          setError("请选择文件");
          return;
        }
        Array.from(input.files).forEach((file) => formData.append("files", file));

        await requestJson<FileMutationResponse>("/api/files", { method: "POST", body: formData });
        setMessage("文件已上传");
        setTitle("");
        setFolder("");
        input.value = "";
      }

      const refreshResult = await loadFiles(classId, {
        clearError: false,
        preserveSnapshot: true
      });
      if (refreshResult.status === "error") {
        setMessage(
          uploadMode === "link"
            ? "链接已添加，但资料列表刷新失败，请稍后重试。"
            : "文件已上传，但资料列表刷新失败，请稍后重试。"
        );
      }
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        setError(getFilesSubmitRequestMessage(nextError, uploadMode === "link" ? "保存链接失败" : "上传失败", uploadMode));
        if (isMissingFilesClassError(nextError)) {
          clearFilesState();
          await loadBootstrap();
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = files.reduce<Record<string, CourseFile[]>>((acc, file) => {
    const key = file.folder?.trim() || "默认";
    if (!acc[key]) acc[key] = [];
    acc[key].push(file);
    return acc;
  }, {});

  if (loading && !classes.length && !authRequired) {
    return <StatePanel title="课程文件中心加载中" description="正在同步账号身份、班级列表和课程资料。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录后查看课程文件"
        description="登录后即可查看你有权限访问的课程资料；教师登录后还可上传文件与添加链接。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (pageError && !classes.length) {
    return (
      <StatePanel
        title="课程文件中心加载失败"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadBootstrap()}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>课程文件中心</h2>
          <div className="section-sub">统一管理课程资料、课件与链接。</div>
        </div>
        <span className="chip">{lastLoadedAt ? `更新于 ${formatLoadedTime(lastLoadedAt)}` : "文件"}</span>
      </div>

      {pageError ? (
        <StatePanel
          title="本次资料刷新存在异常"
          description={pageError}
          tone="error"
          compact
          action={
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                if (classId) {
                  void loadFiles(classId).catch(() => undefined);
                  return;
                }
                void loadBootstrap();
              }}
              disabled={loading || filesLoading || submitting}
            >
              {classId ? "重试资料加载" : "重试页面加载"}
            </button>
          }
        />
      ) : null}

      <Card title="班级选择" tag="课程">
        {classes.length ? (
          <label>
            <div className="section-title">选择班级</div>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p>暂无班级。</p>
        )}
      </Card>

      {role === "teacher" ? (
        <Card title="上传资料 / 添加链接" tag="教师">
          <div className="feature-card">
            <EduIcon name="book" />
            <p>支持上传 PDF/图片，或添加外部链接。</p>
          </div>
          {classes.length === 0 ? (
            <p>暂无可上传资料的班级，请先创建或加入班级。</p>
          ) : (
            <form onSubmit={handleUpload} style={{ display: "grid", gap: 12 }}>
              <label>
                <div className="section-title">资料类型</div>
                <select
                  value={resourceType}
                  onChange={(event) => setResourceType(event.target.value as "file" | "link")}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  <option value="file">上传文件</option>
                  <option value="link">添加链接</option>
                </select>
              </label>
              <label>
                <div className="section-title">文件夹（可选）</div>
                <input
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                  placeholder="如：第一单元/课件"
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
              <label>
                <div className="section-title">标题</div>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="如：分数单元讲义"
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
              {resourceType === "link" ? (
                <label>
                  <div className="section-title">链接地址</div>
                  <input
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    placeholder="https://..."
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                  />
                </label>
              ) : (
                <label>
                  <div className="section-title">选择文件</div>
                  <input ref={fileInputRef} id="fileInput" type="file" multiple />
                </label>
              )}
              {error ? <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div> : null}
              {message ? <div style={{ color: "#027a48", fontSize: 13 }}>{message}</div> : null}
              <button className="button primary" type="submit" disabled={submitting || !classId}>
                {submitting ? "提交中..." : resourceType === "link" ? "保存链接" : "上传文件"}
              </button>
            </form>
          )}
        </Card>
      ) : null}

      <Card title="资料列表" tag="资源">
        {filesLoading && !files.length ? (
          <StatePanel title="资料加载中" description="正在同步当前班级的文件与链接资源。" tone="loading" />
        ) : files.length ? (
          <div className="grid" style={{ gap: 12 }}>
            {Object.entries(grouped).map(([folderName, items]) => (
              <div key={folderName} className="card">
                <div className="section-title">{folderName}</div>
                <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                  {items.map((item) => (
                    <div key={item.id} className="card">
                      <div className="section-title">{item.title}</div>
                      <div className="section-sub">
                        {new Date(item.createdAt).toLocaleDateString("zh-CN")} ·{" "}
                        {item.resourceType === "link" ? "链接" : item.mimeType ?? "文件"}
                      </div>
                      {item.resourceType === "link" && item.linkUrl ? (
                        <a href={item.linkUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                          打开链接
                        </a>
                      ) : item.contentBase64 && item.mimeType ? (
                        <a
                          href={`data:${item.mimeType};base64,${item.contentBase64}`}
                          download={item.fileName ?? item.title}
                          style={{ fontSize: 13 }}
                        >
                          下载文件
                        </a>
                      ) : (
                        <div style={{ fontSize: 12, color: "var(--ink-1)" }}>无可用资源</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : pageError && classId ? (
          <StatePanel
            title="资料列表暂时不可用"
            description={pageError}
            tone="error"
            action={
              <button
                className="button secondary"
                type="button"
                onClick={() => void loadFiles(classId).catch(() => undefined)}
                disabled={filesLoading || submitting}
              >
                重新加载
              </button>
            }
          />
        ) : classId ? (
          <p>暂无资料。</p>
        ) : (
          <p>暂无可查看的班级资料。</p>
        )}
      </Card>
    </div>
  );
}
