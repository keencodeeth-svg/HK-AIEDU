"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import ModulesClassSelectorCard from "./_components/ModulesClassSelectorCard";
import ModulesCreateCard from "./_components/ModulesCreateCard";
import ModulesListCard from "./_components/ModulesListCard";
import ModulesResourcesCard from "./_components/ModulesResourcesCard";
import { useTeacherModulesPageView } from "./useTeacherModulesPageView";

export default function TeacherModulesPage() {
  const modulesPage = useTeacherModulesPageView();

  if (modulesPage.authRequired) {
    return (
      <Card title="课程模块管理">
        <StatePanel
          compact
          tone="info"
          title="请先登录后管理课程模块"
          description="登录教师账号后即可维护章节结构、上传模块资源并调整排序。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (modulesPage.pageLoading) {
    return (
      <Card title="课程模块管理">
        <StatePanel
          compact
          tone="loading"
          title="课程模块管理加载中"
          description="正在同步班级、模块结构和资源列表。"
        />
      </Card>
    );
  }

  if (modulesPage.pageError) {
    return (
      <Card title="课程模块管理">
        <StatePanel
          compact
          tone="error"
          title="课程模块管理加载失败"
          description={modulesPage.pageError}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={modulesPage.reload}>
                重试
              </button>
              <Link className="button ghost" href="/teacher">
                返回教师端
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>课程模块管理</h2>
          <div className="section-sub">设置章节结构、上传课件并关联作业。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">模块</span>
          {modulesPage.lastLoadedAtLabel ? <span className="chip">更新于 {modulesPage.lastLoadedAtLabel}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={modulesPage.reload}
            disabled={modulesPage.loading}
          >
            {modulesPage.loading ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {modulesPage.classesNotice ? (
        <StatePanel compact tone="error" title="班级数据刷新失败" description={modulesPage.classesNotice} />
      ) : null}
      {modulesPage.modulesNotice ? (
        <StatePanel compact tone="error" title="模块列表同步失败" description={modulesPage.modulesNotice} />
      ) : null}
      {modulesPage.resourcesNotice ? (
        <StatePanel compact tone="error" title="模块资源同步失败" description={modulesPage.resourcesNotice} />
      ) : null}
      {modulesPage.error ? (
        <StatePanel compact tone="error" title="模块管理操作失败" description={modulesPage.error} />
      ) : null}
      {!modulesPage.error && modulesPage.message ? (
        <StatePanel compact tone="success" title="模块管理操作已完成" description={modulesPage.message} />
      ) : null}

      <ModulesClassSelectorCard {...modulesPage.classSelectorCardProps} />
      <ModulesCreateCard {...modulesPage.createCardProps} />
      <ModulesListCard {...modulesPage.listCardProps} />
      <ModulesResourcesCard {...modulesPage.resourcesCardProps} />
    </div>
  );
}
