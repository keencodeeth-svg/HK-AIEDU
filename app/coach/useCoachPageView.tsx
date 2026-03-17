"use client";

import type { ComponentProps } from "react";
import { CoachComposerCard } from "./_components/CoachComposerCard";
import { CoachGuidanceCard } from "./_components/CoachGuidanceCard";
import { useCoachPage } from "./useCoachPage";

export function useCoachPageView() {
  const page = useCoachPage();

  const composerCardProps: ComponentProps<typeof CoachComposerCard> = {
    question: page.question,
    subject: page.subject,
    grade: page.grade,
    studentAnswer: page.studentAnswer,
    loading: page.loading,
    error: page.error,
    hasQuestion: page.hasQuestion,
    hasStudentAnswer: page.hasStudentAnswer,
    onQuestionChange: page.setQuestion,
    onSubjectChange: page.setSubject,
    onGradeChange: page.setGrade,
    onStudentAnswerChange: page.setStudentAnswer,
    onStartCoach: () => {
      void page.startCoach();
    },
    onSubmitThinking: () => {
      void page.submitThinking();
    },
    onRevealAnswer: () => {
      void page.revealAnswer();
    }
  };

  const guidanceCardProps: ComponentProps<typeof CoachGuidanceCard> = {
    data: page.data,
    hintIndex: page.hintIndex,
    onShowNextHint: page.showNextHint
  };

  return {
    authRequired: page.authRequired,
    hasData: Boolean(page.data),
    composerCardProps,
    guidanceCardProps
  };
}
