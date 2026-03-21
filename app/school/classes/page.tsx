"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import Stat from "@/components/Stat";
import { formatLoadedTime } from "@/lib/client-request";
import type { ClassStatusFilter } from "./useSchoolClassesPage";
import { useSchoolClassesPage } from "./useSchoolClassesPage";

const fieldStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)",
  background: "var(--card)",
  color: "var(--ink)"
} as const;

export default function SchoolClassesPage() {
  const classesPage = useSchoolClassesPage();

  if (classesPage.loading && !classesPage.classes.length && !classesPage.authRequired) {
    return <StatePanel title="学校班级加载中" description="正在汇总学校班级结构与执行状态。" tone="loading" />;
  }

  if (classesPage.authRequired) {
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

  if (classesPage.error && !classesPage.classes.length) {
    return (
      <StatePanel
        title="学校班级加载失败"
        description={classesPage.error}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void classesPage.loadClasses()}>
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
          <div className="section-sub">统一查看班级结构、教师绑定、学生规模、课程表覆盖和作业执行状态。</div>
        </div>
        <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {classesPage.lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(classesPage.lastLoadedAt)}</span> : null}
          <span className="chip">Classes</span>
          <Link className="button ghost" href="/school/schedules">
            课程表管理
          </Link>
          <button
            className="button secondary"
            type="button"
            onClick={() => void classesPage.loadClasses("refresh")}
            disabled={classesPage.loading || classesPage.refreshing}
          >
            {classesPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {classesPage.error ? <StatePanel title="刷新存在异常" description={classesPage.error} tone="error" compact /> : null}

      <Card title="班级运营概览" tag="统计">
        <div className="grid grid-3">
          <Stat
            label="班级总数"
            value={String(classesPage.classes.length)}
            helper={`当前筛选 ${classesPage.filteredClasses.length} 个`}
          />
          <Stat label="待绑定教师" value={String(classesPage.teacherGapCount)} helper="优先补齐负责人" />
          <Stat label="空班级" value={String(classesPage.emptyCount)} helper="需要补员或清理" />
          <Stat label="未排课程表" value={String(classesPage.noScheduleCount)} helper="优先补齐首课" />
          <Stat label="未布置作业" value={String(classesPage.noAssignmentCount)} helper="教学覆盖不足" />
          <Stat label="高负载班级" value={String(classesPage.overloadedCount)} helper="重点巡检" />
          <Stat
            label="平均每班作业"
            value={String(
              classesPage.classes.length
                ? Math.round(
                    (classesPage.classes.reduce((sum, item) => sum + item.assignmentCount, 0) / classesPage.classes.length) *
                      10
                  ) / 10
                : 0
            )}
            helper="按当前学校班级计算"
          />
          <Stat
            label="平均每班课时"
            value={String(
              classesPage.classes.length
                ? Math.round(
                    (classesPage.classes.reduce((sum, item) => sum + item.scheduleCount, 0) / classesPage.classes.length) * 10
                  ) / 10
                : 0
            )}
            helper="按周估算"
          />
        </div>
      </Card>

      <Card title="筛选与检索" tag="筛选">
        <div className="grid grid-3" style={{ alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">搜索班级 / 学科 / 风险标签</span>
            <input
              value={classesPage.keyword}
              onChange={(event) => classesPage.setKeyword(event.target.value)}
              placeholder="搜索班级名、学科或风险标签"
              aria-label="搜索班级"
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">年级</span>
            <select
              value={classesPage.gradeFilter}
              onChange={(event) => classesPage.setGradeFilter(event.target.value)}
              style={fieldStyle}
            >
              <option value="all">全部年级</option>
              {classesPage.gradeOptions.map((item) => (
                <option key={item} value={item}>
                  {item} 年级
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">状态</span>
            <select
              value={classesPage.statusFilter}
              onChange={(event) => classesPage.setStatusFilter(event.target.value as ClassStatusFilter)}
              style={fieldStyle}
            >
              <option value="all">全部班级</option>
              <option value="teacher_gap">待绑定教师</option>
              <option value="empty">暂无学生</option>
              <option value="no_assignments">未布置作业</option>
              <option value="no_schedule">未排课程表</option>
              <option value="overloaded">人数偏高</option>
              <option value="healthy">运行稳定</option>
            </select>
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button ghost" type="button" onClick={classesPage.clearFilters}>
            清空筛选
          </button>
        </div>
      </Card>

      <Card title={`班级列表（${classesPage.filteredClasses.length}）`} tag="清单">
        {classesPage.filteredClasses.length ? (
          <div className="grid" style={{ gap: 10 }}>
            {classesPage.filteredClasses.map(({ record: item, issueTags }) => {
              return (
                <div className="card" key={item.id}>
                  <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div className="section-title">{item.name}</div>
                      <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 4 }}>
                        {item.subject} · {item.grade} 年级 · {item.studentCount} 人 · {item.assignmentCount} 份作业 · {item.scheduleCount} 节/周
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                        教师：{item.teacherName ?? item.teacherId ?? "未绑定"} · 创建于 {formatLoadedTime(item.createdAt)}
                      </div>
                    </div>
                    <span className="pill">{issueTags.length ? `${issueTags.length} 项待跟进` : "运行稳定"}</span>
                  </div>
                  <div className="cta-row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                    <span className="pill">{item.scheduleCount ? `已排 ${item.scheduleCount} 节/周` : "待排首课"}</span>
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
              <button className="button secondary" type="button" onClick={classesPage.clearFilters}>
                清空筛选
              </button>
            }
          />
        )}
      </Card>
    </div>
  );
}
