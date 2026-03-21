"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useAnnouncementsPage } from "./useAnnouncementsPage";

export default function AnnouncementsPage() {
  const {
    announcements,
    userRole,
    classes,
    classId,
    title,
    content,
    message,
    submitError,
    pageError,
    classesError,
    pageLoading,
    submitting,
    classesLoading,
    authRequired,
    hasPageData,
    lastLoadedAtLabel,
    canSubmit,
    loadAnnouncements,
    loadTeacherClasses,
    loadPage,
    updateClassId,
    updateTitle,
    updateContent,
    handleSubmit
  } = useAnnouncementsPage();

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
          {lastLoadedAtLabel ? <span className="chip">更新于 {lastLoadedAtLabel}</span> : null}
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
              <button className="button primary" type="submit" disabled={submitting || !canSubmit}>
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
