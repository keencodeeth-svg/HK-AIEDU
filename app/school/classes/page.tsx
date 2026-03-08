"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import Stat from "@/components/Stat";
import { formatLoadedTime, getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import type { SchoolClassRecord } from "@/lib/school-admin-types";

type SchoolClassesResponse = { data?: SchoolClassRecord[] };
type ClassStatusFilter = "all" | "teacher_gap" | "empty" | "no_assignments" | "overloaded" | "healthy";

const fieldStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)",
  background: "var(--card)",
  color: "var(--ink)"
} as const;

function getClassIssueTags(item: SchoolClassRecord) {
  const tags: string[] = [];
  if (!item.teacherId) tags.push("待绑定教师");
  if (item.studentCount === 0) tags.push("暂无学生");
  if (item.assignmentCount === 0) tags.push("未布置作业");
  if (item.studentCount >= 45) tags.push("人数偏高");
  return tags;
}

export default function SchoolClassesPage() {
  const [classes, setClasses] = useState<SchoolClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ClassStatusFilter>("all");

  const loadClasses = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const payload = await requestJson<SchoolClassesResponse>("/api/school/classes");
      setClasses(payload.data ?? []);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        setClasses([]);
      } else {
        setError(getRequestErrorMessage(nextError, "加载学校班级失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const gradeOptions = useMemo(
    () => Array.from(new Set(classes.map((item) => item.grade))).sort((left, right) => left.localeCompare(right, "zh-CN")),
    [classes]
  );

  const filteredClasses = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();
    return classes.filter((item) => {
      const issueTags = getClassIssueTags(item);
      if (gradeFilter !== "all" && item.grade !== gradeFilter) return false;
      if (statusFilter === "teacher_gap" && item.teacherId) return false;
      if (statusFilter === "empty" && item.studentCount > 0) return false;
      if (statusFilter === "no_assignments" && item.assignmentCount > 0) return false;
      if (statusFilter === "overloaded" && item.studentCount < 45) return false;
      if (statusFilter === "healthy" && issueTags.length > 0) return false;
      if (!keywordLower) return true;
      return [item.name, item.subject, item.grade, item.teacherName ?? item.teacherId ?? "", ...issueTags]
        .join(" ")
        .toLowerCase()
        .includes(keywordLower);
    });
  }, [classes, gradeFilter, keyword, statusFilter]);

  const teacherGapCount = useMemo(() => classes.filter((item) => !item.teacherId).length, [classes]);
  const emptyCount = useMemo(() => classes.filter((item) => item.studentCount === 0).length, [classes]);
  const noAssignmentCount = useMemo(() => classes.filter((item) => item.assignmentCount === 0).length, [classes]);

  if (loading && !classes.length && !authRequired) {
    return <StatePanel title="学校班级加载中" description="正在汇总学校班级结构与执行状态。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="需要学校管理员权限"
        description="请使用学校管理员或平台主管账号查看学校班级。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (error && !classes.length) {
    return (
      <StatePanel
        title="学校班级加载失败"
        description={error}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadClasses()}>
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
          <h2>学校班级</h2>
          <div className="section-sub">统一查看班级结构、教师绑定、学生规模和作业覆盖状态。</div>
        </div>
        <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <span className="chip">Classes</span>
          <button className="button secondary" type="button" onClick={() => void loadClasses("refresh")} disabled={loading || refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {error ? <StatePanel title="刷新存在异常" description={error} tone="error" compact /> : null}

      <Card title="班级运营概览" tag="统计">
        <div className="grid grid-3">
          <Stat label="班级总数" value={String(classes.length)} helper={`当前筛选 ${filteredClasses.length} 个`} />
          <Stat label="待绑定教师" value={String(teacherGapCount)} helper="优先补齐负责人" />
          <Stat label="空班级" value={String(emptyCount)} helper="需要补员或清理" />
          <Stat label="未布置作业" value={String(noAssignmentCount)} helper="教学覆盖不足" />
          <Stat label="高负载班级" value={String(classes.filter((item) => item.studentCount >= 45).length)} helper="重点巡检" />
          <Stat label="平均每班作业" value={String(classes.length ? Math.round((classes.reduce((sum, item) => sum + item.assignmentCount, 0) / classes.length) * 10) / 10 : 0)} helper="按当前学校班级计算" />
        </div>
      </Card>

      <Card title="筛选与检索" tag="筛选">
        <div className="grid grid-3" style={{ alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">搜索班级 / 学科 / 风险标签</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索班级名、学科或风险标签"
              aria-label="搜索班级"
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">年级</span>
            <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} style={fieldStyle}>
              <option value="all">全部年级</option>
              {gradeOptions.map((item) => (
                <option key={item} value={item}>
                  {item} 年级
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">状态</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ClassStatusFilter)} style={fieldStyle}>
              <option value="all">全部班级</option>
              <option value="teacher_gap">待绑定教师</option>
              <option value="empty">暂无学生</option>
              <option value="no_assignments">未布置作业</option>
              <option value="overloaded">人数偏高</option>
              <option value="healthy">运行稳定</option>
            </select>
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button ghost" type="button" onClick={() => { setKeyword(""); setGradeFilter("all"); setStatusFilter("all"); }}>
            清空筛选
          </button>
        </div>
      </Card>

      <Card title={`班级列表（${filteredClasses.length}）`} tag="清单">
        {filteredClasses.length ? (
          <div className="grid" style={{ gap: 10 }}>
            {filteredClasses.map((item) => {
              const issueTags = getClassIssueTags(item);
              return (
                <div className="card" key={item.id}>
                  <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div className="section-title">{item.name}</div>
                      <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 4 }}>
                        {item.subject} · {item.grade} 年级 · {item.studentCount} 人 · {item.assignmentCount} 份作业
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                        教师：{item.teacherName ?? item.teacherId ?? "未绑定"} · 创建于 {formatLoadedTime(item.createdAt)}
                      </div>
                    </div>
                    <span className="pill">{issueTags.length ? `${issueTags.length} 项待跟进` : "运行稳定"}</span>
                  </div>
                  <div className="cta-row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                    {issueTags.length ? issueTags.map((tag) => <span className="pill" key={`${item.id}-${tag}`}>{tag}</span>) : <span className="pill">教师已绑定</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <StatePanel
            title="当前筛选下没有班级"
            description="试试清空关键词或切换筛选条件。"
            tone="empty"
            action={
              <button className="button secondary" type="button" onClick={() => { setKeyword(""); setGradeFilter("all"); setStatusFilter("all"); }}>
                清空筛选
              </button>
            }
          />
        )}
      </Card>
    </div>
  );
}
