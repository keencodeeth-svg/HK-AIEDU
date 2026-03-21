"use client";

import { useCallback } from "react";
import { useStudentPortraitPageEffects } from "./useStudentPortraitPageEffects";
import { useStudentPortraitPageLoaders } from "./useStudentPortraitPageLoaders";
import { useStudentPortraitPageState } from "./useStudentPortraitPageState";

export function useStudentPortraitPage() {
  const pageState = useStudentPortraitPageState();

  const { loadPortrait } = useStudentPortraitPageLoaders({
    requestIdRef: pageState.requestIdRef,
    hasPortraitSnapshotRef: pageState.hasPortraitSnapshotRef,
    clearPortraitState: pageState.clearPortraitState,
    handleAuthRequired: pageState.handleAuthRequired,
    setAbilities: pageState.setAbilities,
    setMastery: pageState.setMastery,
    setAuthRequired: pageState.setAuthRequired,
    setLoading: pageState.setLoading,
    setRefreshing: pageState.setRefreshing,
    setPageError: pageState.setPageError,
    setLastLoadedAt: pageState.setLastLoadedAt
  });

  useStudentPortraitPageEffects({
    loadPortrait
  });

  const refreshPortrait = useCallback(async () => {
    await loadPortrait("refresh");
  }, [loadPortrait]);

  return {
    portraitAbilities: pageState.portraitAbilities,
    mastery: pageState.mastery,
    authRequired: pageState.authRequired,
    loading: pageState.loading,
    refreshing: pageState.refreshing,
    pageError: pageState.pageError,
    lastLoadedAt: pageState.lastLoadedAt,
    radarSize: pageState.radarSize,
    radarCenter: pageState.radarCenter,
    radarRadius: pageState.radarRadius,
    radarGridLevels: pageState.radarGridLevels,
    polygonPoints: pageState.polygonPoints,
    lowestAbility: pageState.lowestAbility,
    weakFocus: pageState.weakFocus,
    trackedKnowledgePoints: pageState.trackedKnowledgePoints,
    weakKnowledgePointCount: pageState.weakKnowledgePointCount,
    stageCopy: pageState.stageCopy,
    portraitActionPlan: pageState.portraitActionPlan,
    recentStudyVariantActivity: pageState.recentStudyVariantActivity,
    recentStudyVariantSummary: pageState.recentStudyVariantSummary,
    recentStudyPracticeHref: pageState.recentStudyPracticeHref,
    recentStudyTutorHref: pageState.recentStudyTutorHref,
    overviewPrimaryHref: pageState.overviewPrimaryHref,
    overviewSecondaryHref: pageState.overviewSecondaryHref,
    overviewSecondaryLabel: pageState.overviewSecondaryLabel,
    hasPortraitData: pageState.hasPortraitData,
    refreshPortrait
  };
}
