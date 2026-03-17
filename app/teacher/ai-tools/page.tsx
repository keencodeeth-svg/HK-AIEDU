"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import TeacherAiGuideCard from "./_components/TeacherAiGuideCard";
import TeacherOutlineGeneratorPanel from "./_components/TeacherOutlineGeneratorPanel";
import TeacherPaperGeneratorPanel from "./_components/TeacherPaperGeneratorPanel";
import TeacherQuestionCheckPanel from "./_components/TeacherQuestionCheckPanel";
import TeacherReviewPackPanel from "./_components/TeacherReviewPackPanel";
import TeacherWrongReviewPanel from "./_components/TeacherWrongReviewPanel";
import { useTeacherAiToolsPageView } from "./useTeacherAiToolsPageView";

export default function TeacherAiToolsPage() {
  const aiToolsPage = useTeacherAiToolsPageView();

  if (aiToolsPage.authRequired) {
    return (
      <Card title="AI 教学工具">
        <StatePanel
          compact
          tone="info"
          title="请先登录后使用 AI 教学工具"
          description="登录教师账号后即可组卷、生成讲稿、生成讲评包并下发复练。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (aiToolsPage.pageLoading) {
    return (
      <Card title="AI 教学工具">
        <StatePanel
          compact
          tone="loading"
          title="AI 教学工具加载中"
          description="正在同步班级和知识点目录。"
        />
      </Card>
    );
  }

  if (aiToolsPage.pageError) {
    return (
      <Card title="AI 教学工具">
        <StatePanel
          compact
          tone="error"
          title="AI 教学工具加载失败"
          description={aiToolsPage.pageError}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={aiToolsPage.reload}>
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
          <h2>AI 教学工具</h2>
          <div className="section-sub">一站式组卷、讲稿与纠错。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">教学助手</span>
          {aiToolsPage.lastLoadedAtLabel ? <span className="chip">更新于 {aiToolsPage.lastLoadedAtLabel}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={aiToolsPage.reload}
            disabled={aiToolsPage.loading || aiToolsPage.refreshing}
          >
            {aiToolsPage.refreshing ? "刷新中..." : aiToolsPage.loading ? "处理中..." : "刷新"}
          </button>
        </div>
      </div>

      {aiToolsPage.bootstrapNotice ? (
        <StatePanel compact tone="error" title="班级数据同步失败" description={aiToolsPage.bootstrapNotice} />
      ) : null}
      {aiToolsPage.knowledgePointsNotice ? (
        <StatePanel compact tone="error" title="知识点目录同步失败" description={aiToolsPage.knowledgePointsNotice} />
      ) : null}

      <TeacherAiGuideCard {...aiToolsPage.guideCardProps} />

      <TeacherPaperGeneratorPanel {...aiToolsPage.paperGeneratorPanelProps} />

      <TeacherOutlineGeneratorPanel {...aiToolsPage.outlineGeneratorPanelProps} />

      <TeacherWrongReviewPanel {...aiToolsPage.wrongReviewPanelProps} />

      <TeacherReviewPackPanel {...aiToolsPage.reviewPackPanelProps} />

      <TeacherQuestionCheckPanel {...aiToolsPage.questionCheckPanelProps} />
    </div>
  );
}
