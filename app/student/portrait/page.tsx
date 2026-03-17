"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import StudentPortraitActionCard from "./_components/StudentPortraitActionCard";
import StudentPortraitHeader from "./_components/StudentPortraitHeader";
import StudentPortraitOverviewCard from "./_components/StudentPortraitOverviewCard";
import StudentPortraitRadarCard from "./_components/StudentPortraitRadarCard";
import StudentPortraitRecentTutorCard from "./_components/StudentPortraitRecentTutorCard";
import StudentPortraitStageBanner from "./_components/StudentPortraitStageBanner";
import StudentPortraitSubjectMasteryCard from "./_components/StudentPortraitSubjectMasteryCard";
import StudentPortraitWeakPointsCard from "./_components/StudentPortraitWeakPointsCard";
import { useStudentPortraitPageView } from "./useStudentPortraitPageView";

export default function PortraitPage() {
  const portraitPage = useStudentPortraitPageView();

  if (portraitPage.loading && !portraitPage.authRequired && !portraitPage.hasPortraitData) {
    return (
      <StatePanel
        tone="loading"
        title="正在加载学习画像"
        description="正在汇总能力雷达与知识点掌握度，请稍等。"
      />
    );
  }

  if (portraitPage.authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录再查看学习画像"
        description="登录学生账号后，系统才能展示你的个人能力雷达和掌握度画像。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (portraitPage.pageError && !portraitPage.hasPortraitData) {
    return (
      <StatePanel
        tone="error"
        title="学习画像加载失败"
        description={portraitPage.pageError}
        action={
          <button className="button secondary" type="button" onClick={portraitPage.reloadPortrait}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <StudentPortraitHeader {...portraitPage.headerProps} />

      {portraitPage.pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${portraitPage.pageError}`}
          action={
            <button className="button secondary" type="button" onClick={portraitPage.reloadPortrait}>
              再试一次
            </button>
          }
        />
      ) : null}

      <StudentPortraitStageBanner {...portraitPage.stageBannerProps} />

      <StudentPortraitActionCard {...portraitPage.actionCardProps} />

      {portraitPage.recentTutorCardProps ? (
        <StudentPortraitRecentTutorCard {...portraitPage.recentTutorCardProps} />
      ) : null}

      <StudentPortraitOverviewCard {...portraitPage.overviewCardProps} />

      <StudentPortraitRadarCard {...portraitPage.radarCardProps} />

      <StudentPortraitSubjectMasteryCard {...portraitPage.subjectMasteryCardProps} />

      <StudentPortraitWeakPointsCard {...portraitPage.weakPointsCardProps} />
    </div>
  );
}
