"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import { TeacherSeatingDraftPlanCard } from "./_components/TeacherSeatingDraftPlanCard";
import { TeacherSeatingFollowUpCard } from "./_components/TeacherSeatingFollowUpCard";
import { TeacherSeatingHeader } from "./_components/TeacherSeatingHeader";
import { TeacherSeatingPreviewCard } from "./_components/TeacherSeatingPreviewCard";
import { TeacherSeatingSemesterStatusCard } from "./_components/TeacherSeatingSemesterStatusCard";
import { TeacherSeatingStrategyCard } from "./_components/TeacherSeatingStrategyCard";
import { TeacherSeatingStudentFactorsCard } from "./_components/TeacherSeatingStudentFactorsCard";
import { useTeacherSeatingPageView } from "./useTeacherSeatingPageView";

export default function TeacherSeatingPage() {
  const {
    loading,
    authRequired,
    hasClasses,
    hasDraftPlan,
    headerProps,
    semesterStatusCardProps,
    strategyCardProps,
    previewCardProps,
    followUpCardProps,
    draftPlanCardProps,
    studentFactorsCardProps
  } = useTeacherSeatingPageView();

  if (loading) {
    return (
      <StatePanel
        title="学期排座配置加载中"
        description="正在同步班级名单、学生画像与当前座位草稿。"
        tone="loading"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        title="需要教师账号登录"
        description="请先用教师账号登录后，再进入学期排座配置页面。"
        tone="info"
        action={
          <Link className="button primary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (!hasClasses || !hasDraftPlan || !draftPlanCardProps) {
    return (
      <StatePanel
        title="暂时还没有可排座的班级"
        description="先去教师工作台创建班级并加入学生，再回来完成本学期的座位初始化。"
        tone="empty"
        action={
          <Link className="button primary" href="/teacher">
            去教师工作台
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <TeacherSeatingHeader {...headerProps} />

      <TeacherSeatingSemesterStatusCard {...semesterStatusCardProps} />

      <TeacherSeatingStrategyCard {...strategyCardProps} />

      <TeacherSeatingPreviewCard {...previewCardProps} />

      <TeacherSeatingFollowUpCard {...followUpCardProps} />

      <TeacherSeatingDraftPlanCard {...draftPlanCardProps} />

      <TeacherSeatingStudentFactorsCard {...studentFactorsCardProps} />
    </div>
  );
}
