"use client";

import StatePanel from "@/components/StatePanel";
import StudentFavoritesFiltersCard from "./_components/StudentFavoritesFiltersCard";
import StudentFavoritesHeader from "./_components/StudentFavoritesHeader";
import StudentFavoritesList from "./_components/StudentFavoritesList";
import StudentFavoritesOverviewSection from "./_components/StudentFavoritesOverviewSection";
import { useStudentFavoritesPageView } from "./useStudentFavoritesPageView";

export default function StudentFavoritesPage() {
  const favoritesPage = useStudentFavoritesPageView();

  if (favoritesPage.loading && !favoritesPage.authRequired && !favoritesPage.hasFavoritesData) {
    return (
      <StatePanel
        tone="loading"
        title="正在加载题目收藏夹"
        description="正在同步你的收藏题、标签和复习备注，请稍等。"
      />
    );
  }

  if (favoritesPage.authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录后查看收藏夹"
        description="登录学生账号后，才能查看和整理你的个人题目收藏记录。"
      />
    );
  }

  if (favoritesPage.pageError && !favoritesPage.hasFavoritesData) {
    return (
      <StatePanel
        tone="error"
        title="收藏夹加载失败"
        description={favoritesPage.pageError}
        action={
          <button className="button secondary" type="button" onClick={favoritesPage.reload}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <StudentFavoritesHeader {...favoritesPage.headerProps} />

      {favoritesPage.pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${favoritesPage.pageError}`}
          action={
            <button className="button secondary" type="button" onClick={favoritesPage.reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      {favoritesPage.actionError ? <div className="status-note error">{favoritesPage.actionError}</div> : null}
      {favoritesPage.actionMessage ? <div className="status-note success">{favoritesPage.actionMessage}</div> : null}

      <StudentFavoritesOverviewSection {...favoritesPage.overviewProps} />

      <StudentFavoritesFiltersCard {...favoritesPage.filtersProps} />

      <StudentFavoritesList {...favoritesPage.listProps} />
    </div>
  );
}
