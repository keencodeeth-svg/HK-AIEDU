"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import Stat from "@/components/Stat";
import { formatLoadedTime } from "@/lib/client-request";
import type { TeacherFilter } from "./useSchoolTeachersPage";
import { useSchoolTeachersPage } from "./useSchoolTeachersPage";

const fieldStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)",
  background: "var(--card)",
  color: "var(--ink)"
} as const;

export default function SchoolTeachersPage() {
  const teachersPage = useSchoolTeachersPage();

  if (teachersPage.loading && !teachersPage.teachers.length && !teachersPage.authRequired) {
    return <StatePanel title="教师管理加载中" description="正在汇总教师账号与带班信息。" tone="loading" />;
  }

  if (teachersPage.authRequired) {
    return (
      <StatePanel
        title="需要学校管理员权限"
        description="请使用学校管理员或平台主管账号查看教师管理。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (teachersPage.error && !teachersPage.teachers.length) {
    return (
      <StatePanel
        title="教师管理加载失败"
        description={teachersPage.error}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void teachersPage.loadData()}>
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
          <h2>教师管理</h2>
          <div className="section-sub">从组织层统一查看教师账号、带班分布和待分配状态。</div>
        </div>
        <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {teachersPage.lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(teachersPage.lastLoadedAt)}</span> : null}
          <span className="chip">Teachers</span>
          <button
            className="button secondary"
            type="button"
            onClick={() => void teachersPage.loadData("refresh")}
            disabled={teachersPage.loading || teachersPage.refreshing}
          >
            {teachersPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {teachersPage.error ? <StatePanel title="刷新存在异常" description={teachersPage.error} tone="error" compact /> : null}

      <Card title="教师运营概览" tag="统计">
        <div className="grid grid-3">
          <Stat
            label="教师总数"
            value={String(teachersPage.teachers.length)}
            helper={`当前筛选 ${teachersPage.filteredTeachers.length} 人`}
          />
          <Stat label="已带班教师" value={String(teachersPage.assignedCount)} helper="带班覆盖" />
          <Stat
            label="待分配教师"
            value={String(Math.max(teachersPage.teachers.length - teachersPage.assignedCount, 0))}
            helper="可继续补位"
          />
          <Stat label="多班教师" value={String(teachersPage.multiClassCount)} helper="关注负载均衡" />
          <Stat label="班级总数" value={String(teachersPage.classes.length)} helper="学校范围" />
          <Stat
            label="平均每位教师班级"
            value={String(
              teachersPage.teachers.length
                ? Math.round(
                    (teachersPage.classes.filter((item) => item.teacherId).length / teachersPage.teachers.length) * 10
                  ) / 10
                : 0
            )}
            helper="仅供排班参考"
          />
        </div>
      </Card>

      <Card title="筛选与检索" tag="筛选">
        <div className="grid grid-2" style={{ alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">搜索教师 / 邮箱 / 班级</span>
            <input
              value={teachersPage.keyword}
              onChange={(event) => teachersPage.setKeyword(event.target.value)}
              placeholder="搜索教师姓名、邮箱或所带班级"
              aria-label="搜索教师"
              style={fieldStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">教师状态</span>
            <select
              value={teachersPage.filter}
              onChange={(event) => teachersPage.setFilter(event.target.value as TeacherFilter)}
              style={fieldStyle}
            >
              <option value="all">全部教师</option>
              <option value="assigned">已带班</option>
              <option value="unassigned">待分配</option>
              <option value="multi_class">带多个班级</option>
            </select>
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button ghost" type="button" onClick={teachersPage.clearFilters}>
            清空筛选
          </button>
        </div>
      </Card>

      <Card title={`教师列表（${teachersPage.filteredTeachers.length}）`} tag="清单">
        {teachersPage.filteredTeachers.length ? (
          <div className="grid" style={{ gap: 10 }}>
            {teachersPage.filteredTeachers.map(({ teacher, assignedClasses }) => {
              return (
                <div className="card" key={teacher.id}>
                  <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div className="section-title">{teacher.name}</div>
                      <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 4 }}>{teacher.email}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                        当前负责 {assignedClasses.length} 个班级{teacher.createdAt ? ` · 注册于 ${formatLoadedTime(teacher.createdAt)}` : ""}
                      </div>
                    </div>
                    <span className="pill">{assignedClasses.length ? `带班 ${assignedClasses.length}` : "待分配"}</span>
                  </div>
                  <div className="cta-row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                    {assignedClasses.length ? assignedClasses.map((item) => <span className="pill" key={`${teacher.id}-${item.id}`}>{item.name}</span>) : <span className="pill">暂未绑定班级</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <StatePanel
            title="当前筛选下没有教师"
            description="试试调整关键词或切换教师状态。"
            tone="empty"
            action={
              <button className="button secondary" type="button" onClick={teachersPage.clearFilters}>
                清空筛选
              </button>
            }
          />
        )}
      </Card>
    </div>
  );
}
