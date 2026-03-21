import { type MutableRefObject, useEffect } from "react";
import type { ExamDetail, SubmitResult } from "./types";

type StudentExamDetailPageEffectsOptions = {
  data: ExamDetail | null;
  submitted: boolean;
  dirty: boolean;
  saving: boolean;
  pendingLocalSync: boolean;
  online: boolean;
  submitting: boolean;
  deadlineMs: number | null;
  lockedByTime: boolean;
  lockedByServer: boolean;
  startedAt: string | null;
  timeupTriggered: boolean;
  result: SubmitResult | null;
  flushTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  resultSectionRef: MutableRefObject<HTMLDivElement | null>;
  setOnline: (online: boolean) => void;
  setClock: (value: number) => void;
  setTimeupTriggered: (value: boolean) => void;
  queueExamEvent: (type: "blur" | "hidden") => void;
  flushExamEvents: () => Promise<void>;
  load: () => Promise<void>;
  saveDraft: (mode?: "auto" | "manual" | "sync") => Promise<void>;
  submitExam: (trigger: "manual" | "timeout") => Promise<void>;
};

export function useStudentExamDetailPageEffects({
  data,
  submitted,
  dirty,
  saving,
  pendingLocalSync,
  online,
  submitting,
  deadlineMs,
  lockedByTime,
  lockedByServer,
  startedAt,
  timeupTriggered,
  result,
  flushTimerRef,
  resultSectionRef,
  setOnline,
  setClock,
  setTimeupTriggered,
  queueExamEvent,
  flushExamEvents,
  load,
  saveDraft,
  submitExam
}: StudentExamDetailPageEffectsOptions) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateNetwork = () => setOnline(window.navigator.onLine);
    updateNetwork();
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, [setOnline]);

  useEffect(() => {
    if (deadlineMs === null || submitted) {
      return;
    }
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadlineMs, setClock, submitted]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (submitted || (!dirty && !pendingLocalSync)) {
        return;
      }
      void flushExamEvents();
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, flushExamEvents, pendingLocalSync, submitted]);

  useEffect(() => {
    if (!data || submitted || data.exam.antiCheatLevel !== "basic") {
      return;
    }

    const onBlur = () => queueExamEvent("blur");
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        queueExamEvent("hidden");
      }
    };

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [data, queueExamEvent, submitted]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      void flushExamEvents();
    };
  }, [flushExamEvents, flushTimerRef]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty || submitted || lockedByTime || lockedByServer) {
      return;
    }
    const timer = setTimeout(() => {
      void saveDraft("auto");
    }, 1200);
    return () => clearTimeout(timer);
  }, [dirty, lockedByServer, lockedByTime, saveDraft, submitted]);

  useEffect(() => {
    if (!online || !pendingLocalSync || submitted || saving || lockedByTime || lockedByServer) {
      return;
    }
    void saveDraft("sync");
  }, [lockedByServer, lockedByTime, online, pendingLocalSync, saveDraft, saving, submitted]);

  useEffect(() => {
    if (submitted || submitting || lockedByTime === false) {
      return;
    }
    if (!startedAt || (data?.access && !data.access.canSubmit) || timeupTriggered) {
      return;
    }
    setTimeupTriggered(true);
    void submitExam("timeout");
  }, [
    data?.access,
    lockedByTime,
    setTimeupTriggered,
    startedAt,
    submitExam,
    submitted,
    submitting,
    timeupTriggered
  ]);

  useEffect(() => {
    if (result) {
      resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result, resultSectionRef]);
}
