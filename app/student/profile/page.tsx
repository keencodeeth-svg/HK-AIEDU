"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import StudentProfileBasicInfoCard from "./_components/StudentProfileBasicInfoCard";
import StudentProfileClassroomPreferencesCard from "./_components/StudentProfileClassroomPreferencesCard";
import StudentProfileCompletenessCard from "./_components/StudentProfileCompletenessCard";
import StudentProfileHeader from "./_components/StudentProfileHeader";
import StudentProfileObserverCodeCard from "./_components/StudentProfileObserverCodeCard";
import StudentProfileSupportNotesCard from "./_components/StudentProfileSupportNotesCard";
import { useStudentProfilePageView } from "./useStudentProfilePageView";

export default function StudentProfilePage() {
  const profilePage = useStudentProfilePageView();

  if (profilePage.loading && !profilePage.profileReady && !profilePage.authRequired) {
    return (
      <StatePanel
        title="学生资料加载中"
        description="正在同步学习档案、课堂偏好和家长绑定信息。"
        tone="loading"
      />
    );
  }

  if (profilePage.authRequired) {
    return (
      <StatePanel
        title="请先登录后查看学生资料"
        description="登录后即可维护学习档案、课堂偏好和家长绑定码。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (profilePage.pageError && !profilePage.profileReady) {
    return (
      <StatePanel
        title="学生资料加载失败"
        description={profilePage.pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={profilePage.reload}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18, maxWidth: 960 }}>
      <StudentProfileHeader />

      {profilePage.pageError && profilePage.profileReady ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${profilePage.pageError}`}
          action={
            <button className="button secondary" type="button" onClick={profilePage.reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      <StudentProfileCompletenessCard {...profilePage.completenessCardProps} />

      <form onSubmit={profilePage.handleSave} style={{ display: "grid", gap: 18 }}>
        <StudentProfileBasicInfoCard {...profilePage.basicInfoCardProps} />
        <StudentProfileClassroomPreferencesCard {...profilePage.classroomPreferencesCardProps} />
        <StudentProfileSupportNotesCard {...profilePage.supportNotesCardProps} />
      </form>

      <StudentProfileObserverCodeCard {...profilePage.observerCodeCardProps} />
    </div>
  );
}
