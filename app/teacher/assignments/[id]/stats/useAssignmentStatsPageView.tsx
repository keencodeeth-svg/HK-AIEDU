"use client";

import type { ComponentProps } from "react";
import { ASSIGNMENT_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/constants";
import AssignmentStatsContextCard from "./_components/AssignmentStatsContextCard";
import AssignmentStatsDistributionCard from "./_components/AssignmentStatsDistributionCard";
import AssignmentStatsOverviewCard from "./_components/AssignmentStatsOverviewCard";
import AssignmentStatsQuestionsCard from "./_components/AssignmentStatsQuestionsCard";
import AssignmentStatsValidationLoopCard from "./_components/AssignmentStatsValidationLoopCard";
import type { AssignmentStatsRouteParams } from "./types";
import { formatLoadedTime } from "./utils";
import { useAssignmentStatsPage } from "./useAssignmentStatsPage";

export function useAssignmentStatsPageView(params: AssignmentStatsRouteParams) {
  const page = useAssignmentStatsPage(params);

  const subtitle = page.data
    ? `${page.data.class.name} · ${SUBJECT_LABELS[page.data.class.subject] ?? page.data.class.subject} · ${page.data.class.grade} 年级`
    : "";
  const assignmentTypeLabel = page.data
    ? ASSIGNMENT_TYPE_LABELS[page.data.assignment.submissionType ?? "quiz"]
    : "";
  const loadedTimeLabel = formatLoadedTime(page.lastLoadedAt);

  const validationLoopCardProps: ComponentProps<typeof AssignmentStatsValidationLoopCard> | null =
    page.data
      ? {
          assignmentId: page.id,
          assignment: page.data.assignment,
          summary: page.data.summary,
          distribution: page.data.distribution,
          questionStats: page.data.questionStats,
          now: page.now
        }
      : null;

  const contextCardProps: ComponentProps<typeof AssignmentStatsContextCard> | null = page.data
    ? {
        assignmentId: page.id,
        assignment: page.data.assignment,
        error: page.error,
        onRetry: () => {
          void page.load("refresh");
        }
      }
    : null;

  const overviewCardProps: ComponentProps<typeof AssignmentStatsOverviewCard> | null = page.data
    ? {
        assignmentId: page.id,
        summary: page.data.summary,
        completionRate: page.completionRate,
        lowScoreCount: page.lowScoreCount,
        watchQuestionCount: page.watchQuestionCount
      }
    : null;

  const distributionCardProps: ComponentProps<typeof AssignmentStatsDistributionCard> | null = page.data
    ? {
        distribution: page.data.distribution,
        maxCount: page.maxCount
      }
    : null;

  const questionsCardProps: ComponentProps<typeof AssignmentStatsQuestionsCard> | null = page.data
    ? {
        questionStats: page.data.questionStats
      }
    : null;

  return {
    data: page.data,
    authRequired: page.authRequired,
    error: page.error,
    loading: page.loading,
    refreshing: page.refreshing,
    subtitle,
    assignmentTypeLabel,
    dueRelativeLabel: page.dueRelativeLabel,
    completionRate: page.completionRate,
    loadedTimeLabel,
    onRefresh: () => {
      void page.load("refresh");
    },
    validationLoopCardProps,
    contextCardProps,
    overviewCardProps,
    distributionCardProps,
    questionsCardProps
  };
}
