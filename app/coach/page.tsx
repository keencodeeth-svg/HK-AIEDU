"use client";

import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { CoachComposerCard } from "./_components/CoachComposerCard";
import { CoachGuidanceCard } from "./_components/CoachGuidanceCard";
import { CoachHeader } from "./_components/CoachHeader";
import { useCoachPageView } from "./useCoachPageView";

export default function CoachPage() {
  const { authRequired, hasData, composerCardProps, guidanceCardProps } = useCoachPageView();

  if (authRequired) {
    return (
      <Card title="AI 学习教练">
        <StatePanel
          compact
          tone="info"
          title="请先登录后继续陪练"
          description="登录后即可使用 AI 学习教练，先说思路，再按提示推进。"
        />
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <CoachHeader />

      <CoachComposerCard {...composerCardProps} />

      {hasData ? <CoachGuidanceCard {...guidanceCardProps} /> : null}
    </div>
  );
}
