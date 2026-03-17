"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { formatLoadedTime, isAuthError, requestJson } from "@/lib/client-request";
import type {
  AnnouncementClassListResponse,
  AnnouncementClassOption,
  AnnouncementItem,
  AnnouncementListResponse,
  AnnouncementSubmitResponse,
  AuthMeResponse,
  AppUserRole
} from "./types";
import {
  getAnnouncementClassListRequestMessage,
  getAnnouncementsListRequestMessage,
  getAnnouncementSubmitRequestMessage,
  isMissingAnnouncementClassError,
  resolveAnnouncementClassId
} from "./utils";

type LoadStatus = "loaded" | "auth" | "error" | "stale";

export default function AnnouncementsPage() {
  const bootstrapRequestIdRef = useRef(0);
  const announcementsRequestIdRef = useRef(0);
  const classesRequestIdRef = useRef(0);
  const hasAnnouncementsSnapshotRef = useRef(false);
  const hasClassesSnapshotRef = useRef(false);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [userRole, setUserRole] = useState<AppUserRole>(null);
  const [classes, setClasses] = useState<AnnouncementClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearSubmitNotice = useCallback(() => {
    setMessage(null);
    setSubmitError(null);
  }, []);

  const clearAnnouncementsState = useCallback(() => {
    hasAnnouncementsSnapshotRef.current = false;
    setAnnouncements([]);
  }, []);

  const clearClassesState = useCallback(() => {
    hasClassesSnapshotRef.current = false;
    setClasses([]);
    setClassId("");
    setClassesError(null);
    setClassesLoading(false);
  }, []);

  const clearPageState = useCallback(() => {
    clearAnnouncementsState();
    clearClassesState();
    clearSubmitNotice();
    setUserRole(null);
    setPageError(null);
    setLastLoadedAt(null);
  }, [clearAnnouncementsState, clearClassesState, clearSubmitNotice]);

  const handleAuthRequired = useCallback(() => {
    bootstrapRequestIdRef.current += 1;
    announcementsRequestIdRef.current += 1;
    classesRequestIdRef.current += 1;
    clearPageState();
    setPageLoading(false);
    setSubmitting(false);
    setAuthRequired(true);
  }, [clearPageState]);

  const loadAnnouncements = useCallback(async (): Promise<LoadStatus> => {
    const requestId = announcementsRequestIdRef.current + 1;
    announcementsRequestIdRef.current = requestId;
    setPageError(null);

    try {
      const payload = await requestJson<AnnouncementListResponse>("/api/announcements");
      if (announcementsRequestIdRef.current !== requestId) {
        return "stale";
      }

      hasAnnouncementsSnapshotRef.current = true;
      setAnnouncements(payload.data ?? []);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
      return "loaded";
    } catch (error) {
      if (announcementsRequestIdRef.current !== requestId) {
        return "stale";
      }

      if (isAuthError(error)) {
        handleAuthRequired();
        return "auth";
      }

      if (!hasAnnouncementsSnapshotRef.current) {
        clearAnnouncementsState();
      }
      setAuthRequired(false);
      setPageError(getAnnouncementsListRequestMessage(error, "加载公告列表失败"));
      return "error";
    }
  }, [clearAnnouncementsState, handleAuthRequired]);

  const loadTeacherClasses = useCallback(async (): Promise<LoadStatus> => {
    const requestId = classesRequestIdRef.current + 1;
    classesRequestIdRef.current = requestId;
    setClassesLoading(true);
    setClassesError(null);

    try {
      const payload = await requestJson<AnnouncementClassListResponse>("/api/teacher/classes");
      if (classesRequestIdRef.current !== requestId) {
        return "stale";
      }

      const nextClasses = payload.data ?? [];
      hasClassesSnapshotRef.current = true;
      setClasses(nextClasses);
      setClassId((currentClassId) => resolveAnnouncementClassId(nextClasses, currentClassId));
      setAuthRequired(false);
      return "loaded";
    } catch (error) {
      if (classesRequestIdRef.current !== requestId) {
        return "stale";
      }

      if (isAuthError(error)) {
        handleAuthRequired();
        return "auth";
      }

      if (!hasClassesSnapshotRef.current) {
        clearClassesState();
      }
      setAuthRequired(false);
      setClassesError(getAnnouncementClassListRequestMessage(error, "加载教师班级失败"));
      return "error";
    } finally {
      if (classesRequestIdRef.current === requestId) {
        setClassesLoading(false);
      }
    }
  }, [clearClassesState, handleAuthRequired]);

  const loadPage = useCallback(async () => {
    const requestId = bootstrapRequestIdRef.current + 1;
    bootstrapRequestIdRef.current = requestId;
    setPageLoading(true);
    setPageError(null);

    try {
      const [authResult, announcementsResult] = await Promise.allSettled([
        requestJson<AuthMeResponse>("/api/auth/me"),
        requestJson<AnnouncementListResponse>("/api/announcements")
      ]);

      if (bootstrapRequestIdRef.current !== requestId) {
        return;
      }

      const authFailed =
        (authResult.status === "rejected" && isAuthError(authResult.reason)) ||
        (announcementsResult.status === "rejected" && isAuthError(announcementsResult.reason));
      if (authFailed) {
        handleAuthRequired();
        return;
      }

      if (authResult.status === "fulfilled") {
        setUserRole(authResult.value.user?.role ?? null);
      } else {
        clearPageState();
        setAuthRequired(false);
        setPageError(getAnnouncementsListRequestMessage(authResult.reason, "加载公告页失败"));
        return;
      }

      if (announcementsResult.status === "fulfilled") {
        hasAnnouncementsSnapshotRef.current = true;
        setAnnouncements(announcementsResult.value.data ?? []);
        setLastLoadedAt(new Date().toISOString());
      } else {
        if (!hasAnnouncementsSnapshotRef.current) {
          clearAnnouncementsState();
        }
        setPageError(getAnnouncementsListRequestMessage(announcementsResult.reason, "加载公告列表失败"));
      }

      const nextRole = authResult.value.user?.role ?? null;
      setAuthRequired(false);
      if (nextRole === "teacher") {
        void loadTeacherClasses();
      } else {
        classesRequestIdRef.current += 1;
        clearClassesState();
      }
    } catch (error) {
      if (bootstrapRequestIdRef.current !== requestId) {
        return;
      }

      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        clearPageState();
        setAuthRequired(false);
        setPageError(getAnnouncementsListRequestMessage(error, "加载公告页失败"));
      }
    } finally {
      if (bootstrapRequestIdRef.current === requestId) {
        setPageLoading(false);
      }
    }
  }, [clearAnnouncementsState, clearClassesState, clearPageState, handleAuthRequired, loadTeacherClasses]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const updateClassId = useCallback(
    (value: string) => {
      clearSubmitNotice();
      setClassId(value);
    },
    [clearSubmitNotice]
  );

  const updateTitle = useCallback(
    (value: string) => {
      clearSubmitNotice();
      setTitle(value);
    },
    [clearSubmitNotice]
  );

  const updateContent = useCallback(
    (value: string) => {
      clearSubmitNotice();
      setContent(value);
    },
    [clearSubmitNotice]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    clearSubmitNotice();

    try {
      await requestJson<AnnouncementSubmitResponse>("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, title, content })
      });
      setTitle("");
      setContent("");

      const loadStatus = await loadAnnouncements();
      if (loadStatus === "auth") {
        return;
      }
      if (loadStatus === "loaded") {
        setMessage("公告已发布。");
      } else if (loadStatus === "stale") {
        setMessage("公告已发布，系统正在同步最新公告。");
      } else {
        setMessage("公告已发布，但公告列表刷新失败，请稍后重试。");
      }
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        if (isMissingAnnouncementClassError(error)) {
          const classStatus = await loadTeacherClasses();
          if (classStatus === "auth") {
            return;
          }
        }
        setSubmitError(getAnnouncementSubmitRequestMessage(error, "发布失败"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const hasPageData = Boolean(announcements.length || userRole === "teacher" || classes.length);

  if (pageLoading && !hasPageData && !authRequired) {
    return <StatePanel title="公告中心加载中" description="正在同步账号身份、公告列表与教师班级。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录可访问公告的账号"
        description="教师、学生或家长登录后即可查看班级公告；教师登录后还可发布公告。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (pageError && !hasPageData) {
    return (
      <StatePanel
        title="公告中心加载失败"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadPage()}>
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
          <h2>班级公告</h2>
          <div className="section-sub">发布课程提醒与班级通知。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">公告</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
        </div>
      </div>

      {pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新同步失败：${pageError}`}
          action={
            <button
              className="button secondary"
              type="button"
              onClick={() => void loadAnnouncements().catch(() => undefined)}
              disabled={pageLoading || submitting}
            >
              重试列表加载
            </button>
          }
        />
      ) : null}

      {userRole === "teacher" ? (
        <Card title="发布公告" tag="教师">
          <div className="feature-card">
            <EduIcon name="board" />
            <p>向班级学生与家长同步重要通知。</p>
          </div>
          {classesLoading ? (
            <StatePanel title="教师班级加载中" description="正在同步你可发布公告的班级。" tone="loading" compact />
          ) : classesError ? (
            <StatePanel
              title="教师班级加载失败"
              description={classesError}
              tone="error"
              compact
              action={
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void loadTeacherClasses()}
                  disabled={pageLoading || submitting}
                >
                  重试班级加载
                </button>
              }
            />
          ) : classes.length === 0 ? (
            <p>暂无班级，请先在教师端创建班级。</p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
              <label>
                <div className="section-title">选择班级</div>
                <select
                  value={classId}
                  onChange={(event) => updateClassId(event.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div className="section-title">公告标题</div>
                <input
                  value={title}
                  onChange={(event) => updateTitle(event.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
              <label>
                <div className="section-title">公告内容</div>
                <textarea
                  value={content}
                  onChange={(event) => updateContent(event.target.value)}
                  rows={4}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
              {submitError ? <div className="status-note error">{submitError}</div> : null}
              {message ? <div className="status-note success">{message}</div> : null}
              <button className="button primary" type="submit" disabled={submitting || !classId || !title.trim() || !content.trim()}>
                {submitting ? "发布中..." : "发布公告"}
              </button>
            </form>
          )}
        </Card>
      ) : null}

      <Card title="公告列表" tag="最新">
        {announcements.length ? (
          <div className="grid" style={{ gap: 12 }}>
            {announcements.map((item) => (
              <div className="card" key={item.id}>
                <div className="card-header">
                  <div className="section-title">{item.title}</div>
                  <span className="card-tag">{new Date(item.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
                <div className="section-sub">
                  {item.className ?? "-"} · {SUBJECT_LABELS[item.classSubject ?? ""] ?? item.classSubject ?? "-"} ·{" "}
                  {item.classGrade ?? "-"} 年级
                </div>
                <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{item.content}</p>
              </div>
            ))}
          </div>
        ) : pageError ? (
          <StatePanel
            title="公告列表暂时不可用"
            description={pageError}
            tone="error"
            action={
              <button
                className="button secondary"
                type="button"
                onClick={() => void loadAnnouncements().catch(() => undefined)}
                disabled={pageLoading || submitting}
              >
                重新加载
              </button>
            }
          />
        ) : (
          <p>暂无公告。</p>
        )}
      </Card>
    </div>
  );
}
