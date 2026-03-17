"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { CourseClassSelectorCard } from "./_components/CourseClassSelectorCard";
import { CourseHeader } from "./_components/CourseHeader";
import { CourseSummaryCard } from "./_components/CourseSummaryCard";
import { CourseSyllabusEditorCard } from "./_components/CourseSyllabusEditorCard";
import { CourseSyllabusPreviewCard } from "./_components/CourseSyllabusPreviewCard";
import { useCoursePageView } from "./useCoursePageView";

export default function CoursePage() {
  const {
    loading,
    pageError,
    hasCourseData,
    authRequired,
    canEdit,
    reload,
    headerProps,
    classSelectorCardProps,
    syllabusEditorCardProps,
    syllabusPreviewCardProps,
    summaryCardProps
  } = useCoursePageView();

  if (loading && !authRequired && !hasCourseData) {
    return (
      <StatePanel
        tone="loading"
        title="课程主页加载中"
        description="正在同步班级课程大纲、课程概览和近期学习安排。"
      />
    );
  }

  if (authRequired) {
    return (
      <Card title="课程总览">
        <StatePanel
          compact
          tone="info"
          title="请先登录后查看课程"
          description="登录后即可查看班级课程大纲、课程概览和近期学习安排。"
          action={
            <Link className="button secondary" href="/login">
              去登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (pageError && !hasCourseData) {
    return (
      <StatePanel
        tone="error"
        title="课程主页加载失败"
        description={pageError}
        action={
          <button className="button secondary" type="button" onClick={reload}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <CourseHeader {...headerProps} />

      {pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${pageError}`}
          action={
            <button className="button secondary" type="button" onClick={reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      <CourseClassSelectorCard {...classSelectorCardProps} />

      <div className="grid grid-2">
        {canEdit ? (
          <CourseSyllabusEditorCard {...syllabusEditorCardProps} />
        ) : (
          <Card title="课程大纲" tag="学生/家长">
            <p style={{ color: "var(--ink-1)" }}>老师更新后将同步显示在这里。</p>
          </Card>
        )}

        <CourseSyllabusPreviewCard {...syllabusPreviewCardProps} />
      </div>

      <CourseSummaryCard {...summaryCardProps} />
    </div>
  );
}
