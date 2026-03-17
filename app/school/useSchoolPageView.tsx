"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import WorkspacePage, { buildStaleDataNotice } from "@/components/WorkspacePage";
import type { SchoolOverview } from "@/lib/school-admin-types";
import { SchoolAttentionClassesCard } from "./_components/SchoolAttentionClassesCard";
import { SchoolClassSnapshotCard } from "./_components/SchoolClassSnapshotCard";
import { SchoolDashboardOverviewCard } from "./_components/SchoolDashboardOverviewCard";
import { SchoolHealthMetricsCard } from "./_components/SchoolHealthMetricsCard";
import { SchoolMemberSnapshotCard } from "./_components/SchoolMemberSnapshotCard";
import { SchoolPriorityActionsCard } from "./_components/SchoolPriorityActionsCard";
import { useSchoolPage } from "./useSchoolPage";

export function useSchoolPageView() {
  const page = useSchoolPage();
  const overview = page.overview as SchoolOverview | null;

  const workspacePageProps: Omit<ComponentProps<typeof WorkspacePage>, "children"> = {
    title: "学校控制台",
    subtitle: "统一查看学校组织运行、班级执行、课程表覆盖与成员状态，并给出优先整改动作。",
    lastLoadedAt: page.lastLoadedAt,
    chips: [
      <span key="school-admin" className="chip">
        School Admin
      </span>
    ],
    actions: (
      <>
        <Link className="button ghost" href="/school/schedules">
          课程表管理
        </Link>
        <button
          className="button secondary"
          type="button"
          onClick={() => void page.loadAll("refresh")}
          disabled={page.loading || page.refreshing}
        >
          {page.refreshing ? "刷新中..." : "刷新"}
        </button>
      </>
    ),
    notices: page.pageError
      ? [
          buildStaleDataNotice(
            page.pageError,
            <button className="button secondary" type="button" onClick={() => void page.loadAll("refresh")}>
              再试一次
            </button>
          )
        ]
      : undefined
  };

  const overviewCardProps: ComponentProps<typeof SchoolDashboardOverviewCard> = {
    overview: overview as SchoolOverview
  };

  const healthMetricsCardProps: ComponentProps<typeof SchoolHealthMetricsCard> = {
    overview: overview as SchoolOverview
  };

  const priorityActionsCardProps: ComponentProps<typeof SchoolPriorityActionsCard> = {
    actionItems: overview?.actionItems ?? []
  };

  const attentionClassesCardProps: ComponentProps<typeof SchoolAttentionClassesCard> = {
    attentionClasses: overview?.attentionClasses ?? []
  };

  const classSnapshotCardProps: ComponentProps<typeof SchoolClassSnapshotCard> = {
    classPreview: page.classPreview
  };

  const memberSnapshotCardProps: ComponentProps<typeof SchoolMemberSnapshotCard> = {
    teacherPreview: page.teacherPreview,
    studentPreview: page.studentPreview
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    hasOverview: Boolean(page.overview),
    pageError: page.pageError,
    reload: () => {
      void page.loadAll("refresh");
    },
    workspacePageProps,
    overviewCardProps,
    healthMetricsCardProps,
    priorityActionsCardProps,
    attentionClassesCardProps,
    classSnapshotCardProps,
    memberSnapshotCardProps
  };
}
