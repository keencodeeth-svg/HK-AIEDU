"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useStudentModulesPage } from "./useStudentModulesPage";

export default function StudentModulesPage() {
  const modulesPage = useStudentModulesPage();

  function renderModuleCompact(module: (typeof modulesPage.visibleClasses)[number]["modules"][number]) {
    const { progress, href } = modulesPage.renderModuleCompact(module);
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
        <Link className="button secondary" href={href}>
          进入
        </Link>
      </div>
    );
  }

  function renderModuleDetailed(module: (typeof modulesPage.visibleClasses)[number]["modules"][number]) {
    const { progress, href } = modulesPage.renderModuleDetailed(module);
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
        <Link className="button secondary" href={href} style={{ marginTop: 8 }}>
          查看模块
        </Link>
      </div>
    );
  }

  if (modulesPage.loading && !modulesPage.hasModulesData && !modulesPage.authRequired) {
    return <StatePanel title="课程模块加载中" description="正在同步班级模块、任务进度与学科分布。" tone="loading" />;
  }

  if (modulesPage.authRequired) {
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

  if (modulesPage.pageError && !modulesPage.hasModulesData) {
    return (
      <StatePanel
        title="课程模块加载失败"
        description={modulesPage.pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void modulesPage.loadModules()}>
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
            模块 {modulesPage.totalModules} · 任务 {modulesPage.totalCompleted}/{modulesPage.totalAssignments}
          </span>
          {modulesPage.lastLoadedAtLabel ? <span className="chip">更新于 {modulesPage.lastLoadedAtLabel}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={() => void modulesPage.loadModules("refresh")}
            disabled={modulesPage.loading || modulesPage.refreshing}
          >
            {modulesPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {modulesPage.pageError ? (
        <StatePanel
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${modulesPage.pageError}`}
          tone="error"
          compact
          action={
            <button className="button secondary" type="button" onClick={() => void modulesPage.loadModules("refresh")}>
              再试一次
            </button>
          }
        />
      ) : null}

      <div className="toolbar-wrap">
        <select
          className="select-control"
          value={modulesPage.subjectFilter}
          onChange={(event) => {
            modulesPage.updateSubjectFilter(event.target.value);
          }}
        >
          <option value="all">全部学科</option>
          {modulesPage.subjectOptions.map((subject) => (
            <option key={subject} value={subject}>
              {SUBJECT_LABELS[subject] ?? subject}
            </option>
          ))}
        </select>
        <button
          className={modulesPage.viewMode === "compact" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => modulesPage.setViewMode("compact")}
        >
          紧凑视图
        </button>
        <button
          className={modulesPage.viewMode === "detailed" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => modulesPage.setViewMode("detailed")}
        >
          详细视图
        </button>
        <span className="chip">班级 {modulesPage.filteredClasses.length}</span>
      </div>

      {modulesPage.filteredClasses.length ? (
        <>
          {modulesPage.visibleClasses.map((klass) => {
            const isExpanded = modulesPage.expandedClassIds[klass.classId] ?? false;
            return (
              <Card key={klass.classId} title={klass.className} tag="班级">
                <div className="feature-card">
                  <EduIcon name="book" />
                  <p>
                    {SUBJECT_LABELS[klass.subject] ?? klass.subject} · {klass.grade} 年级 · {klass.modules.length} 个模块
                  </p>
                  <button className="button ghost" type="button" onClick={() => modulesPage.toggleClass(klass.classId)}>
                    {isExpanded ? "收起模块" : "展开模块"}
                  </button>
                </div>
                {isExpanded ? (
                  klass.modules.length ? (
                    modulesPage.viewMode === "compact" ? (
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
          {modulesPage.filteredClasses.length > 5 ? (
            <button
              className="button ghost"
              type="button"
              onClick={() => modulesPage.setShowAllClasses((prev) => !prev)}
            >
              {modulesPage.showAllClasses ? "收起班级" : `展开全部班级（${modulesPage.filteredClasses.length}）`}
            </button>
          ) : null}
        </>
      ) : (
        <StatePanel title="暂无班级模块" description="加入班级并分配模块后，这里会展示单元与作业进度。" tone="empty" />
      )}
    </div>
  );
}
