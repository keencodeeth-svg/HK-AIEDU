"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { TutorAnswerCard } from "./_components/TutorAnswerCard";
import { TutorComposerCard } from "./_components/TutorComposerCard";
import { TutorHistoryCard } from "./_components/TutorHistoryCard";
import { TutorStageOverview } from "./_components/TutorStageOverview";
import { useTutorPage } from "./useTutorPage";

export default function TutorPage() {
  const {
    authRequired,
    answerSectionRef,
    stageOverviewProps,
    composerCardProps,
    answerCardProps,
    historyCardProps
  } = useTutorPage();

  if (authRequired) {
    return (
      <div className="grid" style={{ gap: 18 }}>
        <Card title="AI 家教" tag="登录">
          <StatePanel
            compact
            tone="info"
            title="请先登录后继续使用 AI 家教"
            description="登录后即可保存历史记录、拍照识题、生成变式巩固，并把结果分享给老师或家长。"
            action={
              <Link className="button secondary" href="/login">
                前往登录
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <TutorStageOverview {...stageOverviewProps} />

      <TutorComposerCard {...composerCardProps} />

      <div id="tutor-answer-anchor" ref={answerSectionRef} />
      {answerCardProps ? <TutorAnswerCard {...answerCardProps} /> : null}

      <TutorHistoryCard {...historyCardProps} />
    </div>
  );
}
