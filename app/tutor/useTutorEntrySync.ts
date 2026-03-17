"use client";

import { type ReadonlyURLSearchParams } from "next/navigation";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics-client";
import { GRADE_OPTIONS, SUBJECT_OPTIONS } from "@/lib/constants";
import type { TutorLaunchIntent } from "@/lib/tutor-launch";
import type { TutorAnswerMode } from "./types";
import {
  isTutorAnswerMode,
  isTutorLaunchIntent,
  isTutorLaunchPanel
} from "./utils";

type UseTutorEntrySyncParams = {
  searchParams: ReadonlyURLSearchParams;
  questionInputRef: RefObject<HTMLTextAreaElement | null>;
  setLaunchIntent: (intent: TutorLaunchIntent | null) => void;
  setLaunchMessage: (message: string | null) => void;
  setShowFavorites: Dispatch<SetStateAction<boolean>>;
  setSubject: (value: string) => void;
  setGrade: (value: string) => void;
  setAnswerMode: (value: TutorAnswerMode) => void;
};

export function useTutorEntrySync({
  searchParams,
  questionInputRef,
  setLaunchIntent,
  setLaunchMessage,
  setShowFavorites,
  setSubject,
  setGrade,
  setAnswerMode
}: UseTutorEntrySyncParams) {
  const launchSignatureRef = useRef("");

  useEffect(() => {
    const rawIntent = searchParams.get("intent");
    const rawPanel = searchParams.get("panel");
    const source = searchParams.get("source")?.trim() ?? "";
    const favoritesOnly = searchParams.get("favorites") === "1";
    const nextSubject = searchParams.get("subject");
    const nextGrade = searchParams.get("grade");
    const nextAnswerMode = searchParams.get("answerMode");
    const intent = isTutorLaunchIntent(rawIntent) ? rawIntent : null;
    const panel = isTutorLaunchPanel(rawPanel) ? rawPanel : intent === "history" ? "history" : "composer";
    const signature = [intent ?? "", panel, source, favoritesOnly ? "1" : "0", nextSubject ?? "", nextGrade ?? "", nextAnswerMode ?? ""].join("|");

    if (launchSignatureRef.current === signature) {
      return;
    }
    launchSignatureRef.current = signature;

    setLaunchIntent(intent);
    setLaunchMessage(null);
    setShowFavorites(favoritesOnly);

    if (SUBJECT_OPTIONS.some((item) => item.value === nextSubject)) {
      setSubject(nextSubject!);
    }
    if (GRADE_OPTIONS.some((item) => item.value === nextGrade)) {
      setGrade(nextGrade!);
    }
    if (isTutorAnswerMode(nextAnswerMode)) {
      setAnswerMode(nextAnswerMode);
    }

    const scrollToAnchor = (anchorId: string, focusTextInput = false) => {
      requestAnimationFrame(() => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (focusTextInput) {
          questionInputRef.current?.focus();
        }
      });
    };

    if (panel === "history") {
      setLaunchMessage(favoritesOnly ? "已打开历史收藏，可直接回看并复用之前的题目。" : "已打开 AI 历史，可继续回看并复用。");
      scrollToAnchor("tutor-history-anchor");
    } else if (intent === "image") {
      setLaunchMessage("已进入拍题模式：上传题图后即可开始识题。\n建议先把题干、图形和选项完整拍入。");
      scrollToAnchor("tutor-composer-anchor");
    } else if (intent === "text") {
      setLaunchMessage("已进入文字提问模式：输入题目即可开始求解。\n如有识别误差，也可以直接用文字修正。");
      scrollToAnchor("tutor-composer-anchor", true);
    } else if (source) {
      setLaunchMessage("已从快捷入口进入 AI 辅导。");
    }

    if (source || intent || panel === "history") {
      trackEvent({
        eventName: "tutor_entry_landed",
        page: "/tutor",
        subject: SUBJECT_OPTIONS.some((item) => item.value === nextSubject) ? nextSubject ?? undefined : undefined,
        grade: GRADE_OPTIONS.some((item) => item.value === nextGrade) ? nextGrade ?? undefined : undefined,
        props: {
          source: source || "direct",
          intent,
          panel,
          favoritesOnly
        }
      });
    }
  }, [
    questionInputRef,
    searchParams,
    setAnswerMode,
    setGrade,
    setLaunchIntent,
    setLaunchMessage,
    setShowFavorites,
    setSubject
  ]);
}
