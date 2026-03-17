"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type { ScheduleResponse } from "@/lib/class-schedules";
import type { CalendarItem, CalendarResponse } from "./types";
import {
  getCalendarRoleActions,
  getCalendarScheduleRequestMessage,
  getCalendarTimelineRequestMessage,
  isCalendarMissingStudentError
} from "./utils";

export function useCalendarPage() {
  const loadRequestIdRef = useRef(0);
  const hasScheduleSnapshotRef = useRef(false);
  const hasItemsSnapshotRef = useRef(false);
  const [schedule, setSchedule] = useState<ScheduleResponse["data"] | null>(null);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [activeComposerKey, setActiveComposerKey] = useState<string | null>(null);

  const clearCalendarState = useCallback(() => {
    hasScheduleSnapshotRef.current = false;
    hasItemsSnapshotRef.current = false;
    setSchedule(null);
    setItems([]);
    setPageError(null);
    setLastLoadedAt(null);
    setActiveComposerKey(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearCalendarState();
    setAuthRequired(true);
  }, [clearCalendarState]);

  const loadPage = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = ++loadRequestIdRef.current;
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const [scheduleResult, calendarResult] = await Promise.allSettled([
        requestJson<ScheduleResponse>("/api/schedule"),
        requestJson<CalendarResponse>("/api/calendar")
      ]);

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      const authFailure = [scheduleResult, calendarResult].some(
        (result) => result.status === "rejected" && isAuthError(result.reason)
      );
      let hasSuccess = false;
      const nextErrors: string[] = [];

      if (authFailure) {
        handleAuthRequired();
        return;
      }

      if (scheduleResult.status === "fulfilled") {
        hasScheduleSnapshotRef.current = true;
        setSchedule(scheduleResult.value.data ?? null);
        hasSuccess = true;
      } else {
        if (!hasScheduleSnapshotRef.current || isCalendarMissingStudentError(scheduleResult.reason)) {
          hasScheduleSnapshotRef.current = false;
          setSchedule(null);
        }
        nextErrors.push(`课程表加载失败：${getCalendarScheduleRequestMessage(scheduleResult.reason, "加载课程表失败")}`);
      }

      if (calendarResult.status === "fulfilled") {
        hasItemsSnapshotRef.current = true;
        setItems(calendarResult.value.data ?? []);
        hasSuccess = true;
      } else {
        if (!hasItemsSnapshotRef.current || isCalendarMissingStudentError(calendarResult.reason)) {
          hasItemsSnapshotRef.current = false;
          setItems([]);
        }
        nextErrors.push(`学习时间线加载失败：${getCalendarTimelineRequestMessage(calendarResult.reason, "加载学习时间线失败")}`);
      }

      setAuthRequired(false);
      if (hasSuccess) {
        setLastLoadedAt(new Date().toISOString());
      }
      if (nextErrors.length) {
        setPageError(nextErrors.join("；"));
      }
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        if (!hasScheduleSnapshotRef.current && !hasItemsSnapshotRef.current) {
          clearCalendarState();
        }
        setAuthRequired(false);
        setPageError(getCalendarScheduleRequestMessage(error, "加载课程表失败"));
      }
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [clearCalendarState, handleAuthRequired]);

  useEffect(() => {
    void loadPage("initial");
  }, [loadPage]);

  const roleActions = getCalendarRoleActions(schedule?.role);

  return {
    schedule,
    items,
    loading,
    refreshing,
    authRequired,
    pageError,
    lastLoadedAt,
    activeComposerKey,
    isTeacher: schedule?.role === "teacher",
    emptyStateAction: roleActions.emptyStateAction,
    supplementalAction: roleActions.supplementalAction,
    setActiveComposerKey,
    loadPage
  };
}
