"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import Stat from "@/components/Stat";
import { formatLoadedTime, requestJson } from "@/lib/client-request";
import type { SchoolUserRecord } from "@/lib/school-admin-types";
import { getSchoolAdminRequestMessage, isSchoolAdminAuthRequiredError } from "../utils";

type SchoolUsersResponse = { data?: SchoolUserRecord[] };

const fieldStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)",
  background: "var(--card)",
  color: "var(--ink)"
} as const;

export default function SchoolStudentsPage() {
  const [students, setStudents] = useState<SchoolUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");

  const loadStudents = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const payload = await requestJson<SchoolUsersResponse>("/api/school/users?role=student");
      setStudents(payload.data ?? []);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (isSchoolAdminAuthRequiredError(nextError)) {
        setAuthRequired(true);
        setStudents([]);
      } else {
        setError(getSchoolAdminRequestMessage(nextError, "加载学生管理失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const gradeOptions = useMemo(
    () => Array.from(new Set(students.map((item) => item.grade).filter(Boolean) as string[])).sort((left, right) => left.localeCompare(right, "zh-CN")),
    [students]
  );

  const stageSummary = useMemo(() => {
    return students.reduce(
      (acc, item) => {
        const grade = Number(item.grade ?? 0);
        if (!item.grade || Number.isNaN(grade)) {
          acc.missing += 1;
        } else if (grade <= 6) {
          acc.primary += 1;
        } else if (grade <= 9) {
          acc.middle += 1;
        } else {
          acc.high += 1;
        }
        return acc;
      },
      { primary: 0, middle: 0, high: 0, missing: 0 }
    );
  }, [students]);

  const filteredStudents = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();
    return students.filter((student) => {
      if (gradeFilter !== "all" && student.grade !== gradeFilter) return false;
      if (!keywordLower) return true;
      return [student.name, student.email, student.grade ?? "未设置年级"].join(" ").toLowerCase().includes(keywordLower);
    });
  }, [gradeFilter, keyword, students]);

  if (loading && !students.length && !authRequired) {
    return <StatePanel title="学生管理加载中" description="正在汇总学生账号与年级分布。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="需要学校管理员权限"
        description="请使用学校管理员或平台主管账号查看学生管理。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (error && !students.length) {
    return (
      <StatePanel
        title="学生管理加载失败"
        description={error}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadStudents()}>
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
          <h2>学生管理</h2>
          <div className="section-sub">按学校视角管理学生账号、年级分布和基础资料完整度。</div>
        </div>
        <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <span className="chip">Students</span>
          <button className="button secondary" type="button" onClick={() => void loadStudents("refresh")} disabled={loading || refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {error ? <StatePanel title="刷新存在异常" description={error} tone="error" compact /> : null}

      <Card title="学生运营概览" tag="统计">
        <div className="grid grid-3">
          <Stat label="学生总数" value={String(students.length)} helper={`当前筛选 ${filteredStudents.length} 人`} />
          <Stat label="未设置年级" value={String(stageSummary.missing)} helper="建议补齐资料" />
          <Stat label="年级覆盖" value={String(gradeOptions.length)} helper="有学生分布的年级数" />
          <Stat label="小学段" value={String(stageSummary.primary)} helper="1-6 年级" />
          <Stat label="初中段" value={String(stageSummary.middle)} helper="7-9 年级" />
          <Stat label="高中段" value={String(stageSummary.high)} helper="10 年级及以上" />
        </div>
      </Card>

      <Card title="筛选与检索" tag="筛选">
        <div className="grid grid-2" style={{ alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">搜索学生 / 邮箱 / 年级</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索学生姓名、邮箱或年级"
              aria-label="搜索学生"
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
        </div>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button ghost" type="button" onClick={() => { setKeyword(""); setGradeFilter("all"); }}>
            清空筛选
          </button>
        </div>
      </Card>

      <Card title={`学生列表（${filteredStudents.length}）`} tag="清单">
        {filteredStudents.length ? (
          <div className="grid" style={{ gap: 10 }}>
            {filteredStudents.map((student) => (
              <div className="card" key={student.id}>
                <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div className="section-title">{student.name}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 4 }}>
                      {student.email} · {student.grade ? `${student.grade} 年级` : "未设置年级"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                      {student.createdAt ? `注册于 ${formatLoadedTime(student.createdAt)} · ` : ""}ID：{student.id}
                    </div>
                  </div>
                  <span className="pill">{student.grade ? `${student.grade} 年级` : "待补资料"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <StatePanel
            title="当前筛选下没有学生"
            description="试试清空关键词或切换年级筛选。"
            tone="empty"
            action={
              <button className="button secondary" type="button" onClick={() => { setKeyword(""); setGradeFilter("all"); }}>
                清空筛选
              </button>
            }
          />
        )}
      </Card>
    </div>
  );
}
