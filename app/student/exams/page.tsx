"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, isAuthError, requestJson } from "@/lib/client-request";
import type { TodayTaskPayload } from "../types";
import StudentExamArchiveCard from "./_components/StudentExamArchiveCard";
import StudentExamKpiGrid from "./_components/StudentExamKpiGrid";
import StudentExamSectionCard from "./_components/StudentExamSectionCard";
import StudentSelfAssessmentIntroCard from "./_components/StudentSelfAssessmentIntroCard";
import StudentSelfAssessmentTasksCard from "./_components/StudentSelfAssessmentTasksCard";
import type { StudentExamItem, StudentExamModuleTab, StudentSelfAssessmentTask } from "./types";
import {
  buildSelfAssessmentSummary,
  filterSelfAssessmentTasks,
  getStudentExamListRequestMessage,
  getStudentSelfAssessmentRequestMessage,
  groupStudentExams
} from "./utils";

type StudentExamListResponse = {
  data?: StudentExamItem[];
};

type TodayTasksResponse = {
  data?: TodayTaskPayload;
};

export default function StudentExamsPage() {
  const loadRequestIdRef = useRef(0);
  const hasExamSnapshotRef = useRef(false);
  const hasTodayTasksSnapshotRef = useRef(false);
  const [list, setList] = useState<StudentExamItem[]>([]);
  const [todayTasks, setTodayTasks] = useState<StudentSelfAssessmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [examError, setExamError] = useState<string | null>(null);
  const [todayTasksError, setTodayTasksError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [moduleTab, setModuleTab] = useState<StudentExamModuleTab>("teacher_exam");
  const [showPastExams, setShowPastExams] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearExamPageState = useCallback(() => {
    hasExamSnapshotRef.current = false;
    hasTodayTasksSnapshotRef.current = false;
    setList([]);
    setTodayTasks([]);
    setPageError(null);
    setExamError(null);
    setTodayTasksError(null);
    setLastLoadedAt(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearExamPageState();
    setAuthRequired(true);
  }, [clearExamPageState]);

  const loadPage = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);
    setExamError(null);
    setTodayTasksError(null);

    try {
      const [examsResult, todayTasksResult] = await Promise.allSettled([
        requestJson<StudentExamListResponse>("/api/student/exams"),
        requestJson<TodayTasksResponse>("/api/student/today-tasks")
      ]);

      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      const hasAuthFailure =
        (examsResult.status === "rejected" && isAuthError(examsResult.reason)) ||
        (todayTasksResult.status === "rejected" && isAuthError(todayTasksResult.reason));

      if (hasAuthFailure) {
        handleAuthRequired();
        return;
      }

      const nextErrors: string[] = [];
      let hasFreshData = false;

      if (examsResult.status === "fulfilled") {
        setList(examsResult.value.data ?? []);
        hasExamSnapshotRef.current = true;
        hasFreshData = true;
      } else {
        if (!hasExamSnapshotRef.current) {
          setList([]);
        }
        const nextExamError = getStudentExamListRequestMessage(examsResult.reason, "加载考试列表失败");
        setExamError(nextExamError);
        nextErrors.push(
          hasExamSnapshotRef.current
            ? `考试列表刷新失败，已展示最近一次成功数据：${nextExamError}`
            : nextExamError
        );
      }

      if (todayTasksResult.status === "fulfilled") {
        setTodayTasks(todayTasksResult.value.data?.tasks ?? []);
        hasTodayTasksSnapshotRef.current = true;
        hasFreshData = true;
      } else {
        if (!hasTodayTasksSnapshotRef.current) {
          setTodayTasks([]);
        }
        const nextTodayTasksError = getStudentSelfAssessmentRequestMessage(todayTasksResult.reason, "加载今日自主任务失败");
        setTodayTasksError(nextTodayTasksError);
        nextErrors.push(
          hasTodayTasksSnapshotRef.current
            ? `自主测评任务刷新失败，已展示最近一次成功数据：${nextTodayTasksError}`
            : nextTodayTasksError
        );
      }

      setAuthRequired(false);
      if (hasFreshData) {
        setLastLoadedAt(new Date().toISOString());
      }
      setPageError(nextErrors.length ? nextErrors.join("；") : null);
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [handleAuthRequired]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (moduleTab !== "teacher_exam") {
      setShowPastExams(false);
    }
  }, [moduleTab]);

  const grouped = useMemo(() => groupStudentExams(list), [list]);
  const selfAssessmentTasks = useMemo(() => filterSelfAssessmentTasks(todayTasks), [todayTasks]);
  const visibleSelfAssessmentTasks = useMemo(() => selfAssessmentTasks.slice(0, 6), [selfAssessmentTasks]);
  const selfAssessmentSummary = useMemo(
    () => buildSelfAssessmentSummary(selfAssessmentTasks),
    [selfAssessmentTasks]
  );

  const hasAnyData = Boolean(list.length || todayTasks.length);
  const hasFatalError = Boolean(examError && !list.length && todayTasksError && !todayTasks.length);

  if (loading && !hasAnyData && !authRequired) {
    return (
      <StatePanel title="在线考试加载中" description="正在同步考试安排与今日自主测评任务。" tone="loading" />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可查看老师发布考试和今日自主测评任务。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (hasFatalError) {
    return (
      <StatePanel
        title="在线考试加载失败"
        description={pageError ?? "当前无法同步考试与自主测评任务，请稍后重试。"}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadPage()}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>在线考试</h2>
          <div className="section-sub">老师发布考试与学生自主测评分模块管理，避免混淆。</div>
        </div>
        <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="chip">共 {list.length} 场考试</span>
          <span className="chip">开放中 {grouped.ongoing.length}</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button className="button secondary" type="button" onClick={() => void loadPage("refresh")} disabled={loading || refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? (
        <StatePanel
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${pageError}`}
          tone="error"
          compact
          action={
            <button className="button secondary" type="button" onClick={() => void loadPage("refresh")} disabled={refreshing}>
              再试一次
            </button>
          }
        />
      ) : null}

      <div className="cta-row exams-module-switch" style={{ marginTop: 0 }}>
        <button
          className={moduleTab === "teacher_exam" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => setModuleTab("teacher_exam")}
        >
          老师发布考试
        </button>
        <button
          className={moduleTab === "self_assessment" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => setModuleTab("self_assessment")}
        >
          学生自主测评
        </button>
      </div>

      {moduleTab === "teacher_exam" ? (
        examError && !list.length ? (
          <StatePanel
            title="考试列表暂时不可用"
            description={examError}
            tone="error"
            action={
              <button className="button secondary" type="button" onClick={() => void loadPage("refresh")} disabled={refreshing}>
                重试考试加载
              </button>
            }
          />
        ) : (
          <>
            <StudentExamKpiGrid
              ongoingCount={grouped.ongoing.length}
              upcomingCount={grouped.upcoming.length}
              finishedCount={grouped.finished.length}
            />
            <StudentExamSectionCard
              title="待进行"
              tag="考试"
              items={grouped.ongoing}
              emptyText="当前没有正在开放的考试。"
            />
            <StudentExamSectionCard
              title="即将开始"
              tag="待开始"
              items={grouped.upcoming}
              emptyText="暂无即将开始的考试。"
            />
            <StudentExamArchiveCard
              finished={grouped.finished}
              locked={grouped.locked}
              showPastExams={showPastExams}
              onToggle={() => setShowPastExams((prev) => !prev)}
            />
          </>
        )
      ) : null}

      {moduleTab === "self_assessment" ? (
        todayTasksError && !selfAssessmentTasks.length ? (
          <>
            <StudentSelfAssessmentIntroCard />
            <StatePanel
              title="自主测评任务暂时不可用"
              description={todayTasksError}
              tone="error"
              action={
                <button className="button secondary" type="button" onClick={() => void loadPage("refresh")} disabled={refreshing}>
                  重试任务加载
                </button>
              }
            />
          </>
        ) : (
          <>
            <StudentSelfAssessmentIntroCard />
            <StudentSelfAssessmentTasksCard tasks={visibleSelfAssessmentTasks} summary={selfAssessmentSummary} />
          </>
        )
      ) : null}
    </div>
  );
}
