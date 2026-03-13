"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import GradebookDistributionCard from "./_components/GradebookDistributionCard";
import GradebookExecutionLoopCard from "./_components/GradebookExecutionLoopCard";
import GradebookFiltersCard from "./_components/GradebookFiltersCard";
import GradebookSummaryCard from "./_components/GradebookSummaryCard";
import GradebookTableCard from "./_components/GradebookTableCard";
import GradebookTrendCard from "./_components/GradebookTrendCard";
import type {
  GradebookPayload,
  GradebookStatusFilter,
  GradebookViewMode
} from "./types";
import { buildGradebookExportMatrix, downloadTextFile } from "./utils";

export default function TeacherGradebookPage() {
  const [data, setData] = useState<GradebookPayload | null>(null);
  const [classId, setClassId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<GradebookViewMode>("student");
  const [studentKeyword, setStudentKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<GradebookStatusFilter>("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");

  const load = useCallback(async (nextClassId?: string) => {
    setLoading(true);
    setError(null);
    const query = nextClassId ? `?classId=${nextClassId}` : "";
    const res = await fetch(`/api/teacher/gradebook${query}`);
    const payload = await res.json();
    if (!res.ok) {
      setError(payload?.error ?? "加载失败");
      setLoading(false);
      return;
    }
    setData(payload);
    const fallbackClassId = payload?.class?.id ?? payload?.classes?.[0]?.id ?? "";
    setClassId(nextClassId ?? fallbackClassId);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments]);
  const assignmentStatMap = useMemo(
    () => new Map((data?.assignmentStats ?? []).map((item) => [item.assignmentId, item])),
    [data?.assignmentStats]
  );
  const visibleAssignments =
    assignmentFilter !== "all"
      ? assignments.filter((item) => item.id === assignmentFilter)
      : assignments.slice(0, 6);
  const filteredAssignments =
    assignmentFilter === "all" ? assignments : assignments.filter((item) => item.id === assignmentFilter);
  const now = Date.now();

  const ranked = useMemo(() => {
    if (!data?.students?.length) return new Map<string, number>();
    const sorted = [...data.students].sort((a, b) => b.stats.avgScore - a.stats.avgScore);
    return new Map(sorted.map((student, index) => [student.id, index + 1]));
  }, [data?.students]);

  const filteredStudents = useMemo(() => {
    if (!data?.students?.length) return [];
    const keyword = studentKeyword.trim().toLowerCase();
    let list = data.students;

    if (keyword) {
      list = list.filter(
        (student) => student.name.toLowerCase().includes(keyword) || student.email.toLowerCase().includes(keyword)
      );
    }

    if (statusFilter === "overdue") {
      list = list.filter((student) => student.stats.overdue > 0);
    } else if (statusFilter === "pending") {
      list = list.filter((student) => student.stats.pending > 0);
    } else if (statusFilter === "completed") {
      list = list.filter((student) => student.stats.pending === 0);
    }

    return list;
  }, [data?.students, statusFilter, studentKeyword]);

  const trendMap = useMemo(
    () => new Map((data?.trend ?? []).map((item) => [item.assignmentId, item])),
    [data?.trend]
  );
  const selectedClass = useMemo(
    () => (data?.classes ?? []).find((item) => item.id === classId) ?? data?.class ?? null,
    [classId, data?.class, data?.classes]
  );
  const overdueStudentCount = useMemo(
    () => (data?.students ?? []).filter((student) => student.stats.overdue > 0).length,
    [data?.students]
  );
  const followUpStudentCount = useMemo(
    () => (data?.students ?? []).filter((student) => student.stats.overdue > 0 || student.stats.pending > 0).length,
    [data?.students]
  );
  const urgentAssignmentCount = useMemo(
    () =>
      assignments.filter((assignment) => {
        const stat = assignmentStatMap.get(assignment.id);
        if ((stat?.completed ?? 0) >= (stat?.total ?? 0)) return false;
        const dueTs = new Date(assignment.dueDate).getTime();
        return dueTs < now || dueTs - now <= 48 * 60 * 60 * 1000;
      }).length,
    [assignmentStatMap, assignments, now]
  );

  function exportCSV() {
    if (!data) return;
    const { header, rows } = buildGradebookExportMatrix(data.students, assignments, now);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    downloadTextFile(
      `gradebook-${data.class?.name ?? "class"}.csv`,
      `\uFEFF${csv}`,
      "text/csv;charset=utf-8;"
    );
  }

  function exportExcel() {
    if (!data) return;
    const { header, rows } = buildGradebookExportMatrix(data.students, assignments, now);
    const table = `
      <table>
        <thead><tr>${header.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    `;

    downloadTextFile(
      `gradebook-${data.class?.name ?? "class"}.xls`,
      `\uFEFF${table}`,
      "application/vnd.ms-excel;charset=utf-8;"
    );
  }

  if (!data && !error && loading) {
    return <Card title="成绩册">加载中...</Card>;
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>成绩册</h2>
          <div className="section-sub">先收口作业与学生跟进，再回看完成率和成绩走势。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">Gradebook</span>
          {selectedClass ? <span className="chip">{selectedClass.name}</span> : null}
          {followUpStudentCount ? <span className="chip">待跟进学生 {followUpStudentCount}</span> : null}
          {overdueStudentCount ? <span className="chip">逾期学生 {overdueStudentCount}</span> : null}
          {urgentAssignmentCount ? <span className="chip">48h 内需收口作业 {urgentAssignmentCount}</span> : null}
        </div>
      </div>

      <GradebookExecutionLoopCard
        selectedClass={selectedClass}
        summary={data?.summary ?? null}
        assignments={assignments}
        assignmentStatMap={assignmentStatMap}
        students={data?.students ?? []}
        trendMap={trendMap}
        now={now}
      />

      <div className="gradebook-top-grid">
        <div id="gradebook-filters">
          <GradebookFiltersCard
            classes={data?.classes ?? []}
            assignments={assignments}
            classId={classId}
            viewMode={viewMode}
            assignmentFilter={assignmentFilter}
            studentKeyword={studentKeyword}
            statusFilter={statusFilter}
            error={error}
            onClassChange={(nextClassId) => {
              setClassId(nextClassId);
              load(nextClassId);
            }}
            onViewModeChange={setViewMode}
            onAssignmentFilterChange={setAssignmentFilter}
            onStudentKeywordChange={setStudentKeyword}
            onStatusFilterChange={setStatusFilter}
          />
        </div>
        <div id="gradebook-summary">
          <GradebookSummaryCard
            summary={data?.summary ?? null}
            assignmentFilter={assignmentFilter}
            visibleAssignmentsCount={visibleAssignments.length}
            overdueStudentCount={overdueStudentCount}
            followUpStudentCount={followUpStudentCount}
            urgentAssignmentCount={urgentAssignmentCount}
            onExportCsv={exportCSV}
            onExportExcel={exportExcel}
          />
        </div>
      </div>

      <div className="gradebook-insight-grid">
        <div id="gradebook-trend">
          <GradebookTrendCard trend={data?.trend ?? []} />
        </div>
        <div id="gradebook-distribution">
          <GradebookDistributionCard distribution={data?.distribution ?? []} />
        </div>
      </div>

      <div id="gradebook-table">
        <GradebookTableCard
          loading={loading}
          viewMode={viewMode}
          students={filteredStudents}
          filteredAssignments={filteredAssignments}
          visibleAssignments={visibleAssignments}
          assignmentStatMap={assignmentStatMap}
          ranked={ranked}
          trendMap={trendMap}
          now={now}
        />
      </div>
    </div>
  );
}
