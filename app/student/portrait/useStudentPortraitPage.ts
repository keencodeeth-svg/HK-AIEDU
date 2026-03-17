"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import { buildTutorLaunchHref } from "@/lib/tutor-launch";
import type { AbilityStat, MasterySummary, PortraitActionPlan, RadarResponse } from "./types";
import {
  buildPolygonPoints,
  buildPracticeHref,
  getPortraitStageCopy,
  getRecentStudyVariantSummary,
  getStudentPortraitRequestMessage,
  PORTRAIT_RADAR_GRID_LEVELS,
  PORTRAIT_RADAR_RADIUS,
  PORTRAIT_RADAR_SIZE
} from "./utils";

export function useStudentPortraitPage() {
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

  const loadPortrait = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isRefresh = mode === "refresh";

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const payload = await requestJson<RadarResponse>("/api/student/radar");
      if (requestId !== requestIdRef.current) {
        return;
      }

      setAbilities(payload.data?.abilities ?? []);
      setMastery(payload.data?.mastery ?? null);
      setAuthRequired(false);
      hasPortraitSnapshotRef.current = true;
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        if (!hasPortraitSnapshotRef.current) {
          clearPortraitState();
        }
        setAuthRequired(false);
        setPageError(getStudentPortraitRequestMessage(error, "加载学习画像失败"));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [clearPortraitState, handleAuthRequired]);

  useEffect(() => {
    void loadPortrait("initial");
  }, [loadPortrait]);

  const portraitAbilities = abilities;
  const radarSize = PORTRAIT_RADAR_SIZE;
  const radarCenter = radarSize / 2;
  const radarRadius = PORTRAIT_RADAR_RADIUS;
  const radarGridLevels = [...PORTRAIT_RADAR_GRID_LEVELS];
  const polygonPoints = useMemo(
    () => buildPolygonPoints(portraitAbilities, radarRadius, radarCenter),
    [portraitAbilities, radarRadius, radarCenter]
  );
  const lowestAbility = useMemo(() => {
    if (!portraitAbilities.length) return null;
    return [...portraitAbilities].sort((left, right) => left.score - right.score)[0] ?? null;
  }, [portraitAbilities]);
  const weakFocus = mastery?.weakKnowledgePoints?.[0] ?? null;
  const weakKnowledgePointCount = mastery?.weakKnowledgePoints?.length ?? 0;
  const trackedKnowledgePoints = mastery?.trackedKnowledgePoints ?? 0;
  const stageCopy = useMemo(
    () =>
      getPortraitStageCopy({
        loading,
        abilityCount: portraitAbilities.length,
        trackedKnowledgePoints,
        weakKnowledgePointCount,
        lowestAbilityLabel: lowestAbility?.label
      }),
    [loading, portraitAbilities.length, trackedKnowledgePoints, weakKnowledgePointCount, lowestAbility?.label]
  );
  const recentStudyVariantActivity = mastery?.recentStudyVariantActivity ?? null;
  const recentStudyVariantSummary = getRecentStudyVariantSummary(recentStudyVariantActivity);
  const portraitActionPlan = useMemo<PortraitActionPlan>(() => {
    if (recentStudyVariantActivity) {
      return {
        kicker: "基于最新 Tutor 结果",
        title: `先把「${recentStudyVariantActivity.latestKnowledgePointTitle}」迁到正式练习`,
        description: recentStudyVariantActivity.latestCorrect
          ? "这类题你刚在 Tutor 做对过，最适合立刻切到正式练习，把“会做”巩固成“稳定会做”。"
          : "这个知识点刚在 Tutor 暴露出薄弱处，趁记忆还热的时候立刻做正式练习，修复效率最高。",
        primaryLabel: "去做正式练习",
        primaryHref: buildPracticeHref({
          subject: recentStudyVariantActivity.latestSubject,
          knowledgePointId: recentStudyVariantActivity.latestKnowledgePointId
        }),
        secondaryLabel: "回到 Tutor",
        secondaryHref: buildTutorLaunchHref({
          intent: "image",
          source: "student-portrait-recent-tutor",
          subject: recentStudyVariantActivity.latestSubject
        }),
        meta: `最近 24 小时 Tutor 巩固 ${recentStudyVariantActivity.recentAttemptCount} 题 · 当前掌握 ${recentStudyVariantActivity.masteryScore} 分`
      };
    }

    if (weakFocus) {
      return {
        kicker: "基于薄弱知识点",
        title: `先补「${weakFocus.title}」`,
        description: `这是当前最值得优先收口的知识点${typeof weakFocus.weaknessRank === "number" ? `，当前优先级 #${weakFocus.weaknessRank}` : ""}。先做定向练习，再回来观察画像变化。`,
        primaryLabel: "去定向练习",
        primaryHref: buildPracticeHref({
          subject: weakFocus.subject,
          knowledgePointId: weakFocus.knowledgePointId
        }),
        secondaryLabel: "去 Tutor 追问",
        secondaryHref: buildTutorLaunchHref({
          intent: "image",
          source: "student-portrait-weak-focus",
          subject: weakFocus.subject
        }),
        meta: `掌握 ${weakFocus.masteryScore} 分 · 正确 ${weakFocus.correct} / ${weakFocus.total}`
      };
    }

    return {
      kicker: "基于当前画像",
      title: "先做一轮练习，再回来观察画像有没有变化",
      description: "当没有明显单点风险时，最好的动作就是保持练习节奏，然后回到画像页看掌握分、能力雷达和趋势是否继续抬升。",
      primaryLabel: "去做练习",
      primaryHref: "/practice",
      secondaryLabel: "去 Tutor",
      secondaryHref: buildTutorLaunchHref({
        intent: "image",
        source: "student-portrait-general"
      }),
      meta: `平均掌握 ${mastery?.averageMasteryScore ?? 0} 分 · 7 日趋势 ${mastery?.averageTrend7d ?? 0}`
    };
  }, [mastery?.averageMasteryScore, mastery?.averageTrend7d, recentStudyVariantActivity, weakFocus]);
  const recentStudyPracticeHref = recentStudyVariantActivity
    ? buildPracticeHref({
        subject: recentStudyVariantActivity.latestSubject,
        knowledgePointId: recentStudyVariantActivity.latestKnowledgePointId
      })
    : "";
  const recentStudyTutorHref = recentStudyVariantActivity
    ? buildTutorLaunchHref({
        intent: "image",
        source: "student-portrait-recent-card",
        subject: recentStudyVariantActivity.latestSubject
      })
    : "";
  const overviewPrimaryHref = buildPracticeHref({
    subject: weakFocus?.subject,
    knowledgePointId: weakFocus?.knowledgePointId
  });
  const overviewSecondaryHref = weakFocus
    ? buildTutorLaunchHref({
        intent: "image",
        source: "student-portrait-overview",
        subject: weakFocus.subject
      })
    : "/wrong-book";
  const overviewSecondaryLabel = weakFocus ? "去 Tutor 追问" : "去错题本";
  const hasPortraitData = portraitAbilities.length > 0 || mastery !== null;

  const refreshPortrait = useCallback(async () => {
    await loadPortrait("refresh");
  }, [loadPortrait]);

  return {
    portraitAbilities,
    mastery,
    authRequired,
    loading,
    refreshing,
    pageError,
    lastLoadedAt,
    radarSize,
    radarCenter,
    radarRadius,
    radarGridLevels,
    polygonPoints,
    lowestAbility,
    weakFocus,
    trackedKnowledgePoints,
    weakKnowledgePointCount,
    stageCopy,
    portraitActionPlan,
    recentStudyVariantActivity,
    recentStudyVariantSummary,
    recentStudyPracticeHref,
    recentStudyTutorHref,
    overviewPrimaryHref,
    overviewSecondaryHref,
    overviewSecondaryLabel,
    hasPortraitData,
    refreshPortrait
  };
}
