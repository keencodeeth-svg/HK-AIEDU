"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, isAuthError, requestJson } from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import { getStudentModulesRequestMessage, resolveStudentModulesSubjectFilter } from "./utils";

type StudentModule = {
  id: string;
  title: string;
  description?: string;
  assignmentCount: number;
  completedCount: number;
};

type StudentClassModules = {
  classId: string;
  className: string;
  subject: string;
  grade: string;
  modules: StudentModule[];
};

type StudentModulesResponse = {
  data?: StudentClassModules[];
};

export default function StudentModulesPage() {
  const requestIdRef = useRef(0);
  const hasSnapshotRef = useRef(false);
  const [data, setData] = useState<StudentClassModules[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("compact");
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [expandedClassIds, setExpandedClassIds] = useState<Record<string, boolean>>({});

  const clearModulesState = useCallback(() => {
    hasSnapshotRef.current = false;
    setData([]);
    setLastLoadedAt(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearModulesState();
    setPageError(null);
    setAuthRequired(true);
  }, [clearModulesState]);

  const loadModules = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
      if (!hasSnapshotRef.current) {
        setData([]);
      }
    }
    setPageError(null);

    try {
      const payload = await requestJson<StudentModulesResponse>("/api/student/modules");
      if (requestId !== requestIdRef.current) {
        return;
      }
      const nextData = payload.data ?? [];
      hasSnapshotRef.current = true;
      setData(nextData);
      setAuthRequired(false);
      setSubjectFilter((prev) => resolveStudentModulesSubjectFilter(nextData, prev));
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        if (!hasSnapshotRef.current) {
          clearModulesState();
        }
        setAuthRequired(false);
        setPageError(getStudentModulesRequestMessage(error, "加载课程模块失败"));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [clearModulesState, handleAuthRequired]);

  useEffect(() => {
    void loadModules();
  }, [loadModules]);

  const subjectOptions = useMemo(() => {
    return Array.from(new Set(data.map((klass) => klass.subject))).sort((a, b) =>
      (SUBJECT_LABELS[a] ?? a).localeCompare(SUBJECT_LABELS[b] ?? b, "zh-CN")
    );
  }, [data]);

  const filteredClasses = useMemo(() => {
    return data
      .filter((klass) => (subjectFilter === "all" ? true : klass.subject === subjectFilter))
      .sort((a, b) => a.className.localeCompare(b.className, "zh-CN"));
  }, [data, subjectFilter]);

  const visibleClasses = showAllClasses ? filteredClasses : filteredClasses.slice(0, 5);

  const totalModules = filteredClasses.reduce((sum, klass) => sum + klass.modules.length, 0);
  const totalAssignments = filteredClasses.reduce(
    (sum, klass) => sum + klass.modules.reduce((moduleSum, module) => moduleSum + (module.assignmentCount ?? 0), 0),
    0
  );
  const totalCompleted = filteredClasses.reduce(
    (sum, klass) => sum + klass.modules.reduce((moduleSum, module) => moduleSum + (module.completedCount ?? 0), 0),
    0
  );

  function toggleClass(classId: string) {
    setExpandedClassIds((prev) => ({ ...prev, [classId]: !prev[classId] }));
  }

  const hasModulesData = data.length > 0;

  function renderModuleCompact(module: StudentModule) {
    const progress = module.assignmentCount ? Math.round((module.completedCount / module.assignmentCount) * 100) : 0;
    return (
      <div
        className="card"
        key={module.id}
        style={{
          padding: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="section-title" style={{ fontSize: 14 }}>
            {module.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 2 }}>
            完成 {module.completedCount}/{module.assignmentCount} · 进度 {progress}%
          </div>
        </div>
        <Link className="button secondary" href={`/student/modules/${module.id}`}>
          进入
        </Link>
      </div>
    );
  }

  function renderModuleDetailed(module: StudentModule) {
    const progress = module.assignmentCount ? Math.round((module.completedCount / module.assignmentCount) * 100) : 0;
    return (
      <div className="card" key={module.id}>
        <div className="section-title">{module.title}</div>
        <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{module.description || "暂无说明"}</div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>进度 {progress}%</div>
          <div style={{ height: 8, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #1f6feb, #7ec4ff)"
              }}
            />
          </div>
        </div>
        <div className="pill-list" style={{ marginTop: 8 }}>
          <span className="pill">
            完成 {module.completedCount}/{module.assignmentCount}
          </span>
        </div>
        <Link className="button secondary" href={`/student/modules/${module.id}`} style={{ marginTop: 8 }}>
          查看模块
        </Link>
      </div>
    );
  }

  if (loading && !hasModulesData && !authRequired) {
    return <StatePanel title="课程模块加载中" description="正在同步班级模块、任务进度与学科分布。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可查看当前加入班级的课程模块与作业进度。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (pageError && !hasModulesData) {
    return (
      <StatePanel
        title="课程模块加载失败"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadModules()}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>课程模块</h2>
          <div className="section-sub">按单元查看学习内容与作业进度。</div>
        </div>
        <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="chip">
            模块 {totalModules} · 任务 {totalCompleted}/{totalAssignments}
          </span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button className="button secondary" type="button" onClick={() => void loadModules("refresh")} disabled={loading || refreshing}>
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
            <button className="button secondary" type="button" onClick={() => void loadModules("refresh")}>
              再试一次
            </button>
          }
        />
      ) : null}

      <div className="toolbar-wrap">
        <select
          className="select-control"
          value={subjectFilter}
          onChange={(event) => {
            setSubjectFilter(event.target.value);
            setShowAllClasses(false);
          }}
        >
          <option value="all">全部学科</option>
          {subjectOptions.map((subject) => (
            <option key={subject} value={subject}>
              {SUBJECT_LABELS[subject] ?? subject}
            </option>
          ))}
        </select>
        <button
          className={viewMode === "compact" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => setViewMode("compact")}
        >
          紧凑视图
        </button>
        <button
          className={viewMode === "detailed" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => setViewMode("detailed")}
        >
          详细视图
        </button>
        <span className="chip">班级 {filteredClasses.length}</span>
      </div>

      {filteredClasses.length ? (
        <>
          {visibleClasses.map((klass) => {
            const isExpanded = expandedClassIds[klass.classId] ?? false;
            return (
              <Card key={klass.classId} title={klass.className} tag="班级">
                <div className="feature-card">
                  <EduIcon name="book" />
                  <p>
                    {SUBJECT_LABELS[klass.subject] ?? klass.subject} · {klass.grade} 年级 · {klass.modules.length} 个模块
                  </p>
                  <button className="button ghost" type="button" onClick={() => toggleClass(klass.classId)}>
                    {isExpanded ? "收起模块" : "展开模块"}
                  </button>
                </div>
                {isExpanded ? (
                  klass.modules.length ? (
                    viewMode === "compact" ? (
                      <div className="grid" style={{ gap: 8, marginTop: 10 }}>
                        {klass.modules.map((module) => renderModuleCompact(module))}
                      </div>
                    ) : (
                      <div className="grid" style={{ gap: 10, marginTop: 12 }}>
                        {klass.modules.map((module) => renderModuleDetailed(module))}
                      </div>
                    )
                  ) : (
                    <p>暂无模块。</p>
                  )
                ) : null}
              </Card>
            );
          })}
          {filteredClasses.length > 5 ? (
            <button className="button ghost" type="button" onClick={() => setShowAllClasses((prev) => !prev)}>
              {showAllClasses ? "收起班级" : `展开全部班级（${filteredClasses.length}）`}
            </button>
          ) : null}
        </>
      ) : (
        <StatePanel title="暂无班级模块" description="加入班级并分配模块后，这里会展示单元与作业进度。" tone="empty" />
      )}
    </div>
  );
}
