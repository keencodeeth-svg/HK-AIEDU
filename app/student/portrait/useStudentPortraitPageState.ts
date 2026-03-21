import { useCallback, useMemo, useRef, useState } from "react";
import type { AbilityStat, MasterySummary } from "./types";
import { getStudentPortraitPageDerivedState } from "./utils";

export function useStudentPortraitPageState() {
  const requestIdRef = useRef(0);
  const hasPortraitSnapshotRef = useRef(false);

  const [abilities, setAbilities] = useState<AbilityStat[]>([]);
  const [mastery, setMastery] = useState<MasterySummary | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearPortraitState = useCallback(() => {
    hasPortraitSnapshotRef.current = false;
    setAbilities([]);
    setMastery(null);
    setPageError(null);
    setLastLoadedAt(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearPortraitState();
    setAuthRequired(true);
  }, [clearPortraitState]);

  const derivedState = useMemo(
    () =>
      getStudentPortraitPageDerivedState({
        abilities,
        mastery,
        loading
      }),
    [abilities, loading, mastery]
  );

  return {
    requestIdRef,
    hasPortraitSnapshotRef,
    abilities,
    mastery,
    authRequired,
    loading,
    refreshing,
    pageError,
    lastLoadedAt,
    portraitAbilities: derivedState.portraitAbilities,
    radarSize: derivedState.radarSize,
    radarCenter: derivedState.radarCenter,
    radarRadius: derivedState.radarRadius,
    radarGridLevels: derivedState.radarGridLevels,
    polygonPoints: derivedState.polygonPoints,
    lowestAbility: derivedState.lowestAbility,
    weakFocus: derivedState.weakFocus,
    trackedKnowledgePoints: derivedState.trackedKnowledgePoints,
    weakKnowledgePointCount: derivedState.weakKnowledgePointCount,
    stageCopy: derivedState.stageCopy,
    portraitActionPlan: derivedState.portraitActionPlan,
    recentStudyVariantActivity: derivedState.recentStudyVariantActivity,
    recentStudyVariantSummary: derivedState.recentStudyVariantSummary,
    recentStudyPracticeHref: derivedState.recentStudyPracticeHref,
    recentStudyTutorHref: derivedState.recentStudyTutorHref,
    overviewPrimaryHref: derivedState.overviewPrimaryHref,
    overviewSecondaryHref: derivedState.overviewSecondaryHref,
    overviewSecondaryLabel: derivedState.overviewSecondaryLabel,
    hasPortraitData: derivedState.hasPortraitData,
    setAbilities,
    setMastery,
    setAuthRequired,
    setLoading,
    setRefreshing,
    setPageError,
    setLastLoadedAt,
    clearPortraitState,
    handleAuthRequired
  };
}
