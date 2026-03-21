"use client";

import { useCallback, useRef, useState } from "react";
import type { TutorLaunchIntent } from "@/lib/tutor-launch";
import {
  DEFAULT_ANSWER_MODE,
  DEFAULT_GRADE,
  DEFAULT_SUBJECT
} from "./config";
import type { TutorAnswerMode } from "./types";

export function useTutorPageState() {
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const answerSectionRef = useRef<HTMLDivElement | null>(null);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [launchIntent, setLaunchIntent] = useState<TutorLaunchIntent | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [question, setQuestion] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [grade, setGrade] = useState(DEFAULT_GRADE);
  const [answerMode, setAnswerMode] = useState<TutorAnswerMode>(DEFAULT_ANSWER_MODE);

  const handleAuthRequired = useCallback(() => {
    setAuthRequired(true);
  }, []);

  return {
    questionInputRef,
    answerSectionRef,
    launchMessage,
    launchIntent,
    authRequired,
    question,
    subject,
    grade,
    answerMode,
    setLaunchMessage,
    setLaunchIntent,
    setAuthRequired,
    setQuestion,
    setSubject,
    setGrade,
    setAnswerMode,
    handleAuthRequired
  };
}
