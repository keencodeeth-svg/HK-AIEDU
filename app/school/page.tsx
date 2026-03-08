"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import Stat from "@/components/Stat";
import { formatLoadedTime, getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import type { SchoolActionTone, SchoolClassRecord, SchoolOverview, SchoolUserRecord } from "@/lib/school-admin-types";

type SchoolOverviewResponse = { data?: SchoolOverview | null };
type SchoolClassesResponse = { data?: SchoolClassRecord[] };
type SchoolUsersResponse = { data?: SchoolUserRecord[] };

const ACTION_TONE_META: Record<SchoolActionTone, { label: string; color: string; background: string }> = {
  critical: { label: "立即处理", color: "#b42318", background: "rgba(180, 35, 24, 0.12)" },
  warning: { label: "优先跟进", color: "#b54708", background: "rgba(245, 158, 11, 0.16)" },
  info: { label: "建议补齐", color: "#175cd3", background: "rgba(23, 92, 211, 0.12)" },
  success: { label: "运行稳定", color: "#027a48", background: "rgba(2, 122, 72, 0.12)" }
};

export default function SchoolPage() {
  const [overview, setOverview] = useState<SchoolOverview | null>(null);
  const [classes, setClasses] = useState<SchoolClassRecord[]>([]);
  const [teachers, setTeachers] = useState<SchoolUserRecord[]>([]);
  const [students, setStudents] = useState<SchoolUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const loadAll = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [overviewData, classesData, teachersData, studentsData] = await Promise.all([
        requestJson<SchoolOverviewResponse>("/api/school/overview"),
        requestJson<SchoolClassesResponse>("/api/school/classes"),
        requestJson<SchoolUsersResponse>("/api/school/users?role=teacher"),
        requestJson<SchoolUsersResponse>("/api/school/users?role=student")
      ]);

      setOverview(overviewData.data ?? null);
      setClasses(classesData.data ?? []);
      setTeachers(teachersData.data ?? []);
      setStudents(studentsData.data ?? []);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        setOverview(null);
        setClasses([]);
        setTeachers([]);
        setStudents([]);
      } else {
        setError(getRequestErrorMessage(nextError, "加载学校控制台失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const teacherPreview = useMemo(() => teachers.slice(0, 6), [teachers]);
  const studentPreview = useMemo(() => students.slice(0, 6), [students]);
  const classPreview = useMemo(() => classes.slice(0, 6), [classes]);

  if (loading && !overview && !authRequired) {
    return (
      <StatePanel
        title="学校控制台加载中"
        description="正在汇总学校组织、班级和成员数据。"
        tone="loading"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        title="需要学校管理员权限"
        description="请使用学校管理员或平台主管账号登录后查看学校控制台。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (error && !overview) {
    return (
      <StatePanel
        title="学校控制台加载失败"
        description={error}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadAll()}>
            重试
          </button>
        }
      />
    );
  }

  if (!overview) {
    return (
      <StatePanel
        title="暂无学校数据"
        description="当前租户还没有生成学校概览数据，请稍后再试。"
        tone="empty"
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>学校控制台</h2>
          <div className="section-sub">统一查看学校组织运行、班级执行与成员状态，并给出优先整改动作。</div>
        </div>
        <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <span className="chip">School Admin</span>
          <button className="button secondary" type="button" onClick={() => void loadAll("refresh")} disabled={loading || refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {error ? (
        <StatePanel title="本次刷新存在异常" description={error} tone="error" compact />
      ) : null}

      <Card title="组织与执行概览" tag="运营">
        <div className="feature-card">
          <EduIcon name="chart" />
          <p>当前学校 ID：{overview.schoolId}</p>
        </div>
        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <Stat label="教师数" value={String(overview.teacherCount)} helper="学校范围" />
          <Stat label="学生数" value={String(overview.studentCount)} helper="学校范围" />
          <Stat label="家长数" value={String(overview.parentCount)} helper="家校协同" />
          <Stat label="班级数" value={String(overview.classCount)} helper="组织单元" />
          <Stat label="作业数" value={String(overview.assignmentCount)} helper="教学执行" />
          <Stat label="高负载班级" value={String(overview.overloadedClassCount)} helper="人数偏高" />
        </div>
      </Card>

      <Card title="运营健康指标" tag="覆盖率">
        <div className="grid grid-3">
          <Stat label="教师覆盖率" value={`${overview.teacherCoverageRate}%`} helper={`${overview.classesWithoutTeacherCount} 个班级待绑定`} />
          <Stat label="作业覆盖率" value={`${overview.assignmentCoverageRate}%`} helper={`${overview.classesWithoutAssignmentsCount} 个班级未开始`} />
          <Stat label="平均班级人数" value={String(overview.averageStudentsPerClass)} helper={`${overview.classesWithoutStudentsCount} 个空班级`} />
          <Stat label="平均班级作业" value={String(overview.averageAssignmentsPerClass)} helper="按当前班级均值" />
          <Stat label="未绑定教师班级" value={String(overview.classesWithoutTeacherCount)} helper="组织风险" />
          <Stat label="空班级数" value={String(overview.classesWithoutStudentsCount)} helper="需要补员" />
        </div>
      </Card>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card title="本周优先动作" tag="待办">
          <div className="grid" style={{ gap: 10 }}>
            {overview.actionItems.map((item) => {
              const meta = ACTION_TONE_META[item.tone];
              return (
                <div className="card" key={item.id}>
                  <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div className="section-title">{item.title}</div>
                      <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 6 }}>{item.description}</div>
                    </div>
                    <span
                      className="pill"
                      style={{ background: meta.background, color: meta.color, border: `1px solid ${meta.background}` }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className="cta-row" style={{ marginTop: 10, justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{item.count ? `涉及 ${item.count} 个对象` : "建议持续巡检"}</div>
                    <Link className="button ghost" href={item.href}>
                      {item.ctaLabel}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="重点关注班级" tag="风险">
          {overview.attentionClasses.length ? (
            <div className="grid" style={{ gap: 10 }}>
              {overview.attentionClasses.map((item) => (
                <div className="card" key={item.id}>
                  <div className="section-title">{item.name}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 4 }}>
                    {item.subject} · {item.grade} 年级 · {item.studentCount} 人 · {item.assignmentCount} 份作业
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                    教师：{item.teacherName ?? item.teacherId ?? "未绑定"}
                  </div>
                  <div className="cta-row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                    {item.issueTags.map((tag) => (
                      <span className="pill" key={`${item.id}-${tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <StatePanel
              title="当前没有高风险班级"
              description="教师绑定、学生编班和作业覆盖状态都比较稳定。"
              tone="success"
              compact
            />
          )}
        </Card>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card title="班级快照" tag="组织">
          <div className="section-sub">优先展示最近的班级结构与执行负载，便于快速进入治理页。</div>
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            {classPreview.map((item) => (
              <div className="card" key={item.id}>
                <div className="section-title">{item.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  {item.subject} · {item.grade} 年级 · {item.studentCount} 人 · {item.assignmentCount} 份作业
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                  班主任/任课：{item.teacherName ?? item.teacherId ?? "未绑定"}
                </div>
              </div>
            ))}
            {!classPreview.length ? <StatePanel title="暂无班级数据" description="当前学校还没有班级记录。" tone="empty" compact /> : null}
          </div>
          <Link className="button secondary" href="/school/classes" style={{ marginTop: 12 }}>
            查看全部班级
          </Link>
        </Card>

        <Card title="成员快照" tag="成员">
          <div className="grid" style={{ gap: 10 }}>
            <div className="card">
              <div className="section-title">教师（前 6）</div>
              <div className="grid" style={{ gap: 6, marginTop: 8 }}>
                {teacherPreview.map((teacher) => (
                  <div key={teacher.id} style={{ fontSize: 13, color: "var(--ink-1)" }}>
                    {teacher.name} · {teacher.email}
                  </div>
                ))}
                {!teacherPreview.length ? <div className="section-sub">暂无教师账号。</div> : null}
              </div>
            </div>
            <div className="card">
              <div className="section-title">学生（前 6）</div>
              <div className="grid" style={{ gap: 6, marginTop: 8 }}>
                {studentPreview.map((student) => (
                  <div key={student.id} style={{ fontSize: 13, color: "var(--ink-1)" }}>
                    {student.name} · {student.grade ? `${student.grade} 年级` : "未设置年级"}
                  </div>
                ))}
                {!studentPreview.length ? <div className="section-sub">暂无学生账号。</div> : null}
              </div>
            </div>
          </div>
          <div className="cta-row" style={{ marginTop: 12 }}>
            <Link className="button secondary" href="/school/teachers">
              教师管理
            </Link>
            <Link className="button ghost" href="/school/students">
              学生管理
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
