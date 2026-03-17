"use client";

import type { ComponentProps } from "react";
import StudentPortraitActionCard from "./_components/StudentPortraitActionCard";
import StudentPortraitHeader from "./_components/StudentPortraitHeader";
import StudentPortraitOverviewCard from "./_components/StudentPortraitOverviewCard";
import StudentPortraitRadarCard from "./_components/StudentPortraitRadarCard";
import StudentPortraitRecentTutorCard from "./_components/StudentPortraitRecentTutorCard";
import StudentPortraitStageBanner from "./_components/StudentPortraitStageBanner";
import StudentPortraitSubjectMasteryCard from "./_components/StudentPortraitSubjectMasteryCard";
import StudentPortraitWeakPointsCard from "./_components/StudentPortraitWeakPointsCard";
import { useStudentPortraitPage } from "./useStudentPortraitPage";

export function useStudentPortraitPageView() {
  const page = useStudentPortraitPage();

  const headerProps: ComponentProps<typeof StudentPortraitHeader> = {
    abilityCount: page.portraitAbilities.length,
    trackedKnowledgePointCount: page.trackedKnowledgePoints,
    weakKnowledgePointCount: page.weakKnowledgePointCount,
    lastLoadedAt: page.lastLoadedAt,
    refreshing: page.refreshing,
    onRefresh: () => {
      void page.refreshPortrait();
    }
  };

  const stageBannerProps: ComponentProps<typeof StudentPortraitStageBanner> = {
    stageCopy: page.stageCopy,
    averageMasteryScore: page.mastery?.averageMasteryScore ?? 0,
    averageConfidenceScore: page.mastery?.averageConfidenceScore ?? 0,
    averageTrend7d: page.mastery?.averageTrend7d ?? 0,
    lowestAbilityLabel: page.lowestAbility?.label
  };

  const actionCardProps: ComponentProps<typeof StudentPortraitActionCard> = {
    actionPlan: page.portraitActionPlan
  };

  const recentTutorCardProps: ComponentProps<typeof StudentPortraitRecentTutorCard> | null =
    page.recentStudyVariantActivity && page.recentStudyVariantSummary
      ? {
          activity: page.recentStudyVariantActivity,
          summary: page.recentStudyVariantSummary,
          practiceHref: page.recentStudyPracticeHref,
          tutorHref: page.recentStudyTutorHref
        }
      : null;

  const overviewCardProps: ComponentProps<typeof StudentPortraitOverviewCard> = {
    abilityCount: page.portraitAbilities.length,
    averageMasteryScore: page.mastery?.averageMasteryScore ?? 0,
    averageConfidenceScore: page.mastery?.averageConfidenceScore ?? 0,
    averageTrend7d: page.mastery?.averageTrend7d ?? 0,
    primaryHref: page.overviewPrimaryHref,
    secondaryHref: page.overviewSecondaryHref,
    secondaryLabel: page.overviewSecondaryLabel
  };

  const radarCardProps: ComponentProps<typeof StudentPortraitRadarCard> = {
    abilities: page.portraitAbilities,
    radarSize: page.radarSize,
    radarCenter: page.radarCenter,
    radarRadius: page.radarRadius,
    radarGridLevels: page.radarGridLevels,
    polygonPoints: page.polygonPoints
  };

  const subjectMasteryCardProps: ComponentProps<typeof StudentPortraitSubjectMasteryCard> = {
    subjects: page.mastery?.subjects ?? []
  };

  const weakPointsCardProps: ComponentProps<typeof StudentPortraitWeakPointsCard> = {
    weakKnowledgePoints: page.mastery?.weakKnowledgePoints ?? []
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    pageError: page.pageError,
    hasPortraitData: page.hasPortraitData,
    reloadPortrait: () => {
      void page.refreshPortrait();
    },
    headerProps,
    stageBannerProps,
    actionCardProps,
    recentTutorCardProps,
    overviewCardProps,
    radarCardProps,
    subjectMasteryCardProps,
    weakPointsCardProps
  };
}
