"use client";

import type { ComponentProps } from "react";
import { CourseClassSelectorCard } from "./_components/CourseClassSelectorCard";
import { CourseHeader } from "./_components/CourseHeader";
import { CourseSummaryCard } from "./_components/CourseSummaryCard";
import { CourseSyllabusEditorCard } from "./_components/CourseSyllabusEditorCard";
import { CourseSyllabusPreviewCard } from "./_components/CourseSyllabusPreviewCard";
import { useCoursePage } from "./useCoursePage";

export function useCoursePageView() {
  const page = useCoursePage();

  const headerProps: ComponentProps<typeof CourseHeader> = {
    lastLoadedAt: page.lastLoadedAt,
    refreshing: page.refreshing,
    onRefresh: () => {
      void page.refreshCourse();
    }
  };

  const classSelectorCardProps: ComponentProps<typeof CourseClassSelectorCard> = {
    classes: page.classes,
    classId: page.classId,
    onClassChange: (nextClassId) => {
      void page.setClassId(nextClassId);
    }
  };

  const syllabusEditorCardProps: ComponentProps<typeof CourseSyllabusEditorCard> = {
    form: page.form,
    error: page.error,
    message: page.message,
    saving: page.saving,
    hasSelectedClass: Boolean(page.classId),
    onFieldChange: page.handleFormChange,
    onSave: () => {
      void page.handleSave();
    }
  };

  const syllabusPreviewCardProps: ComponentProps<typeof CourseSyllabusPreviewCard> = {
    currentClass: page.currentClass,
    syllabus: page.syllabus
  };

  const summaryCardProps: ComponentProps<typeof CourseSummaryCard> = {
    summary: page.summary
  };

  return {
    loading: page.loading,
    refreshing: page.refreshing,
    pageError: page.pageError,
    hasCourseData: page.hasCourseData,
    authRequired: page.authRequired,
    canEdit: page.canEdit,
    reload: () => {
      void page.refreshCourse();
    },
    headerProps,
    classSelectorCardProps,
    syllabusEditorCardProps,
    syllabusPreviewCardProps,
    summaryCardProps
  };
}
