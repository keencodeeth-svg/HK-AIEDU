"use client";

import type { ComponentProps } from "react";
import { formatLoadedTime } from "@/lib/client-request";
import StudentModuleAssignmentsCard from "./_components/StudentModuleAssignmentsCard";
import StudentModuleOverviewCard from "./_components/StudentModuleOverviewCard";
import StudentModuleResourcesCard from "./_components/StudentModuleResourcesCard";
import StudentModuleStageBanner from "./_components/StudentModuleStageBanner";
import { useStudentModuleDetailPage } from "./useStudentModuleDetailPage";

export function useStudentModuleDetailPageView(moduleId: string) {
  const page = useStudentModuleDetailPage(moduleId);

  const stageBannerProps: ComponentProps<typeof StudentModuleStageBanner> | null = page.data
    ? {
        classroom: page.data.classroom,
        resourceCount: page.resourceCount,
        assignmentCount: page.assignmentCount,
        completedCount: page.completedCount,
        stageCopy: page.stageCopy
      }
    : null;

  const overviewCardProps: ComponentProps<typeof StudentModuleOverviewCard> | null = page.data
    ? {
        classroom: page.data.classroom,
        resourceCount: page.resourceCount,
        fileResourceCount: page.fileResourceCount,
        linkResourceCount: page.linkResourceCount,
        assignmentCount: page.assignmentCount,
        completedCount: page.completedCount,
        pendingCount: page.pendingCount,
        progressPercent: page.progressPercent
      }
    : null;

  const resourcesCardProps: ComponentProps<typeof StudentModuleResourcesCard> | null = page.data
    ? {
        resources: page.data.resources
      }
    : null;

  const assignmentsCardProps: ComponentProps<typeof StudentModuleAssignmentsCard> | null = page.data
    ? {
        assignments: page.data.assignments
      }
    : null;

  return {
    data: page.data,
    authRequired: page.authRequired,
    loading: page.loading,
    refreshing: page.refreshing,
    pageError: page.pageError,
    lastLoadedAtLabel: page.lastLoadedAt ? formatLoadedTime(page.lastLoadedAt) : null,
    stageBannerProps,
    overviewCardProps,
    resourcesCardProps,
    assignmentsCardProps,
    reload: () => {
      void page.loadModule(page.data ? "refresh" : "initial");
    }
  };
}
