"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import Stat from "@/components/Stat";
import { formatLoadedTime } from "@/lib/client-request";
import { useSchoolStudentsPage } from "./useSchoolStudentsPage";

const fieldStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)",
  background: "var(--card)",
  color: "var(--ink)"
} as const;

export default function SchoolStudentsPage() {
  const studentsPage = useSchoolStudentsPage();

  if (studentsPage.loading && !studentsPage.students.length && !studentsPage.authRequired) {
    return <StatePanel title="学生管理加载中" description="正在汇总学生账号与年级分布。" tone="loading" />;
  }

  if (studentsPage.authRequired) {
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

  if (studentsPage.error && !studentsPage.students.length) {
    return (
      <StatePanel
        title="学生管理加载失败"
        description={studentsPage.error}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void studentsPage.loadStudents()}>
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
          {studentsPage.lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(studentsPage.lastLoadedAt)}</span> : null}
          <span className="chip">Students</span>
          <button
            className="button secondary"
            type="button"
            onClick={() => void studentsPage.loadStudents("refresh")}
            disabled={studentsPage.loading || studentsPage.refreshing}
          >
            {studentsPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {studentsPage.error ? <StatePanel title="刷新存在异常" description={studentsPage.error} tone="error" compact /> : null}

      <Card title="学生运营概览" tag="统计">
        <div className="grid grid-3">
          <Stat
            label="学生总数"
            value={String(studentsPage.students.length)}
            helper={`当前筛选 ${studentsPage.filteredStudents.length} 人`}
          />
          <Stat label="未设置年级" value={String(studentsPage.stageSummary.missing)} helper="建议补齐资料" />
          <Stat label="年级覆盖" value={String(studentsPage.gradeOptions.length)} helper="有学生分布的年级数" />
          <Stat label="小学段" value={String(studentsPage.stageSummary.primary)} helper="1-6 年级" />
          <Stat label="初中段" value={String(studentsPage.stageSummary.middle)} helper="7-9 年级" />
          <Stat label="高中段" value={String(studentsPage.stageSummary.high)} helper="10 年级及以上" />
        </div>
      </Card>

      <Card title="筛选与检索" tag="筛选">
        <div className="grid grid-2" style={{ alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">搜索学生 / 邮箱 / 年级</span>
            <input
              value={studentsPage.keyword}
              onChange={(event) => studentsPage.setKeyword(event.target.value)}
              placeholder="搜索学生姓名、邮箱或年级"
              aria-label="搜索学生"
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">年级</span>
            <select
              value={studentsPage.gradeFilter}
              onChange={(event) => studentsPage.setGradeFilter(event.target.value)}
              style={fieldStyle}
            >
              <option value="all">全部年级</option>
              {studentsPage.gradeOptions.map((item) => (
                <option key={item} value={item}>
                  {item} 年级
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button ghost" type="button" onClick={studentsPage.clearFilters}>
            清空筛选
          </button>
        </div>
      </Card>

      <Card title={`学生列表（${studentsPage.filteredStudents.length}）`} tag="清单">
        {studentsPage.filteredStudents.length ? (
          <div className="grid" style={{ gap: 10 }}>
            {studentsPage.filteredStudents.map((student) => (
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
              <button className="button secondary" type="button" onClick={studentsPage.clearFilters}>
                清空筛选
              </button>
            }
          />
        )}
      </Card>
    </div>
  );
}
